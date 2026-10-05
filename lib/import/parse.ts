import 'server-only'
import * as XLSX from 'xlsx'
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from './mapping'

export interface ParsedSheet {
  filename: string
  sheetName: string
  grid: string[][]
  truncated: boolean
}

const ALLOWED = /\.(csv|xlsx|xls)$/i

/**
 * Reads the first sheet of a CSV/XLSX/XLS file into a grid of display strings.
 * No formulas or HTML are evaluated; at most MAX_IMPORT_ROWS (+ header slack) rows are read.
 */
export function parseSheet(buffer: Buffer, filename: string): ParsedSheet {
  if (!ALLOWED.test(filename)) throw new Error('Upload a .csv, .xlsx or .xls file.')
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error('The file is larger than 5 MB.')
  if (buffer.byteLength === 0) throw new Error('The file is empty.')

  const sheetRowLimit = MAX_IMPORT_ROWS + 20
  const wb = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    sheetRows: sheetRowLimit + 1,
    raw: false,
  })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) throw new Error('The file has no sheets.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: true })

  const grid = rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []))
  // Trim trailing empty rows.
  while (grid.length && !grid[grid.length - 1].some(Boolean)) grid.pop()
  const truncated = grid.length > sheetRowLimit
  return { filename, sheetName, grid: grid.slice(0, sheetRowLimit), truncated }
}
