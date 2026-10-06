// Plain-text section markers (ARTICLE_TITLE:, MAIN_CONTENT:, …) that blog prompts ask the model to emit.
// A marker line may be wrapped in ** and may omit the colon; matching is case-insensitive and a space may
// stand in for the underscore. Without a colon the marker must be alone on its line, so a sentence that
// starts with "Conclusion" is never mistaken for one. A missing marker yields '' (no error), as in n8n.

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function markerLine(markers: string[]): RegExp {
  const names = [...markers]
    .sort((a, b) => b.length - a.length) // CONCLUSION_HEADER before CONCLUSION
    .map((m) => escapeRegExp(m).replace(/_/g, '[_ ]'))
    .join('|')
  return new RegExp(`^\\s*(?:\\*\\*)?\\s*(${names})\\s*(?:\\*\\*)?\\s*(?:(:)\\s*(?:\\*\\*)?\\s*(.*))?$`, 'i')
}

const canonical = (s: string) => s.toUpperCase().replace(/ /g, '_')

export function parseMarkers(text: string, markers: string[]): Record<string, string> {
  const out: Record<string, string> = Object.fromEntries(markers.map((m) => [m, '']))
  if (!markers.length) return out
  const re = markerLine(markers)
  let current: string | null = null
  const buf: Record<string, string[]> = {}
  for (const line of text.split('\n')) {
    const m = re.exec(line)
    // A colon-less match must have nothing else on the line.
    if (m && (m[2] || !(m[3] ?? '').trim())) {
      current = canonical(m[1])
      buf[current] ??= []
      const rest = (m[3] ?? '').trim()
      if (rest) buf[current].push(rest)
      continue
    }
    if (current) buf[current].push(line)
  }
  for (const m of markers) {
    if (buf[m]) out[m] = buf[m].join('\n').trim()
  }
  return out
}
