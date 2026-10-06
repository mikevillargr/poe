// UT tribe community page: inputs come from the COMMUNITY PAGE LINKS/TRIBES sheet, not an ideation row
// (doc: "How the inputs are built").

export const UT_COMMUNITY_PREFIX = 'https://unitedtribes.com/community/'

const KEYWORD_CELL = /\(\s*[\d,.]+\s*\)/
const LABEL_STOPWORDS = /\b(community|culture|food|events|festivals|traditions)\b/gi

export interface TribePageRow {
  /** Real sheet row number (1-based, the grid is read from A1). */
  rowNumber: number
  url: string
  slug: string
  label: string
  keywords: string[] // trailing "(n)" removed
}

export function labelFromKeywordCell(cell: string, slug: string): string {
  const label = cell.split('(')[0].replace(LABEL_STOPWORDS, ' ').replace(/\s+/g, ' ').trim()
  return label || slug
}

/** Every row with a community-page URL, first occurrence of each URL only. */
export function tribePageRows(grid: string[][], prefix = UT_COMMUNITY_PREFIX): TribePageRow[] {
  const seen = new Set<string>()
  const out: TribePageRow[] = []
  grid.forEach((cells, i) => {
    const url = cells.map((c) => (c ?? '').trim()).find((c) => c.startsWith(prefix))
    if (!url || seen.has(url)) return
    seen.add(url)
    const slug = url.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || url
    const keywordCells = cells.map((c) => (c ?? '').trim()).filter((c) => c !== url && KEYWORD_CELL.test(c))
    out.push({
      rowNumber: i + 1,
      url,
      slug,
      label: keywordCells.length ? labelFromKeywordCell(keywordCells[0], slug) : slug,
      keywords: keywordCells.map((c) => c.replace(/\s*\(\s*[\d,.]+\s*\)\s*$/, '').trim()).filter(Boolean),
    })
  })
  return out
}

/** {{KEYWORDS}}: comma-joined, or "(none)". */
export function tribePageKeywords(keywords: string[]): string {
  return keywords.length ? keywords.join(', ') : '(none)'
}

/** Rows whose real row number falls in [startRow, startRow + numRows - 1]. */
export function sliceByRowNumber<T extends { rowNumber: number }>(rows: T[], startRow: number, numRows: number): T[] {
  const end = startRow + numRows - 1
  return rows.filter((r) => r.rowNumber >= startRow && r.rowNumber <= end)
}
