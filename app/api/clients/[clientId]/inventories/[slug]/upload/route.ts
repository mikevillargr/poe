import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { replaceInventory } from '@/lib/templates/inputs'
import { buildInventoryItems } from '@/lib/templates/rows'
import { optionalInt, uploadedGrid } from '@/lib/templates/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const columnMapSchema = z.record(z.string().max(40), z.string().max(200)).refine((m) => Object.keys(m).length <= 20)

// POST multipart { file, columnMap? (JSON: { url, title, city… }), headerRow?, urlPrefix?, dryRun? }
// → { inventory, items } — replaces the inventory's links with the file's (D-002).
export const POST = withRoute<{ clientId: string; slug: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { form, sheet } = await uploadedGrid(req)
  let columnMap: Record<string, string> = {}
  const rawMap = form.get('columnMap')
  if (typeof rawMap === 'string' && rawMap.trim()) {
    try {
      columnMap = columnMapSchema.parse(JSON.parse(rawMap))
    } catch {
      throw Errors.badRequest('columnMap must be a JSON object of field → column.')
    }
  }
  const urlPrefix = String(form.get('urlPrefix') ?? '').trim() || undefined
  if (urlPrefix && !/^https:\/\//.test(urlPrefix)) throw Errors.badRequest('urlPrefix must start with https://')
  const items = buildInventoryItems(sheet.grid, { columnMap, headerRow: optionalInt(form.get('headerRow')), urlPrefix })
  if (!items.length) throw Errors.badRequest('No links found: the file needs a column of URLs (or slugs with a URL prefix).')
  if (form.get('dryRun') === 'true') return json({ inventory: params.slug, items: items.length, dryRun: true, sample: items.slice(0, 10) })
  return json(await replaceInventory(client.id, params.slug, items, 'upload'))
})
