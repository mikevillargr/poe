export interface ScoreThresholds {
  warning: number
  error: number
}

export interface FileUploadSettings {
  maxSize: number
  allowedTypes: string[]
}

export interface Settings {
  apiKey: string
  model: string
  scoreThresholds: ScoreThresholds
  fileUpload: FileUploadSettings
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-sonnet-4-6',
  scoreThresholds: {
    warning: 70,
    error: 50,
  },
  fileUpload: {
    maxSize: 10,
    allowedTypes: ['pdf', 'docx', 'txt', 'url'],
  },
}

export const AVAILABLE_MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest, most cost-effective',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Balanced performance and speed',
  },
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: 'Highest capability, more expensive',
  },
]

export const FILE_TYPE_OPTIONS = [
  { id: 'pdf', label: 'PDF Files', description: '.pdf documents' },
  { id: 'docx', label: 'Word Documents', description: '.docx files' },
  { id: 'txt', label: 'Text Files', description: '.txt files' },
  { id: 'url', label: 'URLs', description: 'Fetch from web' },
]

export const MAX_FILE_SIZE_OPTIONS = [
  { value: 5, label: '5 MB' },
  { value: 10, label: '10 MB' },
  { value: 25, label: '25 MB' },
  { value: 50, label: '50 MB' },
  { value: 100, label: '100 MB' },
]

const SETTINGS_STORAGE_KEY = 'poe-settings'

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS

  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }

  return DEFAULT_SETTINGS
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

export function clearSettings(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear settings:', error)
  }
}
