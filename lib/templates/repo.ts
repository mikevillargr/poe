import 'server-only'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleEvents, articles, contentTemplates, linkInventories, linkInventoryItems, tenants, type GenerationMeta } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import { resolveFacts, type ResolvedFacts } from './facts'
import { parseTemplateConfig } from './schema'
import type { TemplateConfig } from './types'

export interface TemplateRow {
  id: string
  tenantId: string
  slug: string
  name: string
  kind: 'faq' | 'blog' | 'page'
  enabled: boolean
  revisionNo: number
  config: TemplateConfig
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toRow(r: typeof contentTemplates.$inferSelect): TemplateRow {
  return { id: r.id, tenantId: r.tenantId, slug: r.slug, name: r.name, kind: r.kind, enabled: r.enabled, revisionNo: r.revisionNo, config: parseTemplateConfig(r.config) }
}

/** The client's (non-deleted) templates, by name. */
export async function listTemplates(tenantId: string) {
  const rows = await db
    .select()
    .from(contentTemplates)
    .where(and(eq(contentTemplates.tenantId, tenantId), isNull(contentTemplates.deletedAt)))
    .orderBy(asc(contentTemplates.name))
  return rows.map(toRow)
}

export async function getTemplate(tenantId: string, templateId: string): Promise<TemplateRow> {
  if (!UUID_RE.test(templateId)) throw Errors.notFound('Template')
  const [row] = await db
    .select()
    .from(contentTemplates)
    .where(and(eq(contentTemplates.id, templateId), eq(contentTemplates.tenantId, tenantId), isNull(contentTemplates.deletedAt)))
    .limit(1)
  if (!row) throw Errors.notFound('Template')
  return toRow(row)
}

export async function getClientFacts(tenantId: string): Promise<ResolvedFacts> {
  const [row] = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  return resolveFacts(row?.settings)
}

export interface InventoryItem {
  url: string
  title: string | null
  attrs: Record<string, string> | null
}

/** Items of one of the client's link inventories, in list order ([] when the inventory doesn't exist). */
export async function inventoryItems(tenantId: string, slug: string): Promise<InventoryItem[]> {
  return db
    .select({ url: linkInventoryItems.url, title: linkInventoryItems.title, attrs: linkInventoryItems.attrs })
    .from(linkInventoryItems)
    .innerJoin(linkInventories, eq(linkInventories.id, linkInventoryItems.inventoryId))
    .where(and(eq(linkInventories.tenantId, tenantId), eq(linkInventories.slug, slug)))
    .orderBy(asc(linkInventoryItems.position), asc(linkInventoryItems.url))
}

/** Hands out the template's next sequence number (UT CTA rotation), atomically. */
export async function nextTemplateSequence(templateId: string): Promise<number> {
  const [row] = await db
    .update(contentTemplates)
    .set({ nextSequence: sql`${contentTemplates.nextSequence} + 1` })
    .where(eq(contentTemplates.id, templateId))
    .returning({ next: contentTemplates.nextSequence })
  return row.next - 1
}

/**
 * Sets (or clears) an article's template and per-row inputs. Rows for a template with the rotating CTA
 * hook get the next `ctaIndex` unless one is given. Template fields stay out of the frozen article patch.
 */
export async function setArticleTemplate(
  tenantId: string,
  articleId: string,
  templateId: string | null,
  inputs: Record<string, string | number | null>,
  user: AppUser,
) {
  let template: TemplateRow | null = null
  const next = { ...inputs }
  if (templateId) {
    template = await getTemplate(tenantId, templateId)
    if (!template.enabled) throw Errors.badRequest(`The “${template.name}” template is disabled.`)
    if (template.config.hooks.some((h) => h.id === 'ut-cta-style') && typeof next.ctaIndex !== 'number') {
      next.ctaIndex = await nextTemplateSequence(template.id)
    }
  }
  const [updated] = await db
    .update(articles)
    .set({ templateId, templateInputs: templateId ? next : null, updatedAt: new Date() })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
    .returning({ id: articles.id, templateId: articles.templateId, templateInputs: articles.templateInputs })
  if (!updated) throw Errors.notFound('Article')
  await db.insert(articleEvents).values({
    articleId,
    tenantId,
    type: 'template_set',
    payload: { templateId, templateName: template?.name ?? null },
    userId: user.id,
  })
  return updated
}

export async function saveGenerationMeta(tenantId: string, articleId: string, meta: GenerationMeta) {
  await db
    .update(articles)
    .set({ generationMeta: meta })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
}
