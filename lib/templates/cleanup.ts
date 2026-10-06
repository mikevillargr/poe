// Regex cleanup applied to every writer response (doc: "Cleanup rules applied to every Claude response").

/** Drop `---` rule lines, collapse 3+ newlines into one blank line, trim. */
export function sharedCleanup(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*-{3,}\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const isHeading = (line: string) => /^#{1,3}\s/.test(line)
const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line)

/** Blog workflows: strip `**` inside table rows and remove the blank line between two consecutive headings. */
export function blogCleanup(text: string): string {
  const lines = text.split('\n').map((l) => (isTableRow(l) ? l.replace(/\*\*/g, '') : l))
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '' && out.length && isHeading(out[out.length - 1])) {
      let j = i
      while (j < lines.length && lines[j].trim() === '') j++
      if (j < lines.length && isHeading(lines[j])) {
        i = j - 1
        continue
      }
    }
    out.push(line)
  }
  return out.join('\n')
}

/** Removes the blank line directly under the given headings so the first bullet/question sits beneath. */
export function tightenAfterHeadings(text: string, headings: string[]): string {
  const wanted = new Set(headings.map((h) => h.trim().toLowerCase()))
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i])
    if (wanted.has(lines[i].trim().toLowerCase())) {
      while (i + 1 < lines.length && lines[i + 1].trim() === '') i++
    }
  }
  return out.join('\n')
}

/** Strips a leading/trailing Markdown code fence around a whole response. */
export function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}
