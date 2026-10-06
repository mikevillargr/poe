import { eq } from 'drizzle-orm'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { resolveFacts, templateFactsSchema } from '@/lib/templates/facts'

export const dynamic = 'force-dynamic'

// GET → { facts (with defaults filled in), saved (only what this client overrides) } (DR-010 client facts)
export const GET = withRoute<{ clientId: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const settings = (client.settings ?? {}) as Record<string, unknown>
  return json({ facts: resolveFacts(settings), saved: settings.templateFacts ?? {} })
})

// PUT { facts } → { facts }. Replaces this client's facts (omitted keys fall back to the defaults).
export const PUT = withRoute<{ clientId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const facts = templateFactsSchema.parse((await req.json())?.facts ?? {})
  const settings = { ...((client.settings ?? {}) as Record<string, unknown>), templateFacts: facts }
  await db.update(tenants).set({ settings, updatedAt: new Date() }).where(eq(tenants.id, client.id))
  return json({ facts: resolveFacts(settings) })
})
