import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { toSSEResponse } from '@/lib/ai/sse'
import { readResearch, writeResearch } from '@/lib/pipeline/research'
import { startResearch } from '@/lib/pipeline/research-run'
import { stopRun } from '@/lib/pipeline/runs'
import { researchEditSchema } from '@/lib/pipeline/schemas'
import { recordArticleEvent } from '@/lib/articles/provenance'
import { db } from '@/lib/db'

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
  const run = await startResearch(client, article, user)
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
  // DR-020: what changed in the research (coalesced per editing burst).
  const parts = [edit.summary !== undefined && 'summary', edit.outlineHtml !== undefined && 'outline'].filter(Boolean) as string[]
  const nowExcluded = next.citations.filter((c) => (c as { excluded?: boolean }).excluded).length
  if (parts.length) {
    await recordArticleEvent(db, {
      tenantId: client.id,
      articleId: article.id,
      userId: user.id,
      type: 'research_edited',
      payload: { parts },
      coalesceMs: 10 * 60_000,
      merge: (p, n) => ({ parts: [...new Set([...((p.parts as string[]) ?? []), ...((n.parts as string[]) ?? [])])] }),
    })
  }
  if (excluded) {
    await recordArticleEvent(db, {
      tenantId: client.id,
      articleId: article.id,
      userId: user.id,
      type: 'sources_changed',
      payload: { excluded: nowExcluded, total: next.citations.length },
      coalesceMs: 10 * 60_000,
    })
  }
  return json({ research: readResearch(row?.research) })
})
