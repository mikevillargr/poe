import { count, eq } from 'drizzle-orm'
import { withRoute, json } from '@/lib/auth/guards'
import { db } from '@/lib/db'
import { universalGuidelines } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

// GET /api/universal-guidelines/count → { count } (shown in the "Add client" modal, DR-001)
export const GET = withRoute(async () => {
  const [row] = await db.select({ n: count() }).from(universalGuidelines).where(eq(universalGuidelines.active, true))
  return json({ count: row?.n ?? 0 })
})
