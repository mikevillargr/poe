import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getTemplate } from '@/lib/templates/repo'
import { importTemplateRows } from '@/lib/templates/inputs'
import { buildTemplateRows } from '@/lib/templates/rows'
import { optionalInt, uploadedGrid } from '@/lib/templates/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST multipart { file, headerRow?, fromRow?, toRow?, dryRun? } → { added, skipped[], rows[] }
// Imports a topic sheet straight into the queue as articles set to this template, columns matched by the
// template's input names (e.g. Title / Prompt / SEO Keywords / Number of Words, or Product Name) (D-002).
export const POST = withRoute<{ clientId: string; templateId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const template = await getTemplate(client.id, params.templateId)
  const { form, sheet } = await uploadedGrid(req)
  const fromRow = optionalInt(form.get('fromRow'))
  const toRow = optionalInt(form.get('toRow'))
  const rows = buildTemplateRows(sheet.grid, template.config, { headerRow: optionalInt(form.get('headerRow')) }).filter(
    (r) => (!fromRow || r.sheetRow >= fromRow) && (!toRow || r.sheetRow <= toRow),
  )
  const result = await importTemplateRows(client.id, template, rows, user, { filename: sheet.filename, dryRun: form.get('dryRun') === 'true' })
  return json(result, { status: result.dryRun ? 200 : 201 })
})
