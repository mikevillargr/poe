// Spreadsheet ids from what people paste: a full Google Sheets link or the bare id.

const ID_RE = /^[A-Za-z0-9_-]{20,}$/

export function spreadsheetIdFrom(input: string): string | null {
  const s = input.trim()
  const m = /\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/.exec(s)
  if (m) return m[1]
  return ID_RE.test(s) ? s : null
}

export function spreadsheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`
}
