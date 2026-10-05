import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { researchForRole, modelRef } from '@/lib/ai/roles'
import { toSSEResponse } from '@/lib/ai/sse'
import { buildResearchPrompt } from '@/lib/prompts/research'
import { parseResearchOutput, readResearch, writeResearch } from '@/lib/pipeline/research'
import { drive, reserveRun, setRunState, stopRun } from '@/lib/pipeline/runs'
import { logArticleEvent, tapStream, toApiError } from '@/lib/pipeline/stream'
import { researchEditSchema } from '@/lib/pipeline/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type P = { clientId: string; articleId: string }

// POST → text/event-stream of AIStreamEvent: search / citation / delta … done, then
// { type: 'saved', articleId } once research is persisted (researchStatus = 'ready').
// The run is detached from this request (lib/pipeline/runs.ts): if the client disconnects, the
// research still finishes and is saved; this stream is just a live view. 409 if one is already running.
// On error: an { type: 'error' } event and researchStatus = 'error'. Only DELETE (Stop) cancels.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const run = reserveRun('research', article.id)
  try {
    const previousState = article.research ? 'ready' : 'idle'
    const prompt = buildResearchPrompt(article)
    let started: Awaited<ReturnType<typeof researchForRole>>
    try {
      started = await researchForRole(
        { system: prompt.system, messages: prompt.messages, maxTokens: prompt.maxTokens, maxSearches: prompt.maxSearches, signal: run.ac.signal },
        { tenantId: client.id, articleId: article.id, userId: user.id },
      )
    } catch (err) {
      throw toApiError(err)
    }
    const model = modelRef(started.resolved)
    await setRunState('research', client.id, article.id, 'running')

    const { events, tap } = tapStream(started.events, {
      onFailed: () => setRunState('research', client.id, article.id, 'error'),
      onIncomplete: () => setRunState('research', client.id, article.id, previousState),
    })

    drive(run, events, {
      onPersistError: () => setRunState('research', client.id, article.id, 'error'),
      onDone: async (done) => {
        const research = parseResearchOutput(done.text, done.citations?.length ? done.citations : tap.citations, tap.queries)
        await writeResearch(client.id, article.id, research, user.id)
        await setRunState('research', client.id, article.id, 'ready', { researchModel: model })
        await logArticleEvent(client.id, article.id, 'researched', user.id, {
          model,
          citations: research.citations.length,
          queries: research.queries.length,
        })
        return [{ type: 'saved', articleId: article.id }]
      },
    })
  } catch (err) {
    run.release()
    throw err
  }
  return toSSEResponse(run.subscribe(req.signal), { signal: req.signal })
})

// DELETE → { stopped }. The explicit Stop: cancels the model call, saves nothing, resets the status.
export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  await getArticle(client.id, params.articleId)
  return json(await stopRun('research', client.id, params.articleId))
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
