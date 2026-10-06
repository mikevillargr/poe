// "Add sheet" request contract (DR-011), shared by the create and update routes.
import { z } from 'zod'
import { Errors } from '@/lib/api/errors'
import { spreadsheetIdFrom } from '@/lib/google/ids'

export const sheetSourceBody = z.object({
  name: z.string().trim().min(1).max(120),
  /** A Google Sheets link or the bare spreadsheet id. */
  sheet: z.string().trim().min(10).max(500),
  tab: z.string().trim().min(1).max(200),
  headerRow: z.number().int().min(1).max(50).optional(),
  target: z.enum(['topics', 'inventory']),
  templateId: z.string().uuid().nullable().optional(),
  inventorySlug: z.string().trim().max(80).nullable().optional(),
  columnMap: z
    .record(z.string().max(40), z.string().max(200))
    .refine((m) => Object.keys(m).length <= 20)
    .optional(),
})

export function toSourceInput(body: z.infer<typeof sheetSourceBody>) {
  const spreadsheetId = spreadsheetIdFrom(body.sheet)
  if (!spreadsheetId) throw Errors.badRequest('Paste a Google Sheets link (docs.google.com/spreadsheets/d/…) or its id.')
  return { ...body, spreadsheetId }
}
