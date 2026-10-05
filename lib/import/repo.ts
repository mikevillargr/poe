import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { importBatches, users } from '@/lib/db/schema'
import { appendArticles } from '@/lib/articles/repo'
import type { ArticleInputParsed } from '@/lib/articles/schemas'
import type { AppUser } from '@/lib/auth/guards'

export interface RecentImport {
  id: string
  filename: string
  rowCount: number
  userName: string | null
  createdAt: string
}

export async function recentImports(tenantId: string, limit = 5): Promise<RecentImport[]> {
  const rows = await db
    .select({
      id: importBatches.id,
      filename: importBatches.filename,
      rowCount: importBatches.rowCount,
      userName: users.name,
      createdAt: importBatches.createdAt,
    })
    .from(importBatches)
    .leftJoin(users, eq(users.id, importBatches.createdBy))
    .where(eq(importBatches.tenantId, tenantId))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit)
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

/** Records the batch, then appends the rows to the end of the queue in sheet order. */
export async function importRows(
  tenantId: string,
  filename: string,
  rows: ArticleInputParsed[],
  skipped: Array<{ row: number; message: string }>,
  user: AppUser,
) {
  const [batch] = await db
    .insert(importBatches)
    .values({ tenantId, filename, rowCount: rows.length, errors: skipped, createdBy: user.id })
    .returning()
  const created = await appendArticles(tenantId, rows, user, { importBatchId: batch.id })
  return { batchId: batch.id, count: created.length }
}
