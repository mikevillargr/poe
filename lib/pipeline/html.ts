// Shared (client + server) clean-up for model-produced HTML. Not a full sanitizer: TipTap's schema
// drops anything it doesn't know when the draft is loaded. This removes what could execute or leak
// before the HTML is stored, previewed, or exported.

/** Strips markdown code fences and any chatter before the first tag. */
export function unwrapModelHtml(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '')
  const first = s.indexOf('<')
  if (first > 0) s = s.slice(first)
  return s.trim()
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|noscript|template)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, ' $1="#"')
    .replace(/\s(style|class|id)\s*=\s*("[^"]*"|'[^']*')/gi, '')
}

export function cleanGeneratedHtml(raw: string): string {
  return sanitizeHtml(unwrapModelHtml(raw))
}

export function stripTags(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
