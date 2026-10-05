import 'server-only'
import { cache } from 'react'
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles, heuristics, tenants, universalGuidelines } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import type { ClientSummary, CreateClientInput } from '@/lib/clients/schemas'

export type Client = typeof tenants.$inferSelect

// All approved staff can see every client (D-001); tenancy is a data partition, not a permission.

export async function listClients(): Promise<ClientSummary[]> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      website: tenants.website,
      createdAt: tenants.createdAt,
      articleCount: count(articles.id),
    })
    .from(tenants)
    .leftJoin(articles, eq(articles.tenantId, tenants.id))
    .where(isNull(tenants.archivedAt))
    .groupBy(tenants.id)
    .orderBy(asc(sql`lower(${tenants.name})`))
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

/** Cached per request, so layouts and pages can both call it. */
export const getClientBySlug = cache(async (slug: string): Promise<Client | null> => {
  const [row] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
  return row ?? null
})

/** Resolve a client for an API route. Archived clients are read-only. */
export async function requireClient(clientId: string, opts: { write?: boolean } = {}): Promise<Client> {
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) throw Errors.notFound('Client')
  const [row] = await db.select().from(tenants).where(eq(tenants.id, clientId)).limit(1)
  if (!row) throw Errors.notFound('Client')
  if (opts.write && row.archivedAt) throw Errors.conflict('This client is archived.')
  return row
}

/** Creates a client and copies the active Universal guidelines into it, in one transaction. */
export async function createClient(input: CreateClientInput, user: AppUser) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, input.slug)).limit(1)
    if (existing) throw Errors.conflict(`A client with the slug "${input.slug}" already exists.`)

    const [client] = await tx
      .insert(tenants)
      .values({
        name: input.name,
        slug: input.slug,
        website: input.website || null,
        notes: input.notes || null,
        createdBy: user.id,
      })
      .returning()

    const template = await tx
      .select()
      .from(universalGuidelines)
      .where(eq(universalGuidelines.active, true))
      .orderBy(asc(universalGuidelines.sortOrder))

    if (template.length) {
      await tx.insert(heuristics).values(
        template.map((g, i) => ({
          tenantId: client.id,
          category: g.category,
          title: g.title,
          rule: g.rule,
          weight: g.weight,
          active: true,
          source: 'template_copy' as const,
          templateId: g.id,
          sortOrder: (i + 1) * 1024,
          createdBy: user.id,
          updatedBy: user.id,
        })),
      )
    }

    return { client, copiedGuidelines: template.length }
  })
}

export async function countClientGuidelines(tenantId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(heuristics)
    .where(and(eq(heuristics.tenantId, tenantId), eq(heuristics.active, true)))
  return row?.n ?? 0
}
