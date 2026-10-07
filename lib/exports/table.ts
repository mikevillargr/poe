import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'

// DR-021: the bulk export sheet (pure): one row per article with its Poe preview link and/or Google Doc.

export interface ExportRow {
  title: string
  status: string
  primaryKeyword: string | null
  keywords: string[]
  words: number
  targetWords: number | null
  score: number | null
  owner: string | null
  poeLink: string | null
  docLink: string | null
  openComments: number
  decision: string | null
  updatedAt: string
}

export interface ExportColumns {
  poeLinks: boolean
  docs: boolean
}

export function headers(c: ExportColumns): string[] {
  return [
    'Title',
    'Status',
    'Primary keyword',
    'Keywords',
    'Words',
    'Target words',
    'Guideline score',
    'Owner',
    ...(c.poeLinks ? ['Poe preview link'] : []),
    ...(c.docs ? ['Google Doc'] : []),
    'Open comments',
    'Client decision',
    'Last updated',
  ]
}

export function cells(r: ExportRow, c: ExportColumns): (string | number)[] {
  return [
    r.title,
    r.status,
    r.primaryKeyword ?? '',
    r.keywords.join(', '),
    r.words,
    r.targetWords ?? '',
    r.score ?? '',
    r.owner ?? '',
    ...(c.poeLinks ? [r.poeLink ?? ''] : []),
    ...(c.docs ? [r.docLink ?? ''] : []),
    r.openComments,
    r.decision ?? '',
    r.updatedAt.slice(0, 10),
  ]
}

/** CSV (RFC 4180), with formula-looking cells defused so spreadsheets don't execute them. */
export function toCsv(rows: ExportRow[], c: ExportColumns): string {
  const esc = (v: string | number) => {
    let s = String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers(c), ...rows.map((r) => cells(r, c))].map((line) => line.map(esc).join(',')).join('\r\n') + '\r\n'
}

export function toXlsx(rows: ExportRow[], c: ExportColumns, sheetName = 'Articles'): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([headers(c), ...rows.map((r) => cells(r, c))])
  // Links are clickable in Excel.
  const h = headers(c)
  for (const col of ['Poe preview link', 'Google Doc']) {
    const ci = h.indexOf(col)
    if (ci < 0) continue
    rows.forEach((r, i) => {
      const url = col === 'Google Doc' ? r.docLink : r.poeLink
      const ref = XLSX.utils.encode_cell({ r: i + 1, c: ci })
      if (url && ws[ref]) ws[ref].l = { Target: url }
    })
  }
  ws['!cols'] = h.map((name) => ({ wch: name === 'Title' ? 48 : /link|Doc/i.test(name) ? 52 : name === 'Keywords' ? 36 : 14 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Identifies a draft's exported content; an unchanged draft reuses its Google Doc. */
export function draftHash(title: string, html: string): string {
  return createHash('sha256').update(title).update('\u0000').update(html).digest('hex')
}

export function exportFilename(clientName: string, ext: string, now = new Date()): string {
  const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'articles'
  return `${slug}-articles-${now.toISOString().slice(0, 10)}.${ext}`
}
