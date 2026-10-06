import 'server-only'
import { and, asc, count, eq, inArray, isNotNull, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles, contentTemplates, importBatches, linkInventories, linkInventoryItems, sheetSources } from '@/lib/db/schema'
import { appendArticles } from '@/lib/articles/repo'
import { articleInputSchema } from '@/lib/articles/schemas'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import { getServiceAccount } from '@/lib/google/credentials'
import { readSheet } from '@/lib/google/sheets'
import { getTemplate, type TemplateRow as Template } from './repo'
import { buildInventoryItems, buildTemplateRows, type InventoryItemInput, type TemplateRow } from './rows'

// Getting rows into Poe for templates (D-002): topic rows into a client's queue (already set to their
// template) and link-inventory items, from an uploaded file or a Google Sheet source.

export interface ImportSummary {
  added: number
  skipped: Array<{ row: number; title: string; reason: string }>
  dryRun: boolean
  rows?: Array<{ row: number; title: string }>
}

/**
 * Appends rows to the queue in sheet order, each set to `template` with its inputs. Rows with errors, and
 * (for sheet sources) rows already imported from that source, are skipped and reported.
 */
export async function importTemplateRows(
  tenantId: string,
  template: Template,
  rows: TemplateRow[],
  user: AppUser,
  opts: { filename: string; sourceId?: string; dryRun?: boolean },
): Promise<ImportSummary> {
  const skipped: ImportSummary['skipped'] = []
  let candidates = rows
  if (opts.sourceId) {
    const keys = rows.map((r) => `${opts.sourceId}:${r.sheetRow}`)
    const existing = keys.length
      ? await db.select({ key: articles.sourceRowKey }).from(articles).where(and(eq(articles.tenantId, tenantId), inArray(articles.sourceRowKey, keys)))
      : []
    const seen = new Set(existing.map((e) => e.key))
    candidates = rows.filter((r) => {
      if (!seen.has(`${opts.sourceId}:${r.sheetRow}`)) return true
      skipped.push({ row: r.sheetRow, title: r.title, reason: 'Already imported' })
      return false
    })
  }
  const valid: { row: TemplateRow; input: ReturnType<typeof articleInputSchema.parse> }[] = []
  for (const r of candidates) {
    if (r.errors.length) {
      skipped.push({ row: r.sheetRow, title: r.title, reason: r.errors.join('; ') })
      continue
    }
    const parsed = articleInputSchema.safeParse({ title: r.title, brief: r.brief, keywords: r.keywords, targetWordCount: r.targetWordCount })
    if (!parsed.success) skipped.push({ row: r.sheetRow, title: r.title, reason: parsed.error.issues[0]?.message ?? 'Invalid row' })
    else valid.push({ row: r, input: parsed.data })
  }
  if (opts.dryRun || !valid.length) {
    return { added: opts.dryRun ? valid.length : 0, skipped, dryRun: !!opts.dryRun, rows: valid.map((v) => ({ row: v.row.sheetRow, title: v.row.title })) }
  }

  const needsCta = template.config.hooks.some((h) => h.id === 'ut-cta-style')
  const [batch] = await db
    .insert(importBatches)
    .values({ tenantId, filename: opts.filename, rowCount: valid.length, errors: skipped.map((s) => ({ row: s.row, message: s.reason })), createdBy: user.id })
    .returning()
  const created = await appendArticles(tenantId, valid.map((v) => v.input), user, { importBatchId: batch.id })
  await db.transaction(async (tx) => {
    let sequence = 0
    if (needsCta) {
      // Reserve one CTA index per row, in sheet order.
      const [row] = await tx
        .update(contentTemplates)
        .set({ nextSequence: sql`${contentTemplates.nextSequence} + ${created.length}` })
        .where(eq(contentTemplates.id, template.id))
        .returning({ next: contentTemplates.nextSequence })
      sequence = row.next - created.length
    }
    for (const [i, article] of created.entries()) {
      const r = valid[i].row
      await tx
        .update(articles)
        .set({
          templateId: template.id,
          templateInputs: { ...r.inputs, ...(needsCta ? { ctaIndex: sequence + i } : {}) },
          sourceRowKey: opts.sourceId ? `${opts.sourceId}:${r.sheetRow}` : null,
        })
        .where(eq(articles.id, article.id))
    }
  })
  return { added: created.length, skipped, dryRun: false, rows: valid.map((v) => ({ row: v.row.sheetRow, title: v.row.title })) }
}

/** Replaces an inventory's items (the sheet or file is the source of truth for its list). */
export async function replaceInventory(tenantId: string, slug: string, items: InventoryItemInput[], source: 'upload' | 'sheet') {
  const [inv] = await db.select().from(linkInventories).where(and(eq(linkInventories.tenantId, tenantId), eq(linkInventories.slug, slug))).limit(1)
  if (!inv) throw Errors.notFound('Link inventory')
  await db.transaction(async (tx) => {
    await tx.delete(linkInventoryItems).where(eq(linkInventoryItems.inventoryId, inv.id))
    if (items.length) {
      for (let i = 0; i < items.length; i += 500) {
        await tx.insert(linkInventoryItems).values(items.slice(i, i + 500).map((it, j) => ({ inventoryId: inv.id, url: it.url, title: it.title, attrs: it.attrs, position: i + j })))
      }
    }
    await tx.update(linkInventories).set({ source, lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(linkInventories.id, inv.id))
  })
  return { inventory: slug, items: items.length }
}

export async function listInventories(tenantId: string) {
  const rows = await db
    .select({
      slug: linkInventories.slug,
      name: linkInventories.name,
      kind: linkInventories.kind,
      source: linkInventories.source,
      lastSyncedAt: linkInventories.lastSyncedAt,
      items: count(linkInventoryItems.id),
    })
    .from(linkInventories)
    .leftJoin(linkInventoryItems, eq(linkInventoryItems.inventoryId, linkInventories.id))
    .where(eq(linkInventories.tenantId, tenantId))
    .groupBy(linkInventories.id)
    .orderBy(asc(linkInventories.name))
  return rows.map((r) => ({ ...r, items: Number(r.items), lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null }))
}

export async function listSheetSources(tenantId: string) {
  const rows = await db
    .select({
      id: sheetSources.id,
      name: sheetSources.name,
      spreadsheetId: sheetSources.spreadsheetId,
      tab: sheetSources.tab,
      range: sheetSources.range,
      headerRow: sheetSources.headerRow,
      columnMap: sheetSources.columnMap,
      target: sheetSources.target,
      templateId: sheetSources.templateId,
      templateName: contentTemplates.name,
      inventoryId: sheetSources.inventoryId,
      inventorySlug: linkInventories.slug,
      inventoryName: linkInventories.name,
      createdBy: sheetSources.createdBy,
      lastSyncedAt: sheetSources.lastSyncedAt,
      lastSyncResult: sheetSources.lastSyncResult,
    })
    .from(sheetSources)
    .leftJoin(contentTemplates, eq(contentTemplates.id, sheetSources.templateId))
    .leftJoin(linkInventories, eq(linkInventories.id, sheetSources.inventoryId))
    .where(eq(sheetSources.tenantId, tenantId))
    .orderBy(asc(sheetSources.name))
  // Sources seeded from the n8n register have no creator; added ones do.
  return rows.map(({ createdBy, ...r }) => ({ ...r, seeded: !createdBy, lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null }))
}

export interface SheetSourceInput {
  name: string
  spreadsheetId: string
  tab: string
  headerRow?: number
  target: 'topics' | 'inventory'
  templateId?: string | null
  inventorySlug?: string | null
  columnMap?: Record<string, string>
}

async function resolveTarget(tenantId: string, input: Pick<SheetSourceInput, 'target' | 'templateId' | 'inventorySlug'>) {
  if (input.target === 'topics') {
    if (!input.templateId) throw Errors.badRequest('Choose the template these rows are for.')
    await getTemplate(tenantId, input.templateId)
    return { templateId: input.templateId, inventoryId: null }
  }
  if (!input.inventorySlug) throw Errors.badRequest('Choose the link list this sheet fills.')
  const [inv] = await db
    .select({ id: linkInventories.id })
    .from(linkInventories)
    .where(and(eq(linkInventories.tenantId, tenantId), eq(linkInventories.slug, input.inventorySlug)))
    .limit(1)
  if (!inv) throw Errors.notFound('Link list')
  return { templateId: null, inventoryId: inv.id }
}

export async function createSheetSource(tenantId: string, input: SheetSourceInput, user: AppUser) {
  const target = await resolveTarget(tenantId, input)
  const [row] = await db
    .insert(sheetSources)
    .values({
      tenantId,
      name: input.name,
      spreadsheetId: input.spreadsheetId,
      tab: input.tab,
      headerRow: input.headerRow ?? 1,
      columnMap: input.columnMap ?? {},
      target: input.target,
      ...target,
      createdBy: user.id,
    })
    .returning({ id: sheetSources.id })
  return row
}

export async function updateSheetSource(tenantId: string, id: string, input: SheetSourceInput) {
  const target = await resolveTarget(tenantId, input)
  const [row] = await db
    .update(sheetSources)
    .set({
      name: input.name,
      spreadsheetId: input.spreadsheetId,
      tab: input.tab,
      headerRow: input.headerRow ?? 1,
      columnMap: input.columnMap ?? {},
      target: input.target,
      ...target,
      updatedAt: new Date(),
    })
    .where(and(eq(sheetSources.id, id), eq(sheetSources.tenantId, tenantId)))
    .returning({ id: sheetSources.id })
  if (!row) throw Errors.notFound('Sheet source')
  return row
}

/** Removes the source only; articles and links it already brought in stay. */
export async function deleteSheetSource(tenantId: string, id: string) {
  const [row] = await db
    .delete(sheetSources)
    .where(and(eq(sheetSources.id, id), eq(sheetSources.tenantId, tenantId)))
    .returning({ id: sheetSources.id })
  if (!row) throw Errors.notFound('Sheet source')
}

/** Highest sheet row already imported from a source (for "continue where we left off"). */
async function lastImportedRow(tenantId: string, sourceId: string): Promise<number | null> {
  const rows = await db
    .select({ key: articles.sourceRowKey })
    .from(articles)
    .where(and(eq(articles.tenantId, tenantId), isNotNull(articles.sourceRowKey), like(articles.sourceRowKey, `${sourceId}:%`)))
  const nums = rows.map((r) => Number(r.key!.split(':')[1])).filter(Number.isFinite)
  return nums.length ? Math.max(...nums) : null
}

/**
 * Reads a Google Sheet source and imports it. Topic sources add new rows to the queue: from `fromRow`
 * (default: after the last row imported from this source; required on a first sync, so a sheet with
 * years of rows already written in n8n isn't queued wholesale) up to `toRow`. Inventory sources replace
 * the inventory's items.
 */
export async function syncSheetSource(
  tenantId: string,
  sourceId: string,
  user: AppUser,
  opts: { fromRow?: number; toRow?: number; dryRun?: boolean } = {},
) {
  const [src] = await db.select().from(sheetSources).where(and(eq(sheetSources.id, sourceId), eq(sheetSources.tenantId, tenantId))).limit(1)
  if (!src) throw Errors.notFound('Sheet source')
  // Check the row range before calling Google, so a first sync without fromRow fails fast.
  let fromRow: number | null = null
  if (src.target === 'topics') {
    const last = await lastImportedRow(tenantId, src.id)
    fromRow = opts.fromRow ?? (last !== null ? last + 1 : null)
    if (fromRow === null) {
      throw Errors.badRequest('First sync of this sheet: choose the first row to import (fromRow), so rows already written in n8n aren’t queued again.')
    }
  }
  const grid = await readSheet(await getServiceAccount(), src.spreadsheetId, src.tab, src.range)
  const columnMap = src.columnMap ?? {}
  const urlPrefix = columnMap.urlPrefix
  const map = Object.fromEntries(Object.entries(columnMap).filter(([k]) => k !== 'urlPrefix'))

  let result: Record<string, unknown>
  if (src.target === 'inventory') {
    if (!src.inventoryId) throw Errors.badRequest('This sheet source has no inventory.')
    const [inv] = await db.select({ slug: linkInventories.slug }).from(linkInventories).where(eq(linkInventories.id, src.inventoryId)).limit(1)
    const items = buildInventoryItems(grid, { columnMap: map, headerRow: src.headerRow, urlPrefix })
    result = opts.dryRun ? { inventory: inv.slug, items: items.length, dryRun: true, sample: items.slice(0, 5) } : await replaceInventory(tenantId, inv.slug, items, 'sheet')
  } else {
    if (!src.templateId) throw Errors.badRequest('This sheet source has no template.')
    const template = await getTemplate(tenantId, src.templateId)
    const rows = buildTemplateRows(grid, template.config, { columnMap: map, headerRow: src.headerRow }).filter(
      (r) => r.sheetRow >= fromRow! && (!opts.toRow || r.sheetRow <= opts.toRow),
    )
    result = { fromRow, ...(await importTemplateRows(tenantId, template, rows, user, { filename: `${src.name} (Google Sheet)`, sourceId: src.id, dryRun: opts.dryRun })) }
  }
  if (!opts.dryRun) {
    const added = Number((result as { added?: number; items?: number }).added ?? (result as { items?: number }).items ?? 0)
    const skipped = ((result as { skipped?: { row: number; reason: string }[] }).skipped ?? []).map((s) => ({ row: s.row, message: s.reason }))
    await db
      .update(sheetSources)
      .set({ lastSyncedAt: new Date(), lastSyncResult: { at: new Date().toISOString(), added, skipped: skipped.length, errors: skipped.slice(0, 50) }, updatedAt: new Date() })
      .where(eq(sheetSources.id, src.id))
  }
  return { source: src.name, target: src.target, ...result }
}
