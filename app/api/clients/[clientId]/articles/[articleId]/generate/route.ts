import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { modelRef, streamForRole } from '@/lib/ai/roles'
import { toSSEResponse } from '@/lib/ai/sse'
import { buildGenerationPrompt } from '@/lib/prompts/generation'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { readResearch } from '@/lib/pipeline/research'
import { persistGeneratedDraft } from '@/lib/pipeline/generate'
import { snapshotDraft } from '@/lib/pipeline/versions'
import { tapStream, toApiError } from '@/lib/pipeline/stream'
import { drive, reserveRun, setRunState, stopRun } from '@/lib/pipeline/runs'
import { generateBodySchema } from '@/lib/pipeline/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type P = { clientId: string; articleId: string }

// POST { useResearch? } → text/event-stream of AIStreamEvent: delta … done, then
// { type: 'saved', articleId, versionNo } once the draft is persisted.
// A non-empty current draft is first saved as a `manual` version "Before regenerate". The run is
// detached from this request (lib/pipeline/runs.ts): a client disconnect doesn't cancel it, and the
// draft is saved either way. Only DELETE (Stop) cancels, keeping just the snapshot. 409 if running.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const body = generateBodySchema.parse(await req.json().catch(() => ({})))
  const article = await getArticle(client.id, params.articleId)
  const run = reserveRun('generation', article.id)
  try {
    const research = readResearch(article.research)
    const hasResearch = !!research && !!(research.summary?.trim() || research.outlineHtml?.trim() || research.citations.length)
    const useResearch = hasResearch && body.useResearch !== false
    const previousState = article.draftHtml?.trim() ? 'ready' : 'idle'

    const guidelines = await getActiveGuidelines(client.id)
    const prompt = buildGenerationPrompt(article, {
      clientName: client.name,
      guidelines,
      research: useResearch ? research : null,
    })

    let started: Awaited<ReturnType<typeof streamForRole>>
    try {
      started = await streamForRole(
        'generation',
        { system: prompt.system, messages: prompt.messages, maxTokens: prompt.maxTokens, signal: run.ac.signal },
        { tenantId: client.id, articleId: article.id, userId: user.id },
      )
    } catch (err) {
      throw toApiError(err)
    }
    const model = modelRef(started.resolved)

    const snapshot = await snapshotDraft(article, user, 'Before regenerate')
    await setRunState('generation', client.id, article.id, 'running')

    const { events } = tapStream(started.events, {
      onFailed: () => setRunState('generation', client.id, article.id, 'error'),
      onIncomplete: () => setRunState('generation', client.id, article.id, previousState),
    })

    drive(run, events, {
      onPersistError: () => setRunState('generation', client.id, article.id, 'error'),
      onDone: async (done) => {
        const saved = await persistGeneratedDraft(client.id, article.id, done.text, model, user, {
          usedResearch: useResearch,
          snapshotVersionNo: snapshot?.versionNo ?? null,
        })
        await setRunState('generation', client.id, article.id, 'ready')
        return [{ type: 'saved', articleId: article.id, versionNo: saved.versionNo }]
      },
    })
  } catch (err) {
    run.release()
    throw err
  }
  return toSSEResponse(run.subscribe(req.signal), { signal: req.signal })
})

// DELETE → { stopped }. The explicit Stop: cancels the model call, keeps only the snapshot.
export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  await getArticle(client.id, params.articleId)
  return json(await stopRun('generation', client.id, params.articleId))
})
