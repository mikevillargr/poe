// Seeds the n8n clients, templates, link inventories, client facts and imported guidelines (D-002).
//   npx tsx scripts/db/seed-n8n.ts [--dry-run] [--only=slug,slug] [--update-templates]
//   prod: docker compose --profile tools run --rm migrate node dist/seed-n8n.cjs --dry-run
// Uses DATABASE_URL from .env.local or the environment. Idempotent:
// - a missing client is created, like "Add client" (it follows the live Universal rules, D-003);
// - templates are added by slug; an existing one is left alone unless --update-templates, which saves
//   the seed config as a new revision when it differs;
// - inventories (empty) are added by slug; facts only fill keys the client doesn't have yet;
// - Google Sheet sources from the doc's register are added (matched by sheet, tab, target and template /
//   inventory); syncing them is a separate, explicit step;
// - a doc guideline is skipped when the client already has the same rule text. For clients that
//   already had their own rules (NCH's legacy rules), a doc rule that looks like one of them is added
//   **inactive**, titled "… (possible duplicate of: <existing title>)". Nothing is ever deleted.
// Agents never run this against production — Mike does (dry run first).
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, asc, eq, isNull, max } from 'drizzle-orm'
import pg from 'pg'
import * as schema from '../../lib/db/schema'
import { CLIENT_GUIDELINE_SETS } from '../../lib/templates/seed/guidelines'
import { CLIENT_TEMPLATE_SETS } from '../../lib/templates/seed/templates'
import { CLIENT_SHEET_SOURCES } from '../../lib/templates/seed/sheet-sources'
import { closestOverlap } from '../../lib/guidelines/overlap'
import type { TemplateFacts } from '../../lib/templates/facts'
import { requireDatabaseUrl, redact } from './env'

const FACTS: Record<string, TemplateFacts> = {
  'the-watch-store-ph': { productPageHosts: ['thewatchstore.ph', 'www.thewatchstore.ph'] },
}

type Db = ReturnType<typeof drizzle<typeof schema>>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const flag = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const url = requireDatabaseUrl()
  const dryRun = flag('dry-run')
  const updateTemplates = flag('update-templates')
  const only = arg('only')?.split(',').map((s) => s.trim())
  const pool = new pg.Pool({ connectionString: url })
  const db = drizzle(pool, { schema })
  console.log(`${dryRun ? 'DRY RUN — nothing is written. ' : ''}Seeding n8n templates into ${redact(url)}\n`)

  try {
    for (const set of CLIENT_GUIDELINE_SETS) {
      if (only && !only.includes(set.slug)) continue
      const tpl = CLIENT_TEMPLATE_SETS[set.slug]
      const log: string[] = []
      const run = async (tx: Tx) => {
        // Client
        let [tenant] = await tx.select().from(schema.tenants).where(eq(schema.tenants.slug, set.slug)).limit(1)
        if (!tenant) {
          log.push(`create client "${set.name}" (follows the live Universal rules)`)
          if (!dryRun) tenant = await createClient(tx, set.name, set.slug, set.website)
        } else if (!tenant.website && set.website) {
          log.push(`set website ${set.website}`)
          if (!dryRun) await tx.update(schema.tenants).set({ website: set.website, updatedAt: new Date() }).where(eq(schema.tenants.id, tenant.id))
        }
        const tenantId = tenant?.id

        // Facts (only keys the client doesn't have)
        const settings = (tenant?.settings ?? {}) as Record<string, unknown>
        const facts = { ...((settings.templateFacts as TemplateFacts | undefined) ?? {}) }
        const added = Object.entries(FACTS[set.slug] ?? {}).filter(([k]) => !(k in facts))
        if (added.length) {
          log.push(`facts: ${added.map(([k]) => k).join(', ')}`)
          for (const [k, v] of added) (facts as Record<string, unknown>)[k] = v
          if (!dryRun && tenantId) {
            await tx.update(schema.tenants).set({ settings: { ...settings, templateFacts: facts } }).where(eq(schema.tenants.id, tenantId))
          }
        }

        // Inventories
        const invRows = tenantId ? await tx.select().from(schema.linkInventories).where(eq(schema.linkInventories.tenantId, tenantId)) : []
        for (const inv of tpl.inventories) {
          if (invRows.some((r) => r.slug === inv.slug)) continue
          log.push(`inventory "${inv.name}" (${inv.slug})`)
          if (!dryRun && tenantId) await tx.insert(schema.linkInventories).values({ tenantId, slug: inv.slug, name: inv.name, kind: inv.kind, source: 'upload' })
        }

        // Templates
        const templateIds = new Map<string, string>()
        for (const t of tpl.templates) {
          const [existing] = tenantId
            ? await tx
                .select()
                .from(schema.contentTemplates)
                .where(and(eq(schema.contentTemplates.tenantId, tenantId), eq(schema.contentTemplates.slug, t.slug), isNull(schema.contentTemplates.deletedAt)))
                .limit(1)
            : []
          const snapshot = { name: t.name, slug: t.slug, kind: t.kind, enabled: true, config: t.config }
          if (!existing) {
            log.push(`template "${t.name}" (${t.slug})`)
            if (!dryRun && tenantId) {
              const [row] = await tx.insert(schema.contentTemplates).values({ tenantId, slug: t.slug, name: t.name, kind: t.kind, config: t.config }).returning()
              await tx.insert(schema.contentTemplateRevisions).values({ templateId: row.id, revisionNo: 1, snapshot, note: 'Imported from the n8n workflows (D-002)' })
              await tx.insert(schema.templateEvents).values({ templateId: row.id, tenantId, type: 'created', payload: { source: 'n8n seed' } })
              templateIds.set(t.slug, row.id)
            }
            continue
          }
          templateIds.set(t.slug, existing.id)
          if (updateTemplates && JSON.stringify(existing.config) !== JSON.stringify(t.config)) {
            const revisionNo = existing.revisionNo + 1
            log.push(`template "${t.name}": new revision ${revisionNo} from the seed`)
            if (!dryRun) {
              await tx.update(schema.contentTemplates).set({ config: t.config, revisionNo, updatedAt: new Date() }).where(eq(schema.contentTemplates.id, existing.id))
              await tx.insert(schema.contentTemplateRevisions).values({ templateId: existing.id, revisionNo, snapshot: { ...snapshot, name: existing.name, enabled: existing.enabled }, note: 'Updated from the n8n seed' })
              await tx.insert(schema.templateEvents).values({ templateId: existing.id, tenantId: tenantId!, type: 'updated', payload: { source: 'n8n seed', revisionNo } })
            }
          }
        }

        // Google Sheet sources
        const invIds = new Map(
          (tenantId ? await tx.select().from(schema.linkInventories).where(eq(schema.linkInventories.tenantId, tenantId)) : []).map((r) => [r.slug, r.id]),
        )
        const existingSources = tenantId ? await tx.select().from(schema.sheetSources).where(eq(schema.sheetSources.tenantId, tenantId)) : []
        for (const src of CLIENT_SHEET_SOURCES[set.slug] ?? []) {
          const templateId = src.template ? (templateIds.get(src.template) ?? null) : null
          const inventoryId = src.inventory ? (invIds.get(src.inventory) ?? null) : null
          const exists = existingSources.some(
            (e) => e.spreadsheetId === src.spreadsheetId && e.tab === src.tab && e.target === src.target && e.templateId === templateId && e.inventoryId === inventoryId,
          )
          if (exists) continue
          log.push(`sheet source "${src.name}" (${src.target}${src.template ? ` → ${src.template}` : ''}${src.inventory ? ` → ${src.inventory}` : ''})`)
          if (dryRun || !tenantId) continue
          if ((src.template && !templateId) || (src.inventory && !inventoryId)) throw new Error(`${set.slug}: target missing for sheet source "${src.name}"`)
          await tx.insert(schema.sheetSources).values({
            tenantId,
            name: src.name,
            spreadsheetId: src.spreadsheetId,
            tab: src.tab,
            range: src.range ?? null,
            headerRow: src.headerRow ?? 1,
            columnMap: src.columnMap,
            target: src.target,
            templateId,
            inventoryId,
          })
        }

        // Guidelines
        const existingRules = tenantId ? await tx.select().from(schema.heuristics).where(eq(schema.heuristics.tenantId, tenantId)) : []
        const ownRules = existingRules.filter((r) => r.source !== 'template_copy')
        const sortBase = new Map<string, number>()
        let addedRules = 0
        let flagged = 0
        for (const g of set.guidelines) {
          if (existingRules.some((r) => r.rule.trim() === g.rule.trim())) continue
          const match = closestOverlap({ title: g.title, rule: g.rule }, ownRules)
          const title = match ? `${g.title} (possible duplicate of: ${match.existing.title ?? match.existing.rule.slice(0, 40)})`.slice(0, 120) : g.title
          if (match) {
            flagged++
            log.push(`  inactive, overlaps "${match.existing.title ?? match.existing.rule.slice(0, 50)}" (${match.score.toFixed(2)}): ${g.title}`)
          }
          addedRules++
          if (dryRun || !tenantId) continue
          const contentTemplateId = g.template ? templateIds.get(g.template) : null
          if (g.template && !contentTemplateId) throw new Error(`${set.slug}: template ${g.template} missing for rule "${g.title}"`)
          if (!sortBase.has(g.category)) {
            const [m] = await tx.select({ m: max(schema.heuristics.sortOrder) }).from(schema.heuristics).where(and(eq(schema.heuristics.tenantId, tenantId), eq(schema.heuristics.category, g.category)))
            sortBase.set(g.category, m?.m ?? 0)
          }
          const sortOrder = sortBase.get(g.category)! + 1024
          sortBase.set(g.category, sortOrder)
          await tx.insert(schema.heuristics).values({
            tenantId,
            category: g.category,
            title,
            rule: g.rule,
            weight: g.weight,
            active: !match,
            source: 'ingested',
            contentTemplateId: contentTemplateId ?? null,
            sortOrder,
          })
        }
        if (addedRules) log.push(`guidelines: ${addedRules} added${flagged ? ` (${flagged} inactive as possible duplicates)` : ''}`)
      }

      if (dryRun) await run(db as unknown as Tx)
      else await db.transaction(run)
      console.log(`${set.name} (${set.slug})`)
      console.log(log.length ? log.map((l) => `  ${l}`).join('\n') : '  up to date')
    }
  } finally {
    await pool.end()
  }
}

async function createClient(tx: Tx, name: string, slug: string, website?: string) {
  const [client] = await tx
    .insert(schema.tenants)
    .values({ name, slug, website: website ?? null, notes: 'Created by the n8n template seed (D-002).' })
    .returning()
  // D-003: no Universal copy; every client follows the live Universal rules.
  return client
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
