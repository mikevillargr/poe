// DR-019: what a draft was written from, so the workspace can say "Changed since this draft: Brief, Keywords".
// Pure (client + server). Stored on the `generated` / `revised` event payload as `inputs`.

export interface DraftInputSource {
  title: string
  brief: string | null
  keywords: string[]
  primaryKeyword: string | null
  targetWordCount: number | null
  templateId: string | null
  templateInputs?: Record<string, unknown> | null
  researchEnabled?: boolean
  research?: unknown
}

export interface DraftInputs {
  title: string
  brief: string
  keywords: string
  primaryKeyword: string
  targetWordCount: string
  template: string
  research: string
}

const LABELS: Record<keyof DraftInputs, string> = {
  title: 'Title',
  brief: 'Brief',
  keywords: 'Keywords',
  primaryKeyword: 'Primary keyword',
  targetWordCount: 'Target length',
  template: 'Template',
  research: 'Research',
}

/** Small stable string hash (djb2), so long values are compared without storing them twice. */
export function hashText(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

/** The research that would feed a draft: summary, outline and the sources still included. */
function researchKey(src: DraftInputSource): string {
  if (src.researchEnabled === false) return 'off'
  const r = src.research as { summary?: string; outlineHtml?: string; citations?: { url?: string; excluded?: boolean }[] } | null | undefined
  if (!r) return 'none'
  const urls = (r.citations ?? []).filter((c) => !c.excluded).map((c) => c.url ?? '')
  return hashText(`${norm(r.summary)}|${norm(r.outlineHtml)}|${urls.join(',')}`)
}

export function draftInputs(src: DraftInputSource): DraftInputs {
  // Empty template inputs ({} or null) are the same thing.
  const entries = src.templateInputs ? Object.entries(src.templateInputs).sort(([a], [b]) => a.localeCompare(b)) : []
  const inputs = entries.length ? JSON.stringify(entries) : ''
  return {
    title: hashText(norm(src.title)),
    brief: hashText(norm(src.brief)),
    keywords: hashText(src.keywords.map((k) => k.trim().toLowerCase()).join(',')),
    primaryKeyword: hashText(norm(src.primaryKeyword).toLowerCase()),
    targetWordCount: String(src.targetWordCount ?? ''),
    template: `${src.templateId ?? ''}:${hashText(inputs)}`,
    research: researchKey(src),
  }
}

/** Labels of the inputs that differ (empty when unchanged, or when there's no record of the draft's inputs). */
export function changedInputs(before: Partial<DraftInputs> | null | undefined, now: DraftInputs): string[] {
  if (!before) return []
  // Fingerprints saved before empty inputs were normalized hashed `{}` as "[]"; read them as empty.
  const legacyEmpty = `:${hashText('[]')}`
  const was = before.template?.endsWith(legacyEmpty) ? `${before.template.slice(0, -legacyEmpty.length)}:${hashText('')}` : before.template
  const prev = { ...before, template: was }
  return (Object.keys(LABELS) as (keyof DraftInputs)[]).filter((k) => prev[k] !== undefined && prev[k] !== now[k]).map((k) => LABELS[k])
}
