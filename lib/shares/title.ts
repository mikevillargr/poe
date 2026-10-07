// DR-021: drafts usually open with the article title as an H1; the shared page already shows the title above
// the article, so a leading H1 that repeats it is dropped (pure).

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export function stripLeadingTitle(html: string, title: string): string {
  const m = /^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i.exec(html)
  if (!m) return html
  const norm = (s: string) => s.replace(/[“”"'’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  return norm(text(m[1]!)) === norm(text(title)) ? html.slice(m[0].length) : html
}
