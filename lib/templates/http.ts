import 'server-only'
import { ApiError, Errors } from '@/lib/api/errors'
import { MAX_IMPORT_BYTES } from '@/lib/import/mapping'
import { parseSheet } from '@/lib/import/parse'
import { SheetsError } from '@/lib/google/sheets'

/** Google Sheets failures as API errors (400 with the Sheets code, or 503 when not connected). */
export function sheetsApiError(err: unknown): never {
  if (err instanceof SheetsError) throw new ApiError(err.code === 'SHEETS_NOT_CONFIGURED' ? 503 : 400, err.code, err.message)
  throw err
}

/** The uploaded CSV/XLSX/XLS in a multipart request, parsed to a grid. */
export async function uploadedGrid(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw Errors.badRequest('Attach a .csv, .xlsx or .xls file.')
  if (file.size > MAX_IMPORT_BYTES) throw Errors.badRequest('The file is larger than 5 MB.')
  try {
    return { form: form!, sheet: parseSheet(Buffer.from(await file.arrayBuffer()), file.name) }
  } catch (err) {
    throw Errors.badRequest(err instanceof Error ? err.message : 'Could not read that file.')
  }
}

export const optionalInt = (v: FormDataEntryValue | null) => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isInteger(n) && n > 0 ? n : undefined
}
