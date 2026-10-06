import { withRoute, json } from '@/lib/auth/guards'
import { ApiError } from '@/lib/api/errors'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { countWords } from '@/lib/articles/text'
import { modelRef, streamForRole } from '@/lib/ai/roles'
import { toSSEResponse } from '@/lib/ai/sse'
import { buildRevisionPrompt } from '@/lib/prompts/revision'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { readResearch } from '@/lib/pipeline/research'
import { persistRevisedDraft } from '@/lib/pipeline/generate'
import { snapshotDraft } from '@/lib/pipeline/versions'
import { tapStream, toApiError } from '@/lib/pipeline/stream'
import { drive, reserveRun, setRunState, stopRun } from '@/lib/pipeline/runs'
import { reviseBodySchema } from '@/lib/pipeline/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type P = { clientId: string; articleId: string }

// Revise the CURRENT saved draft with editor feedback (instead of regenerating from scratch).
//
// POST body { feedback: string }  (trimmed, 1..4000)
//   → text/event-stream of AIStreamEvent: { type:'delta', text } …, { type:'usage' }, { type:'done', text },
//     then { type:'saved', articleId, versionNo } once the revised draft is persisted. On failure a
//     final { type:'error', code, message }.
//   Errors before streaming (JSON `{ error, code }`): 400 BAD_REQUEST (invalid feedback),
//     409 NO_DRAFT (article has no draft to revise), 409 CONFLICT (a generation/revision is already
//     running), 404, 401/403, 502/503 (AI provider / role not configured).
// Shares the 'generation' run slot and generation_status with …/generate: while it runs the article
// shows generation_status 'running', and Stop is the same DELETE. The run is detached (leaving the page
// doesn't cancel it). The existing draft is first saved as a `manual` version "Before revision"; the
// result is saved as a `revised` version labelled "Revised: <feedback…>" and a `revised` event whose
// payload holds { feedback (full text), model, versionNo, wordCount, usedResearch, snapshotVersionNo }.
// Article status does not change.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const body = reviseBodySchema.parse(await req.json().catch(() => ({})))
  const article = await getArticle(client.id, params.articleId)
  if (countWords(article.draftHtml) === 0) {
    throw new ApiError(409, 'NO_DRAFT', 'There is no draft to revise yet. Generate or write one first.')
  }
  const run = reserveRun('generation', article.id)
  try {
    const research = readResearch(article.research)
    const hasResearch = !!research && !!(research.summary?.trim() || research.outlineHtml?.trim() || research.citations.length)

    const guidelines = await getActiveGuidelines(client.id, article.templateId)
    const prompt = buildRevisionPrompt(article, {
      clientName: client.name,
      guidelines,
      research: hasResearch ? research : null,
      feedback: body.feedback,
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

    const snapshot = await snapshotDraft(article, user, 'Before revision')
    await setRunState('generation', client.id, article.id, 'running')

    const { events } = tapStream(started.events, {
      onFailed: () => setRunState('generation', client.id, article.id, 'error'),
      // Stopped or disconnected before finishing: the draft is untouched, so it's still ready.
      onIncomplete: () => setRunState('generation', client.id, article.id, 'ready'),
    })

    drive(run, events, {
      onPersistError: () => setRunState('generation', client.id, article.id, 'error'),
      onDone: async (done) => {
        const saved = await persistRevisedDraft(client.id, article.id, done.text, model, user, {
          feedback: body.feedback,
          usedResearch: hasResearch,
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

// DELETE → { stopped }. Cancels the model call; the draft stays as it was (plus the "Before revision" snapshot).
export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  await getArticle(client.id, params.articleId)
  return json(await stopRun('generation', client.id, params.articleId))
})
