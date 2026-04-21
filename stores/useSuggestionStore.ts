import { create } from 'zustand'

export interface SuggestionState {
  id: string
  status: 'pending' | 'accepted' | 'dismissed'
  category: 'Brand' | 'SEO' | 'Blacklist' | 'Agency' | 'Client'
  severity: 'high' | 'medium' | 'low'
  title: string
  original: string
  suggested: string
  charStart?: number
  charEnd?: number
  // Recomposition tracking
  isRecomposing?: boolean
  recompositionHistory?: Array<{
    text: string
    prompt?: string
    tonality?: string
    timestamp: Date
  }>
}

interface SuggestionStore {
  suggestions: Map<string, SuggestionState>
  
  // Initialize suggestions
  setSuggestions: (suggestions: SuggestionState[]) => void
  
  // Actions
  acceptSuggestion: (id: string) => void
  dismissSuggestion: (id: string) => void
  undoDismiss: (id: string) => void
  
  // Recomposition
  startRecomposition: (id: string) => void
  updateSuggestion: (id: string, newText: string, metadata?: { prompt?: string; tonality?: string }) => void
  finishRecomposition: (id: string) => void
  
  // Getters
  getSuggestion: (id: string) => SuggestionState | undefined
  getPendingSuggestions: () => SuggestionState[]
  getAcceptedSuggestions: () => SuggestionState[]
  getDismissedSuggestions: () => SuggestionState[]
}

export const useSuggestionStore = create<SuggestionStore>((set, get) => ({
  suggestions: new Map(),

  setSuggestions: (suggestions) => {
    const map = new Map<string, SuggestionState>()
    suggestions.forEach(s => {
      map.set(s.id, { ...s, status: s.status || 'pending' })
    })
    set({ suggestions: map })
  },

  acceptSuggestion: (id) => {
    const { suggestions } = get()
    const suggestion = suggestions.get(id)
    if (suggestion) {
      const updated = new Map(suggestions)
      updated.set(id, { ...suggestion, status: 'accepted' })
      set({ suggestions: updated })
    }
  },

  dismissSuggestion: (id) => {
    const { suggestions } = get()
    const suggestion = suggestions.get(id)
    if (suggestion) {
      const updated = new Map(suggestions)
      updated.set(id, { ...suggestion, status: 'dismissed' })
      set({ suggestions: updated })
    }
  },

  undoDismiss: (id) => {
    const { suggestions } = get()
    const suggestion = suggestions.get(id)
    if (suggestion && suggestion.status === 'dismissed') {
      const updated = new Map(suggestions)
      updated.set(id, { ...suggestion, status: 'pending' })
      set({ suggestions: updated })
    }
  },

  startRecomposition: (id) => {
    const { suggestions } = get()
    const suggestion = suggestions.get(id)
    if (suggestion) {
      const updated = new Map(suggestions)
      updated.set(id, { ...suggestion, isRecomposing: true })
      set({ suggestions: updated })
    }
  },

  updateSuggestion: (id, newText, metadata) => {
    const { suggestions } = get()
    const suggestion = suggestions.get(id)
    if (suggestion) {
      const history = suggestion.recompositionHistory || []
      history.push({
        text: newText,
        prompt: metadata?.prompt,
        tonality: metadata?.tonality,
        timestamp: new Date(),
      })
      
      const updated = new Map(suggestions)
      updated.set(id, {
        ...suggestion,
        suggested: newText,
        recompositionHistory: history,
      })
      set({ suggestions: updated })
    }
  },

  finishRecomposition: (id) => {
    const { suggestions } = get()
    const suggestion = suggestions.get(id)
    if (suggestion) {
      const updated = new Map(suggestions)
      updated.set(id, { ...suggestion, isRecomposing: false })
      set({ suggestions: updated })
    }
  },

  getSuggestion: (id) => {
    return get().suggestions.get(id)
  },

  getPendingSuggestions: () => {
    return Array.from(get().suggestions.values()).filter(s => s.status === 'pending')
  },

  getAcceptedSuggestions: () => {
    return Array.from(get().suggestions.values()).filter(s => s.status === 'accepted')
  },

  getDismissedSuggestions: () => {
    return Array.from(get().suggestions.values()).filter(s => s.status === 'dismissed')
  },
}))
