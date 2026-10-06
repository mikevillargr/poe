import 'server-only'
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles, contentTemplateRevisions, contentTemplates, templateEvents, users, type TemplateSnapshot } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import { getTemplate } from './repo'
import { templateConfigSchema } from './schema'
import { STANDARD_TEMPLATE } from './standard'
import type { TemplateConfig } from './types'

// Staff-editable templates (DR-010): create (Standard preset, duplicate, copy from another client), save
// with a revision and an audit event per save, soft delete, history and restore.

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'template'

async function uniqueSlug(tenantId: string, name: string) {
  const base = slugify(name)
  const taken = new Set(
    (
      await db
        .select({ slug: contentTemplates.slug })
        .from(contentTemplates)
        .where(and(eq(contentTemplates.tenantId, tenantId), isNull(contentTemplates.deletedAt)))
    ).map((r) => r.slug),
  )
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
}

/** Validates a config, turning zod issues into one readable message. */
export function validateConfig(config: unknown): TemplateConfig {
  const r = templateConfigSchema.safeParse(config)
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'config'}: ${i.message}`).slice(0, 5).join('; ')
    throw Errors.badRequest(`The template isn’t valid: ${msg}`, { issues: r.error.issues.slice(0, 20) })
  }
  return r.data as TemplateConfig
}

/** List rows for the Templates page: revision, last editor, articles using it. */
export async function templateSummaries(tenantId: string) {
  const rows = await db
    .select({
      id: contentTemplates.id,
      slug: contentTemplates.slug,
      name: contentTemplates.name,
      kind: contentTemplates.kind,
      enabled: contentTemplates.enabled,
      revisionNo: contentTemplates.revisionNo,
      updatedAt: contentTemplates.updatedAt,
      updatedBy: users.name,
      updatedByEmail: users.email,
    })
    .from(contentTemplates)
    .leftJoin(users, eq(users.id, contentTemplates.updatedBy))
    .where(and(eq(contentTemplates.tenantId, tenantId), isNull(contentTemplates.deletedAt)))
    .orderBy(asc(contentTemplates.name))
  const used = await db
    .select({ templateId: articles.templateId, n: count() })
    .from(articles)
    .where(eq(articles.tenantId, tenantId))
    .groupBy(articles.templateId)
  const usage = new Map(used.map((u) => [u.templateId, Number(u.n)]))
  return rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: r.updatedBy || r.updatedByEmail || null,
    articles: usage.get(r.id) ?? 0,
  }))
}

export async function templateDetail(tenantId: string, templateId: string) {
  const t = await getTemplate(tenantId, templateId)
  const revisions = await db
    .select({
      revisionNo: contentTemplateRevisions.revisionNo,
      note: contentTemplateRevisions.note,
      editedAt: contentTemplateRevisions.editedAt,
      editedBy: users.name,
      editedByEmail: users.email,
    })
    .from(contentTemplateRevisions)
    .leftJoin(users, eq(users.id, contentTemplateRevisions.editedBy))
    .where(eq(contentTemplateRevisions.templateId, t.id))
    .orderBy(desc(contentTemplateRevisions.revisionNo))
  const [{ n }] = await db.select({ n: count() }).from(articles).where(eq(articles.templateId, t.id))
  return {
    template: t,
    articles: Number(n),
    revisions: revisions.map((r) => ({
      revisionNo: r.revisionNo,
      note: r.note,
      editedAt: r.editedAt.toISOString(),
      editedBy: r.editedBy || r.editedByEmail || 'Poe (seed)',
    })),
  }
}

export type CreateFrom = { kind: 'standard' } | { kind: 'template'; templateId: string; clientId?: string }

export async function createTemplate(tenantId: string, user: AppUser, name: string, from: CreateFrom) {
  let config: TemplateConfig
  let kind: TemplateConfig['kind']
  let eventType = 'created'
  let source: Record<string, unknown> = { from: 'standard' }
  if (from.kind === 'standard') {
    config = STANDARD_TEMPLATE.config
    kind = STANDARD_TEMPLATE.kind
  } else {
    const sourceTenant = from.clientId ?? tenantId
    const src = await getTemplate(sourceTenant, from.templateId)
    config = src.config
    kind = src.kind
    eventType = sourceTenant === tenantId ? 'duplicated' : 'copied'
    source = { from: eventType, sourceTemplateId: src.id, sourceClientId: sourceTenant, sourceName: src.name, sourceRevisionNo: src.revisionNo }
  }
  const slug = await uniqueSlug(tenantId, name)
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contentTemplates)
      .values({ tenantId, slug, name, kind, config, createdBy: user.id, updatedBy: user.id })
      .returning()
    const snapshot: TemplateSnapshot = { name, slug, kind, enabled: true, config }
    const note = from.kind === 'standard' ? 'Created from the Standard article preset' : `${eventType === 'copied' ? 'Copied' : 'Duplicated'} from “${source.sourceName}” (revision ${source.sourceRevisionNo})`
    await tx.insert(contentTemplateRevisions).values({ templateId: row.id, revisionNo: 1, snapshot, note, editedBy: user.id })
    await tx.insert(templateEvents).values({ templateId: row.id, tenantId, type: eventType, actorId: user.id, payload: source })
    return { id: row.id, slug }
  })
}

/** Saves name/enabled/config as the next revision (with an optional note) and logs the edit. */
export async function saveTemplate(
  tenantId: string,
  templateId: string,
  user: AppUser,
  patch: { name: string; enabled: boolean; config: unknown; note?: string | null },
  eventType: 'updated' | 'restored' = 'updated',
) {
  const current = await getTemplate(tenantId, templateId)
  const config = validateConfig(patch.config)
  const revisionNo = current.revisionNo + 1
  const snapshot: TemplateSnapshot = { name: patch.name, slug: current.slug, kind: config.kind, enabled: patch.enabled, config }
  await db.transaction(async (tx) => {
    await tx
      .update(contentTemplates)
      .set({ name: patch.name, enabled: patch.enabled, kind: config.kind, config, revisionNo, updatedBy: user.id, updatedAt: new Date() })
      .where(eq(contentTemplates.id, current.id))
    await tx.insert(contentTemplateRevisions).values({ templateId: current.id, revisionNo, snapshot, note: patch.note?.trim() || null, editedBy: user.id })
    await tx.insert(templateEvents).values({
      templateId: current.id,
      tenantId,
      type: patch.enabled !== current.enabled && eventType === 'updated' ? (patch.enabled ? 'enabled' : 'disabled') : eventType,
      actorId: user.id,
      payload: { revisionNo, note: patch.note ?? null },
    })
  })
  return { revisionNo }
}

export async function getRevision(tenantId: string, templateId: string, revisionNo: number): Promise<TemplateSnapshot> {
  const t = await getTemplate(tenantId, templateId)
  const [row] = await db
    .select({ snapshot: contentTemplateRevisions.snapshot })
    .from(contentTemplateRevisions)
    .where(and(eq(contentTemplateRevisions.templateId, t.id), eq(contentTemplateRevisions.revisionNo, revisionNo)))
    .limit(1)
  if (!row) throw Errors.notFound('Revision')
  return row.snapshot
}

/** Restoring writes the old snapshot as a new revision; history is never rewritten. */
export async function restoreRevision(tenantId: string, templateId: string, revisionNo: number, user: AppUser) {
  const snap = await getRevision(tenantId, templateId, revisionNo)
  return saveTemplate(tenantId, templateId, user, { name: snap.name, enabled: snap.enabled, config: snap.config, note: `Restored revision ${revisionNo}` }, 'restored')
}

/** Soft delete. A template still used by articles can only be disabled. */
export async function deleteTemplate(tenantId: string, templateId: string, user: AppUser) {
  const t = await getTemplate(tenantId, templateId)
  const [{ n }] = await db.select({ n: count() }).from(articles).where(eq(articles.templateId, t.id))
  if (Number(n) > 0) throw Errors.conflict(`“${t.name}” is used by ${n} ${Number(n) === 1 ? 'article' : 'articles'}. Disable it instead, so they keep their template.`)
  await db.transaction(async (tx) => {
    await tx.update(contentTemplates).set({ deletedAt: new Date(), updatedBy: user.id, updatedAt: new Date() }).where(eq(contentTemplates.id, t.id))
    await tx.insert(templateEvents).values({ templateId: t.id, tenantId, type: 'deleted', actorId: user.id, payload: { name: t.name } })
  })
}
