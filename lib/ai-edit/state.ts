// Preview state machine for inline AI edits (rewrite a selection / insert at the cursor).
// Pure reducer, one source of truth for what the UI shows. Tested in state.test.ts.
import type { AiEditPreset } from '@/lib/prompts/ai-edit-presets'

export type AiEditMode = 'rewrite' | 'insert'
export type AiEditPhase = 'closed' | 'prompt' | 'streaming' | 'preview' | 'error' | 'stale'

export interface AiEditState {
  phase: AiEditPhase
  mode: AiEditMode
  /** The selected text (rewrite) or '' (insert). */
  original: string
  preset: AiEditPreset | null
  instruction: string
  /** Sanitised result HTML, set when the stream finished. */
  html: string
  warnings: string[]
  error: string | null
}

export const CLOSED: AiEditState = { phase: 'closed', mode: 'rewrite', original: '', preset: null, instruction: '', html: '', warnings: [], error: null }

export type AiEditAction =
  | { type: 'open'; mode: AiEditMode; original: string }
  | { type: 'run'; preset: AiEditPreset | null; instruction: string }
  | { type: 'result'; html: string; warnings: string[] }
  | { type: 'fail'; message: string }
  | { type: 'stopped' }
  | { type: 'adjust' }
  | { type: 'stale' }
  | { type: 'close' }

export function aiEditReducer(s: AiEditState, a: AiEditAction): AiEditState {
  switch (a.type) {
    case 'open':
      return { ...CLOSED, phase: 'prompt', mode: a.mode, original: a.original }
    case 'run':
      if (s.phase !== 'prompt' && s.phase !== 'error' && s.phase !== 'preview') return s
      return { ...s, phase: 'streaming', preset: a.preset, instruction: a.instruction, html: '', warnings: [], error: null }
    case 'result':
      return s.phase === 'streaming' ? { ...s, phase: 'preview', html: a.html, warnings: a.warnings } : s
    case 'fail':
      return s.phase === 'streaming' ? { ...s, phase: 'error', error: a.message } : s
    case 'stopped':
      return s.phase === 'streaming' ? { ...s, phase: 'prompt' } : s
    case 'adjust':
      return s.phase === 'preview' || s.phase === 'error' ? { ...s, phase: 'prompt', error: null } : s
    case 'stale':
      return s.phase === 'closed' || s.phase === 'stale' ? s : { ...s, phase: 'stale' }
    case 'close':
      return CLOSED
  }
}

/** Accept/Insert is only possible once the stream finished and the target is still where we left it. */
export const canAccept = (s: AiEditState) => s.phase === 'preview' && s.html.trim().length > 0
export const isBusy = (s: AiEditState) => s.phase === 'streaming'
export const isOpen = (s: AiEditState) => s.phase !== 'closed'
