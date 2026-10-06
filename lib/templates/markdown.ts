// Minimal Markdown → HTML for template output. Templates emit only headings (H1–H3), paragraphs, bullet and
// numbered lists, bold/italic, links and pipe tables, so this stays small and owned (no dependency).
// Like the Apps Script formatter it replaces, every non-blank line outside a list or table is its own
// paragraph: tribe pages and FAQs rely on that ("**Diaspora:** …" lines, "**Question**" + answer).
// Output uses only tags the editor and sanitizer keep: h1–h3, p, ul, ol, li, strong, em, a, table parts.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const SAFE_URL = /^(https?:\/\/|mailto:|\/)/i

/** Inline Markdown on one line of text: links, bold, italic. Raw HTML is escaped, never passed through. */
export function inlineMarkdown(text: string): string {
  const links: string[] = []
  // Pull links out first so their URLs aren't touched by the bold/italic passes.
  let s = text.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?\s*\)/g, (_m, label: string, url: string) => {
    const html = SAFE_URL.test(url)
      ? `<a href="${escapeHtml(url)}">${inlineEmphasis(escapeHtml(label))}</a>`
      : inlineEmphasis(escapeHtml(label))
    links.push(html)
    return `\u0000${links.length - 1}\u0000`
  })
  s = inlineEmphasis(escapeHtml(s))
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => links[Number(i)])
}

function inlineEmphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1<em>$2</em>')
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const ORDERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const BARE_URL = /^\s*<?(https?:\/\/\S+?)>?\s*$/

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function renderTable(rows: string[]): string {
  const [head, , ...body] = rows
  const th = splitRow(head)
    .map((c) => `<th>${inlineMarkdown(c)}</th>`)
    .join('')
  const trs = body
    .map((r) => `<tr>${splitRow(r).map((c) => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`)
    .join('')
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || /^\[\/?CENTER\]$/i.test(trimmed)) {
      i++
      continue
    }
    const h = HEADING.exec(trimmed)
    if (h) {
      const level = h[1].length
      // The editor only has H1–H3; deeper headings become a bold paragraph rather than vanish.
      out.push(level <= 3 ? `<h${level}>${inlineMarkdown(h[2])}</h${level}>` : `<p><strong>${inlineMarkdown(h[2])}</strong></p>`)
      i++
      continue
    }
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const rows: string[] = []
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(lines[i++])
      out.push(renderTable(rows))
      continue
    }
    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line)
      const re = ordered ? ORDERED : BULLET
      const items: string[] = []
      while (i < lines.length && re.test(lines[i])) items.push(re.exec(lines[i++])![1])
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((it) => `<li><p>${inlineMarkdown(it)}</p></li>`).join('')}</${tag}>`)
      continue
    }
    const url = BARE_URL.exec(trimmed)
    if (url) {
      // e.g. the NCH YouTube line: kept as a visible link (iframes are stripped before storage).
      const href = escapeHtml(url[1])
      out.push(`<p><a href="${href}">${href}</a></p>`)
      i++
      continue
    }
    out.push(`<p>${inlineMarkdown(trimmed.replace(/\[\/?CENTER\]/gi, ''))}</p>`)
    i++
  }
  return out.join('\n')
}
