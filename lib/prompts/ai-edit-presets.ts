// Client-safe (no 'server-only'): the inline AI edit presets, importable by the UI and the server prompt.

export const AI_EDIT_PRESETS = ['shorten', 'expand', 'simplify', 'casual', 'formal', 'fix_grammar', 'custom'] as const
export type AiEditPreset = (typeof AI_EDIT_PRESETS)[number]

export const AI_EDIT_PRESET_TABLE: Record<AiEditPreset, { label: string; instruction: string }> = {
  shorten: { label: 'Shorten', instruction: 'Make the passage noticeably shorter (roughly a third to a half) by cutting filler and redundancy. Keep every key point.' },
  expand: { label: 'Expand', instruction: 'Expand the passage with more useful detail and explanation (roughly 1.5 to 2 times as long). Add only what the surrounding article and brief support; do not invent facts or figures.' },
  simplify: { label: 'Simplify', instruction: 'Rewrite in simpler, plainer language with shorter sentences and everyday words. Keep the meaning and any necessary technical terms.' },
  casual: { label: 'Make casual', instruction: 'Rewrite in a more casual, conversational tone while staying professional and accurate.' },
  formal: { label: 'Make formal', instruction: 'Rewrite in a more formal, authoritative tone without becoming stiff or wordy.' },
  fix_grammar: { label: 'Fix grammar', instruction: 'Fix grammar, spelling, punctuation and awkward phrasing only. Change as little else as possible.' },
  custom: { label: 'Custom instruction', instruction: 'Follow the custom instruction below.' },
}

export const AI_EDIT_PRESET_LIST = AI_EDIT_PRESETS.map((id) => ({ id, label: AI_EDIT_PRESET_TABLE[id].label }))

export const AI_EDIT_LIMITS = { selectedText: 8000, instruction: 1000, context: 4000 } as const

export type AiEditWarning = 'primary_keyword_removed' | 'link_removed'
