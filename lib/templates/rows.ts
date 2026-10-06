// Sheet grid → templated queue rows or link-inventory items (pure; used by file upload and Google Sheet
// sync). Columns are found by an explicit column map (header name, column letter, or "A|B" alternatives,
// first non-empty wins) or else by the template's input aliases.

import { splitKeywords } from '@/lib/articles/schemas'
import { matchField, parseWordCount } from '@/lib/import/mapping'
import { extractUrls, urlKey } from './selector'
import { tribePageRows } from './hooks/tribe-page'
import type { TemplateConfig } from './types'

export const ARTICLE_FIELDS = ['title', 'brief', 'keywords', 'wordcount'] as const

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Column letters ("A", "AB") → 0-based index. */
function letterIndex(spec: string): number | null {
  if (!/^[A-Z]{1,2}$/.test(spec)) return null
  return [...spec].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1
}

/** Column indexes for a map value: "Item URL", "B", or "URL|url|Product URL|Slug" (all that exist, in order). */
export function resolveColumns(spec: string, headers: string[]): number[] {
  const out: number[] = []
  for (const part of spec.split('|').map((p) => p.trim()).filter(Boolean)) {
    const byLetter = letterIndex(part)
    if (byLetter !== null && !headers.some((h) => h.trim() === part)) {
      out.push(byLetter)
      continue
    }
    const exact = headers.findIndex((h) => h.trim() === part)
    const loose = exact >= 0 ? exact : headers.findIndex((h) => norm(h) === norm(part))
    if (loose >= 0 && !out.includes(loose)) out.push(loose)
  }
  return out
}

const firstValue = (row: string[], cols: number[]) => {
  for (const c of cols) {
    const v = String(row[c] ?? '').trim()
    if (v) return v
  }
  return ''
}

/** The header row: given (1-based), else the first of the first 10 rows that has a recognisable header. */
export function headerRowIndex(grid: string[][], headerRow?: number, specs: string[] = []): number {
  if (headerRow && headerRow > 0) return headerRow - 1
  const limit = Math.min(grid.length, 10)
  for (let r = 0; r < limit; r++) {
    const cells = grid[r] ?? []
    // Only header names count here: column letters resolve on any row.
    const named = specs.flatMap((s) => s.split('|').map((p) => p.trim())).filter((p) => p && letterIndex(p) === null)
    if (named.some((p) => cells.some((c) => norm(c) === norm(p))) || cells.some((c) => matchField(c) === 'title')) return r
  }
  return 0
}

export interface TemplateRow {
  /** 1-based sheet row number. */
  sheetRow: number
  title: string
  brief: string | null
  keywords: string[]
  targetWordCount: number | null
  inputs: Record<string, string>
  errors: string[]
}

/** The column map a template implies: its input aliases (explicit `columnMap` entries win). */
function columnSpecs(config: TemplateConfig, columnMap: Record<string, string>): Record<string, string> {
  const specs: Record<string, string> = {}
  for (const f of config.inputs) specs[f.key] = [f.label, ...(f.aliases ?? [])].join('|')
  return { ...specs, ...columnMap }
}

/**
 * Queue rows for a template. Rows whose title cell is empty are skipped (as in n8n). For the tribe-page
 * template the community-page sheet layout is used instead (URL cell + "keyword (volume)" cells).
 */
export function buildTemplateRows(grid: string[][], config: TemplateConfig, opts: { columnMap?: Record<string, string>; headerRow?: number } = {}): TemplateRow[] {
  if (config.assembly === 'tribe-page') {
    return tribePageRows(grid).map((r) => ({
      sheetRow: r.rowNumber,
      title: `${r.label} Community Page`,
      brief: null,
      keywords: r.keywords,
      targetWordCount: null,
      inputs: { label: r.label, pageUrl: r.url },
      errors: [],
    }))
  }
  const specs = columnSpecs(config, opts.columnMap ?? {})
  const h = headerRowIndex(grid, opts.headerRow, Object.values(specs))
  const headers = (grid[h] ?? []).map((c) => String(c ?? ''))
  const cols = Object.fromEntries(Object.entries(specs).map(([k, s]) => [k, resolveColumns(s, headers)]))
  const out: TemplateRow[] = []
  for (let r = h + 1; r < grid.length; r++) {
    const row = grid[r] ?? []
    const title = firstValue(row, cols.title ?? []).replace(/\s+/g, ' ')
    if (!title) continue
    const errors: string[] = []
    if (title.length > 300) errors.push('Title is longer than 300 characters')
    const wcText = firstValue(row, cols.wordcount ?? []).replace(/^=+/, '').trim()
    const wc = parseWordCount(wcText)
    if (wc.error) errors.push(wc.error)
    const inputs: Record<string, string> = {}
    // The prompt gets the sheet's text ("1500-2000"), as in n8n; the article keeps the upper bound.
    if (wcText && !wc.error) inputs.wordCount = wcText
    for (const f of config.inputs) {
      if ((ARTICLE_FIELDS as readonly string[]).includes(f.key)) continue
      const v = firstValue(row, cols[f.key] ?? [])
      if (v) inputs[f.key] = v
      else if (f.required) errors.push(`Missing ${f.label}`)
    }
    const brief = firstValue(row, cols.brief ?? []) || null
    if (brief && brief.length > 10000) errors.push('Brief is longer than 10,000 characters')
    out.push({
      sheetRow: r + 1,
      title,
      brief,
      keywords: splitKeywords(firstValue(row, cols.keywords ?? [])).slice(0, 50),
      targetWordCount: wc.value,
      inputs,
      errors,
    })
  }
  return out
}

export interface InventoryItemInput {
  url: string
  title: string | null
  attrs: Record<string, string> | null
}

const URL_HEADER = /url|link/i
const TITLE_HEADER = /^(title|page|name|product ?name|business ?name|label|video ?title)$/i

/**
 * Link-inventory items from a sheet. `columnMap` may name `url`, `title` and any attribute columns
 * (e.g. city, tribe); otherwise the URL column is the first header containing "url"/"link" (or the first
 * cell that is a URL) and the title column a title-like header. `urlPrefix` turns slugs into URLs.
 * Rows without a valid URL are skipped, and duplicates keep their first row.
 */
export function buildInventoryItems(
  grid: string[][],
  opts: { columnMap?: Record<string, string>; headerRow?: number; urlPrefix?: string } = {},
): InventoryItemInput[] {
  const map = opts.columnMap ?? {}
  const h = headerRowIndex(grid, opts.headerRow, Object.values(map))
  const headers = (grid[h] ?? []).map((c) => String(c ?? ''))
  let urlCols = map.url ? resolveColumns(map.url, headers) : headers.map((x, i) => (URL_HEADER.test(x) ? i : -1)).filter((i) => i >= 0)
  const titleCols = map.title ? resolveColumns(map.title, headers) : headers.map((x, i) => (TITLE_HEADER.test(x.trim()) ? i : -1)).filter((i) => i >= 0)
  const attrCols = Object.entries(map)
    .filter(([k]) => k !== 'url' && k !== 'title')
    .map(([k, s]) => [k, resolveColumns(s, headers)] as const)
  if (!urlCols.length) {
    // No URL header: the first column whose cells look like URLs.
    const sample = grid.slice(h + 1, h + 21)
    const idx = headers.findIndex((_, i) => sample.some((row) => /^https?:\/\//i.test(String(row[i] ?? '').trim())))
    urlCols = idx >= 0 ? [idx] : []
  }

  const seen = new Set<string>()
  const out: InventoryItemInput[] = []
  for (let r = h + 1; r < grid.length; r++) {
    const row = grid[r] ?? []
    let url = firstValue(row, urlCols)
    if (url && !/^https?:\/\//i.test(url) && opts.urlPrefix) url = opts.urlPrefix.replace(/\/?$/, '/') + url.replace(/^\/+/, '')
    url = extractUrls(url)[0] ?? ''
    if (!url || seen.has(urlKey(url))) continue
    seen.add(urlKey(url))
    const attrs: Record<string, string> = {}
    for (const [k, cols] of attrCols) {
      const v = firstValue(row, cols)
      if (v) attrs[k] = v
    }
    out.push({ url, title: firstValue(row, titleCols) || null, attrs: Object.keys(attrs).length ? attrs : null })
  }
  return out
}
