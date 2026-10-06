// Line diff for template History (DR-010): longest common subsequence over lines. Prompts are a few
// hundred lines at most, so the O(n·m) table is fine.

export type DiffLine = { type: 'same' | 'add' | 'remove'; text: string }

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: 'remove', text: a[i++] })
    else out.push({ type: 'add', text: b[j++] })
  }
  while (i < n) out.push({ type: 'remove', text: a[i++] })
  while (j < m) out.push({ type: 'add', text: b[j++] })
  return out
}

/** Changed settings between two configs, as "path: before → after" lines (prompts are diffed separately). */
export function changedSettings(before: unknown, after: unknown, path = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    return before.flatMap((v, i) => changedSettings(v, after[i], `${path}[${i}]`))
  }
  if (isObj(before) && isObj(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    return keys.flatMap((k) => (['writerPrompt', 'prompt'].includes(k) ? [] : changedSettings(before[k], after[k], path ? `${path}.${k}` : k)))
  }
  const show = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v).slice(0, 160))
  return [`${path}: ${show(before)} → ${show(after)}`]
}
