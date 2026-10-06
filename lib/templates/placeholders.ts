// {{NAME}} placeholders in template prompts. Every value is filled before a prompt is sent; an unknown
// or empty-required placeholder is reported rather than silently left in the text.

const PLACEHOLDER = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g

export function listPlaceholders(text: string): string[] {
  const seen = new Set<string>()
  for (const m of text.matchAll(PLACEHOLDER)) seen.add(m[1])
  return [...seen]
}

export interface RenderResult {
  text: string
  /** Placeholders with no value supplied (left in the text as-is). */
  missing: string[]
}

export function renderPlaceholders(text: string, values: Record<string, string | number | undefined | null>): RenderResult {
  const missing = new Set<string>()
  const out = text.replace(PLACEHOLDER, (whole, name: string) => {
    const v = values[name]
    if (v === undefined || v === null) {
      missing.add(name)
      return whole
    }
    return String(v)
  })
  return { text: out, missing: [...missing] }
}

/** The sheet's word count, or the template default range when the cell is blank. Never empty. */
export function resolveWordCount(raw: string | number | null | undefined, fallback = '1500-2500'): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return String(raw)
  const s = typeof raw === 'string' ? raw.trim().replace(/^=+/, '') : ''
  return s || fallback
}

/** `1500-2500` / `1,500 – 2,000` / `1200` → numeric range (a single value is both ends). */
export function parseWordRange(value: string): { min: number; max: number } | null {
  const nums = value.replace(/,/g, '').match(/\d+/g)?.map(Number) ?? []
  if (!nums.length) return null
  const [a, b = a] = nums
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

export function currentYear(now = new Date()): string {
  return String(now.getFullYear())
}
