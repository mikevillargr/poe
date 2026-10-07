import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { withRoute, json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(['pending', 'accepted', 'dismissed']).optional(),
  /** A recomposed replacement text. */
  suggested: z.string().min(1).max(5000).optional(),
})

// PATCH { id, status?, suggested? } → { lastOptimize }. Saves what the editor did with one guideline-check
// suggestion (accept, dismiss, undo, recompose), so the list survives status changes and reloads.
export const PATCH = withRoute<{ clientId: string; articleId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const body = bodySchema.parse(await req.json())
  if (!article.lastOptimize?.suggestions?.some((s) => s.id === body.id)) throw Errors.notFound('Suggestion')
  const patch = { ...(body.status ? { status: body.status } : {}), ...(body.suggested ? { suggested: body.suggested } : {}) }
  // One atomic statement (merge into just this suggestion), so quick accept/dismiss clicks can't overwrite each other.
  const [row] = await db
    .update(articles)
    .set({
      lastOptimize: sql`jsonb_set(${articles.lastOptimize}, '{suggestions}', (
        SELECT coalesce(jsonb_agg(CASE WHEN elem->>'id' = ${body.id} THEN elem || ${JSON.stringify(patch)}::jsonb ELSE elem END ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(${articles.lastOptimize}->'suggestions') WITH ORDINALITY AS t(elem, ord)
      ))`,
    })
    .where(and(eq(articles.id, article.id), eq(articles.tenantId, client.id)))
    .returning({ lastOptimize: articles.lastOptimize })
  const next = row.lastOptimize
  return json({ lastOptimize: next })
})
