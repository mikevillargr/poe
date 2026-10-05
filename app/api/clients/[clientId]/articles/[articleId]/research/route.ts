import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { Errors } from '@/lib/api/errors'
import { researchForRole, modelRef } from '@/lib/ai/roles'
import { toSSEResponse } from '@/lib/ai/sse'
import { buildResearchPrompt } from '@/lib/prompts/research'
import { parseResearchOutput, readResearch, setResearchState, writeResearch } from '@/lib/pipeline/research'
import { logArticleEvent, tapStream, toApiError } from '@/lib/pipeline/stream'
import { researchEditSchema } from '@/lib/pipeline/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type P = { clientId: string; articleId: string }

const STALE_RUN_MS = 10 * 60 * 1000

// POST → text/event-stream of AIStreamEvent: search / citation / delta … done, then
// { type: 'saved', articleId } once research is persisted (researchStatus = 'ready').
// On error: an { type: 'error' } event and researchStatus = 'error'. If the client disconnects
// first, nothing is persisted and researchStatus goes back to what it was.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  if (article.researchStatus === 'running' && Date.now() - article.updatedAt.getTime() < STALE_RUN_MS) {
    throw Errors.conflict('Research is already running for this article.')
  }
  const previousState = article.research ? 'ready' : 'idle'

  const prompt = buildResearchPrompt(article)
  let started: Awaited<ReturnType<typeof researchForRole>>
  try {
    started = await researchForRole(
      { system: prompt.system, messages: prompt.messages, maxTokens: prompt.maxTokens, maxSearches: prompt.maxSearches, signal: req.signal },
      { tenantId: client.id, articleId: article.id, userId: user.id },
    )
  } catch (err) {
    throw toApiError(err)
  }
  const model = modelRef(started.resolved)
  await setResearchState(client.id, article.id, 'running')

  const { events, tap } = tapStream(started.events, {
    onFailed: () => setResearchState(client.id, article.id, 'error'),
    onIncomplete: () => setResearchState(client.id, article.id, previousState),
  })

  return toSSEResponse(events, {
    signal: req.signal,
    onDone: async (done) => {
      try {
        const research = parseResearchOutput(done.text, done.citations?.length ? done.citations : tap.citations, tap.queries)
        await writeResearch(client.id, article.id, research, user.id)
        await setResearchState(client.id, article.id, 'ready', { researchModel: model })
        await logArticleEvent(client.id, article.id, 'researched', user.id, {
          model,
          citations: research.citations.length,
          queries: research.queries.length,
        })
        return [{ type: 'saved', articleId: article.id }]
      } catch (err) {
        await setResearchState(client.id, article.id, 'error').catch(() => {})
        throw err
      }
    },
  })
})

// PATCH { summary?, outlineHtml?, excludedCitationIds? } → { research }. Edits the persisted
// research brief in place (keeps the per-citation `excluded` flag the generic PATCH can't store).
export const PATCH = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const edit = researchEditSchema.parse(await req.json())
  const article = await getArticle(client.id, params.articleId)
  const current = readResearch(article.research) ?? { summary: '', outlineHtml: '', citations: [], queries: [] }

  const excluded = edit.excludedCitationIds ? new Set(edit.excludedCitationIds) : null
  const next = {
    ...current,
    ...(edit.summary !== undefined ? { summary: edit.summary } : {}),
    ...(edit.outlineHtml !== undefined ? { outlineHtml: edit.outlineHtml } : {}),
    citations: excluded
      ? current.citations.map(({ excluded: _drop, ...c }) => (excluded.has(c.id) ? { ...c, excluded: true } : c))
      : current.citations,
  }
  const row = await writeResearch(client.id, article.id, next, user.id)
  return json({ research: readResearch(row?.research) })
})
