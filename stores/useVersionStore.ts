import { create } from 'zustand'

export interface DocumentVersion {
  id: string
  timestamp: Date
  content: string // HTML from TipTap
  label?: string // Manual label
  isAutoSave: boolean
  wordCount: number
  characterCount: number
}

interface VersionStore {
  versions: DocumentVersion[]
  currentVersionId: string | null
  maxAutoSaves: number
  
  // Actions
  addVersion: (content: string, wordCount: number, characterCount: number, label?: string, isAuto?: boolean) => void
  restoreVersion: (id: string) => DocumentVersion | null
  deleteVersion: (id: string) => void
  pruneAutoSaves: () => void
  
  // Getters
  getVersion: (id: string) => DocumentVersion | undefined
  getLatestVersion: () => DocumentVersion | undefined
  getManualVersions: () => DocumentVersion[]
  getAutoVersions: () => DocumentVersion[]
}

export const useVersionStore = create<VersionStore>((set, get) => ({
  versions: [],
  currentVersionId: null,
  maxAutoSaves: 50,

  addVersion: (content, wordCount, characterCount, label, isAuto = true) => {
    const newVersion: DocumentVersion = {
      id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      content,
      label,
      isAutoSave: isAuto,
      wordCount,
      characterCount,
    }

    set((state) => ({
      versions: [...state.versions, newVersion],
      currentVersionId: newVersion.id,
    }))

    // Auto-prune if needed
    if (isAuto) {
      get().pruneAutoSaves()
    }
  },

  restoreVersion: (id) => {
    const version = get().versions.find(v => v.id === id)
    if (version) {
      set({ currentVersionId: id })
      return version
    }
    return null
  },

  deleteVersion: (id) => {
    set((state) => ({
      versions: state.versions.filter(v => v.id !== id),
    }))
  },

  pruneAutoSaves: () => {
    const { versions, maxAutoSaves } = get()
    const autoSaves = versions.filter(v => v.isAutoSave)
    
    if (autoSaves.length > maxAutoSaves) {
      // Keep only the most recent maxAutoSaves auto-saves
      const sortedAuto = autoSaves.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      const toDelete = sortedAuto.slice(maxAutoSaves)
      const deleteIds = new Set(toDelete.map(v => v.id))
      
      set((state) => ({
        versions: state.versions.filter(v => !deleteIds.has(v.id)),
      }))
    }
  },

  getVersion: (id) => {
    return get().versions.find(v => v.id === id)
  },

  getLatestVersion: () => {
    const { versions } = get()
    if (versions.length === 0) return undefined
    return versions.reduce((latest, current) => 
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    )
  },

  getManualVersions: () => {
    return get().versions.filter(v => !v.isAutoSave)
  },

  getAutoVersions: () => {
    return get().versions.filter(v => v.isAutoSave)
  },
}))
