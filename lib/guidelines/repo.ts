import 'server-only'
import { and, asc, eq, inArray, max } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientUniversalOverrides, contentTemplates, heuristics, universalGuidelines } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import { categoryRank } from './categories'
import type { GuidelineInput, GuidelineUpdate } from './schemas'

export type Guideline = typeof heuristics.$inferSelect
export type UniversalGuideline = typeof universalGuidelines.$inferSelect

const GAP = 1024
const UUID_RE = /^[0-9a-f-]{36}$/i

function byCategoryThenOrder<T extends { category: string; sortOrder: number }>(a: T, b: T) {
  return (
    categoryRank(a.category.trim().toLowerCase()) - categoryRank(b.category.trim().toLowerCase()) ||
    a.sortOrder - b.sortOrder
  )
}

async function nextSortOrder(tenantId: string, category: string): Promise<number> {
  const [row] = await db
    .select({ p: max(heuristics.sortOrder) })
    .from(heuristics)
    .where(and(eq(heuristics.tenantId, tenantId), eq(heuristics.category, category)))
  return (row?.p ?? 0) + GAP
}

export async function listGuidelines(tenantId: string): Promise<Guideline[]> {
  const rows = await db
    .select()
    .from(heuristics)
    .where(eq(heuristics.tenantId, tenantId))
    .orderBy(asc(heuristics.sortOrder))
  // category is free text, so the canonical category order is applied in JS.
  return rows.sort(byCategoryThenOrder)
}

/** A content-template scope must be one of this client's templates. */
async function checkTemplateScope(tenantId: string, contentTemplateId: string | null | undefined) {
  if (!contentTemplateId) return
  const [t] = await db
    .select({ id: contentTemplates.id })
    .from(contentTemplates)
    .where(and(eq(contentTemplates.id, contentTemplateId), eq(contentTemplates.tenantId, tenantId)))
    .limit(1)
  if (!t) throw Errors.badRequest('That template doesn’t belong to this client.')
}

export async function createGuideline(tenantId: string, input: GuidelineInput, userId: string): Promise<Guideline> {
  await checkTemplateScope(tenantId, input.contentTemplateId)
  const sortOrder = await nextSortOrder(tenantId, input.category)
  const [row] = await db
    .insert(heuristics)
    .values({
      tenantId,
      category: input.category,
      title: input.title ?? null,
      rule: input.rule,
      weight: input.weight,
      active: input.active,
      source: input.source,
      contentTemplateId: input.contentTemplateId ?? null,
      sortOrder,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()
  return row
}

export async function updateGuideline(
  tenantId: string,
  id: string,
  patch: GuidelineUpdate,
  userId: string,
): Promise<Guideline> {
  if (!UUID_RE.test(id)) throw Errors.notFound('Guideline')
  const [current] = await db
    .select()
    .from(heuristics)
    .where(and(eq(heuristics.id, id), eq(heuristics.tenantId, tenantId)))
    .limit(1)
  if (!current) throw Errors.notFound('Guideline')

  const set: Partial<typeof heuristics.$inferInsert> = { updatedAt: new Date(), updatedBy: userId }
  if (patch.title !== undefined) set.title = patch.title
  if (patch.rule !== undefined) set.rule = patch.rule
  if (patch.weight !== undefined) set.weight = patch.weight
  if (patch.active !== undefined) set.active = patch.active
  if (patch.contentTemplateId !== undefined) {
    await checkTemplateScope(tenantId, patch.contentTemplateId)
    set.contentTemplateId = patch.contentTemplateId
  }
  if (patch.category !== undefined && patch.category !== current.category) {
    set.category = patch.category
    set.sortOrder = await nextSortOrder(tenantId, patch.category) // move to the end of the new category
  }

  const [row] = await db.update(heuristics).set(set).where(eq(heuristics.id, id)).returning()
  return row
}

export async function deleteGuideline(tenantId: string, id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw Errors.notFound('Guideline')
  const res = await db
    .delete(heuristics)
    .where(and(eq(heuristics.id, id), eq(heuristics.tenantId, tenantId)))
    .returning({ id: heuristics.id })
  if (!res.length) throw Errors.notFound('Guideline')
}

export async function setGuidelineActive(tenantId: string, id: string, active: boolean, userId: string) {
  return updateGuideline(tenantId, id, { active }, userId)
}

export async function reorderGuidelines(tenantId: string, category: string, orderedIds: string[]): Promise<void> {
  const key = category.trim().toLowerCase()
  const rows = await db
    .select({ id: heuristics.id, category: heuristics.category })
    .from(heuristics)
    .where(and(eq(heuristics.tenantId, tenantId), inArray(heuristics.id, orderedIds)))
  if (rows.length !== orderedIds.length || rows.some((r) => r.category.trim().toLowerCase() !== key)) {
    throw Errors.badRequest('Every id must belong to this client and this category.')
  }
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(heuristics)
        .set({ sortOrder: (i + 1) * GAP, updatedAt: new Date() })
        .where(and(eq(heuristics.id, id), eq(heuristics.tenantId, tenantId)))
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Universal template (agency-level; super admin only — enforced by the routes)
// ---------------------------------------------------------------------------------------------

async function nextUniversalSortOrder(category: string): Promise<number> {
  const [row] = await db
    .select({ p: max(universalGuidelines.sortOrder) })
    .from(universalGuidelines)
    .where(eq(universalGuidelines.category, category))
  return (row?.p ?? 0) + GAP
}

export async function listUniversalGuidelines(): Promise<UniversalGuideline[]> {
  const rows = await db.select().from(universalGuidelines).orderBy(asc(universalGuidelines.sortOrder))
  return rows.sort(byCategoryThenOrder)
}

export async function createUniversalGuideline(input: GuidelineInput, userId: string): Promise<UniversalGuideline> {
  const sortOrder = await nextUniversalSortOrder(input.category)
  const [row] = await db
    .insert(universalGuidelines)
    .values({
      category: input.category,
      title: input.title ?? null,
      rule: input.rule,
      weight: input.weight,
      active: input.active,
      sortOrder,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()
  return row
}

export async function updateUniversalGuideline(
  id: string,
  patch: GuidelineUpdate,
  userId: string,
): Promise<UniversalGuideline> {
  if (!UUID_RE.test(id)) throw Errors.notFound('Guideline')
  const [current] = await db.select().from(universalGuidelines).where(eq(universalGuidelines.id, id)).limit(1)
  if (!current) throw Errors.notFound('Guideline')

  const set: Partial<typeof universalGuidelines.$inferInsert> = { updatedAt: new Date(), updatedBy: userId }
  if (patch.title !== undefined) set.title = patch.title
  if (patch.rule !== undefined) set.rule = patch.rule
  if (patch.weight !== undefined) set.weight = patch.weight
  if (patch.active !== undefined) set.active = patch.active
  if (patch.category !== undefined && patch.category !== current.category) {
    set.category = patch.category
    set.sortOrder = await nextUniversalSortOrder(patch.category)
  }

  const [row] = await db.update(universalGuidelines).set(set).where(eq(universalGuidelines.id, id)).returning()
  return row
}

export async function deleteUniversalGuideline(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw Errors.notFound('Guideline')
  const res = await db.delete(universalGuidelines).where(eq(universalGuidelines.id, id)).returning({ id: universalGuidelines.id })
  if (!res.length) throw Errors.notFound('Guideline')
}

export async function reorderUniversalGuidelines(category: string, orderedIds: string[]): Promise<void> {
  const key = category.trim().toLowerCase()
  const rows = await db
    .select({ id: universalGuidelines.id, category: universalGuidelines.category })
    .from(universalGuidelines)
    .where(inArray(universalGuidelines.id, orderedIds))
  if (rows.length !== orderedIds.length || rows.some((r) => r.category.trim().toLowerCase() !== key)) {
    throw Errors.badRequest('Every id must belong to this category.')
  }
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(universalGuidelines)
        .set({ sortOrder: (i + 1) * GAP, updatedAt: new Date() })
        .where(eq(universalGuidelines.id, id))
    }
  })
}

// D-003: the Universal rules a client inherits, each with this client's switch. `onForClient` is false when the
// client switched it off; a rule that is off on the Universal page is off for everyone regardless.
export async function listUniversalForClient(tenantId: string): Promise<(UniversalGuideline & { onForClient: boolean })[]> {
  const rows = await db
    .select({ g: universalGuidelines, override: clientUniversalOverrides.active })
    .from(universalGuidelines)
    .leftJoin(
      clientUniversalOverrides,
      and(eq(clientUniversalOverrides.universalGuidelineId, universalGuidelines.id), eq(clientUniversalOverrides.tenantId, tenantId)),
    )
    .orderBy(asc(universalGuidelines.sortOrder))
  return rows.map((r) => ({ ...r.g, onForClient: r.override ?? true })).sort(byCategoryThenOrder)
}

export async function setUniversalForClient(tenantId: string, universalGuidelineId: string, on: boolean, userId: string) {
  const [exists] = await db.select({ id: universalGuidelines.id }).from(universalGuidelines).where(eq(universalGuidelines.id, universalGuidelineId)).limit(1)
  if (!exists) throw Errors.notFound('Universal guideline')
  if (on) {
    // On is the default, so no row is needed.
    await db
      .delete(clientUniversalOverrides)
      .where(and(eq(clientUniversalOverrides.tenantId, tenantId), eq(clientUniversalOverrides.universalGuidelineId, universalGuidelineId)))
  } else {
    await db
      .insert(clientUniversalOverrides)
      .values({ tenantId, universalGuidelineId, active: false, updatedBy: userId })
      .onConflictDoUpdate({
        target: [clientUniversalOverrides.tenantId, clientUniversalOverrides.universalGuidelineId],
        set: { active: false, updatedBy: userId, updatedAt: new Date() },
      })
  }
}
