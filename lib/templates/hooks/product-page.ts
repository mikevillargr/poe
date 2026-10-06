// The Watch Store FAQ: product details come from the live product page. Only the first
// <div class="product__description rte quick-add-hidden"> block is used, including nested divs. A missing
// or empty block fails the row instead of generating an FAQ from nothing.

const OPEN_DIV = /<div\b[^>]*>/gi
const ANY_DIV = /<\/?div\b[^>]*>/gi

function hasClasses(tag: string, classes: string[]): boolean {
  const m = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag)
  if (!m) return false
  const have = new Set((m[2] ?? m[3] ?? '').split(/\s+/).filter(Boolean))
  return classes.every((c) => have.has(c))
}

/** Inner HTML of the first div carrying all `classes`, matching nested divs; null when absent. */
export function extractDivByClass(html: string, classes: string[]): string | null {
  OPEN_DIV.lastIndex = 0
  let open: RegExpExecArray | null
  while ((open = OPEN_DIV.exec(html))) {
    if (!hasClasses(open[0], classes)) continue
    const start = open.index + open[0].length
    ANY_DIV.lastIndex = start
    let depth = 1
    let m: RegExpExecArray | null
    while ((m = ANY_DIV.exec(html))) {
      depth += m[0][1] === '/' ? -1 : 1
      if (depth === 0) return html.slice(start, m.index)
    }
    return html.slice(start) // unbalanced: take the rest
  }
  return null
}

/** The doc's HTML → text rules: <br>/<p> newlines, <li> as "- " lines, entities decoded, 3+ newlines → 2. */
export function productHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const TWS_DESCRIPTION_CLASSES = ['product__description', 'rte', 'quick-add-hidden']

/** Product details for {{PRODUCT_DETAILS}}, or null when the block is missing or empty (row fails). */
export function productDetailsFromPage(html: string, classes: string[] = TWS_DESCRIPTION_CLASSES): string | null {
  const inner = extractDivByClass(html, classes)
  if (inner === null) return null
  const text = productHtmlToText(inner)
  return text || null
}
