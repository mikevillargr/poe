import { z } from 'zod'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ articleIds: z.array(z.string().uuid()).min(1).max(1000), on: z.boolean() })

// PATCH { articleIds, on } → { updated: string[], skipped: string[] }. DR-017: research before writing, per topic.
// One row (the chip) or many (the bulk bar). Rows that are researching or generating right now are skipped.
// A dedicated endpoint because the generic article schema is a frozen contract.
export const PATCH = withRoute<{ clientId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { articleIds, on } = bodySchema.parse(await req.json())
  const rows = await db
    .update(articles)
    .set({ researchEnabled: on })
    .where(
      and(
        eq(articles.tenantId, client.id),
        inArray(articles.id, articleIds),
        ne(articles.researchStatus, 'running'),
        ne(articles.generationStatus, 'running'),
      ),
    )
    .returning({ id: articles.id })
  const updated = rows.map((r) => r.id)
  return json({ updated, skipped: articleIds.filter((id) => !updated.includes(id)) })
})
