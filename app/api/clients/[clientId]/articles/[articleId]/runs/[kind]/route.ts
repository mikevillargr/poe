import { withRoute } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { toSSEResponse } from '@/lib/ai/sse'
import { getRun } from '@/lib/pipeline/runs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type P = { clientId: string; articleId: string; kind: string }

// GET → text/event-stream replaying the article's running research/generation run (everything so far, then
// live), or 204 when nothing is running in this process. DR-016: lets a page that didn't start the run (the
// workspace after a reload, the Home batch drawer) show its live activity. Watching never affects the run.
export const GET = withRoute<P>(async ({ req, params }) => {
  if (params.kind !== 'research' && params.kind !== 'generation') throw Errors.notFound('Run')
  const client = await requireClient(params.clientId)
  const article = await getArticle(client.id, params.articleId)
  const run = getRun(params.kind, article.id)
  if (!run || run.finished) return new Response(null, { status: 204 })
  return toSSEResponse(run.subscribe(req.signal), { signal: req.signal })
})
