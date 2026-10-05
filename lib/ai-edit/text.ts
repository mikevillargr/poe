// Pure helpers for the inline AI edit UI (client-safe, no I/O). Tested in text.test.ts.
import { AI_EDIT_LIMITS, AI_EDIT_PRESET_TABLE, type AiEditPreset, type AiEditWarning } from '@/lib/prompts/ai-edit-presets'

export const DEFAULT_INSERT_INSTRUCTION = 'Continue writing naturally from here.'

/** Cuts at a word boundary where possible so context never starts or ends mid-word. */
function trimToWord(s: string, fromEnd: boolean): string {
  if (!s) return s
  const m = fromEnd ? s.match(/^\S*\s+/) : s.match(/\s+\S*$/)
  return m ? s.slice(fromEnd ? m[0].length : 0, fromEnd ? undefined : s.length - m[0].length) : s
}

/**
 * Context sent with an inline edit: the text before the selection/cursor (keeping its END) and after
 * (keeping its START), each capped at `max` characters (server limit 4000).
 */
export function clipContext(before: string, after: string, max: number = AI_EDIT_LIMITS.context): { contextBefore: string; contextAfter: string } {
  const b = before.length > max ? trimToWord(before.slice(before.length - max), true) : before
  const a = after.length > max ? trimToWord(after.slice(0, max), false) : after
  return { contextBefore: b.trim(), contextAfter: a.trim() }
}

const WARNING_TEXT: Record<AiEditWarning, string> = {
  primary_keyword_removed: 'This version drops the primary keyword.',
  link_removed: 'This version removes a link from the original.',
}

/** Human-readable, de-duplicated warning lines (unknown codes are ignored). */
export function warningMessages(warnings: readonly string[] | undefined | null): string[] {
  const out: string[] = []
  for (const w of warnings ?? []) {
    const t = WARNING_TEXT[w as AiEditWarning]
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

/** Plain-text rendering of a (possibly partial, possibly fenced) model HTML fragment, for the preview. */
export function plainPreview(raw: string): string {
  return raw
    .replace(/^\s*```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .replace(/<\/(p|h[1-6]|li|ul|ol)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>?/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A rewrite of text inside one block must land inline: unwrap a single wrapping <p>…</p>. */
export function unwrapInline(html: string): string {
  const t = html.trim()
  const m = t.match(/^<p>([\s\S]*)<\/p>$/i)
  return m && !/<\/?(p|h[1-6]|ul|ol|li)\b/i.test(m[1]) ? m[1] : t
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** HTML for text the user edited by hand in the preview: paragraphs split on blank lines. */
export function plainToHtml(text: string, inline: boolean): string {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (inline) return escapeHtml(paras.join(' ').replace(/\s*\n\s*/g, ' '))
  return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
}

/** Instruction for a re-run from Adjust: the preset's own instruction plus the extra request, within the server limit. */
export function adjustInstruction(preset: AiEditPreset | null, previous: string, extra: string): string {
  const base = preset && preset !== 'custom' ? AI_EDIT_PRESET_TABLE[preset].instruction : previous.trim()
  const out = [base, extra.trim() && `Additionally: ${extra.trim()}`].filter(Boolean).join(' ')
  return out.slice(0, AI_EDIT_LIMITS.instruction)
}
