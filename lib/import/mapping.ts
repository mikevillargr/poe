// Pure, shared (client + server) logic for turning a sheet grid into queue rows (DR-004).
import { splitKeywords } from '@/lib/articles/schemas'

export const IMPORT_FIELDS = ['title', 'brief', 'keywords', 'wordcount'] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

export const FIELD_LABELS: Record<ImportField, string> = {
  title: 'Title',
  brief: 'Brief',
  keywords: 'Keywords',
  wordcount: 'Target word count',
}

export const MAX_IMPORT_ROWS = 1000
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Header aliases seen in real content calendars (normalized: lowercase, alphanumerics only).
const ALIASES: Record<ImportField, string[]> = {
  title: ['title', 'articletitle', 'posttitle', 'blogtitle', 'headline', 'topic', 'articletopic', 'h1', 'name', 'article'],
  brief: ['brief', 'description', 'articledescription', 'contentbrief', 'articlebrief', 'summary', 'notes', 'angle', 'outline', 'details'],
  keywords: ['keywords', 'keyword', 'seokeywords', 'targetkeywords', 'targetkeyword', 'focuskeywords', 'focuskeyword', 'primarykeyword', 'secondarykeywords', 'kw', 'kws', 'tags'],
  wordcount: ['wordcount', 'words', 'targetwordcount', 'targetwords', 'wordlimit', 'length', 'targetlength', 'wc', 'numberofwords', 'wordcounttarget'],
}

export function matchField(header: string): ImportField | null {
  const h = norm(header)
  if (!h) return null
  for (const f of IMPORT_FIELDS) if (ALIASES[f].includes(h)) return f
  // Looser contains-match. "keyword" contains "word", so test it first.
  if (h.includes('keyword')) return 'keywords'
  if (h.includes('word')) return 'wordcount'
  if (h.includes('brief') || h.includes('description')) return 'brief'
  if (h.includes('title') || h.includes('headline')) return 'title'
  return null
}

/** Column index per field (or null), first match wins. */
export type ColumnMapping = Record<ImportField, number | null>

/** Extra header names per field, e.g. a template's own column names ("Product Name" for the title). */
export type ExtraAliases = Partial<Record<ImportField, string[]>>

/** A template's names for the standard fields, from its input definitions (D-002 aliases). */
export function templateAliases(inputs: { key: string; label: string; aliases?: string[] }[] | undefined): ExtraAliases {
  const out: ExtraAliases = {}
  for (const f of inputs ?? []) {
    if ((IMPORT_FIELDS as readonly string[]).includes(f.key)) out[f.key as ImportField] = [f.label, ...(f.aliases ?? [])]
  }
  return out
}

function matchExtra(header: string, extra: ExtraAliases): ImportField | null {
  const h = norm(header)
  if (!h) return null
  for (const f of IMPORT_FIELDS) if (extra[f]?.some((a) => norm(a) === h)) return f
  return null
}

/** Column per field. A template's own names win over the generic aliases, so both import paths agree. */
export function autoMap(headers: string[], extra: ExtraAliases = {}): ColumnMapping {
  const m: ColumnMapping = { title: null, brief: null, keywords: null, wordcount: null }
  headers.forEach((h, i) => {
    const f = matchExtra(h, extra)
    if (f && m[f] === null) m[f] = i
  })
  headers.forEach((h, i) => {
    const f = matchField(h)
    if (f && m[f] === null && !Object.values(m).includes(i)) m[f] = i
  })
  return m
}

/** First row (within the first 10) that looks like a header (contains a title alias); else first non-empty row. */
export function guessHeaderRow(grid: string[][], extra: ExtraAliases = {}): number {
  const limit = Math.min(grid.length, 10)
  for (let r = 0; r < limit; r++) {
    if (grid[r]?.some((c) => matchExtra(String(c ?? ''), extra) === 'title' || matchField(String(c ?? '')) === 'title')) return r
  }
  for (let r = 0; r < limit; r++) {
    if (grid[r]?.some((c) => String(c ?? '').trim())) return r
  }
  return 0
}

/** "1,500" → 1500, "1500 words" → 1500, "1.5k" → 1500, "1200-1500" → 1500 (upper bound). */
export function parseWordCount(raw: string): { value: number | null; error?: string } {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return { value: null }
  const nums = [...s.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/(\d+(?:\.\d+)?)\s*(k)?/g)].map((m) =>
    Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1)),
  )
  if (!nums.length) return { value: null, error: `Word count “${raw}” isn’t a number` }
  const value = Math.max(...nums)
  if (value < 50 || value > 20000) return { value: null, error: `Word count ${value} is outside 50–20,000` }
  return { value }
}

export interface ImportRow {
  /** 1-based row number in the sheet (what the user sees in Excel). */
  sheetRow: number
  title: string
  brief: string | null
  keywords: string[]
  targetWordCount: number | null
  errors: string[]
  duplicate: boolean
}

export function buildRows(
  grid: string[][],
  headerRow: number,
  mapping: ColumnMapping,
  existingTitles: Iterable<string> = [],
): ImportRow[] {
  const existing = new Set([...existingTitles].map((t) => t.trim().toLowerCase()))
  const seen = new Set<string>()
  const cell = (row: string[], i: number | null) => (i === null ? '' : String(row[i] ?? '').trim())
  const out: ImportRow[] = []

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? []
    if (!row.some((c) => String(c ?? '').trim())) continue // skip blank rows

    const errors: string[] = []
    const title = cell(row, mapping.title).replace(/\s+/g, ' ')
    if (!title) errors.push('Missing title')
    else if (title.length > 300) errors.push('Title is longer than 300 characters')

    const brief = cell(row, mapping.brief) || null
    if (brief && brief.length > 10000) errors.push('Brief is longer than 10,000 characters')

    const keywords = splitKeywords(cell(row, mapping.keywords))
    if (keywords.length > 50) errors.push('More than 50 keywords')

    const wc = parseWordCount(cell(row, mapping.wordcount))
    if (wc.error) errors.push(wc.error)

    const key = title.toLowerCase()
    const duplicate = !!title && (existing.has(key) || seen.has(key))
    if (title) seen.add(key)

    out.push({ sheetRow: r + 1, title, brief, keywords, targetWordCount: wc.value, errors, duplicate })
  }
  return out
}
