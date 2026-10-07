import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { toSSEResponse } from '@/lib/ai/sse'
import { startStandardGeneration } from '@/lib/pipeline/generation-run'
import { stopRun } from '@/lib/pipeline/runs'
import { generateBodySchema } from '@/lib/pipeline/schemas'
import { startTemplateGeneration } from '@/lib/templates/run'

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
  // D-002: articles made from a template run the template pipeline (link selection, writer, checks,
  // one retry) in the same run slot, with the same snapshot and status handling.
  if (article.templateId) {
    const templated = await startTemplateGeneration(client, article, user)
    return toSSEResponse(templated.subscribe(req.signal), { signal: req.signal })
  }
  const run = await startStandardGeneration(client, article, user, { useResearch: body.useResearch })
  return toSSEResponse(run.subscribe(req.signal), { signal: req.signal })
})

// DELETE → { stopped }. The explicit Stop: cancels the model call, keeps only the snapshot.
export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  await getArticle(client.id, params.articleId)
  return json(await stopRun('generation', client.id, params.articleId))
})
