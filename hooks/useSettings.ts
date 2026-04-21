'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '@/utils/settings'
import {
  loadSettings,
  saveSettings,
  clearSettings as clearSettingsUtil,
  DEFAULT_SETTINGS,
} from '@/utils/settings'
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/crypto'

interface EncryptedSettings extends Omit<Settings, 'apiKey'> {
  apiKey: string
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const loaded = loadSettings()
    console.log('Loaded settings from localStorage:', { ...loaded, apiKey: loaded.apiKey ? '***' : '' })
    // Decrypt API key if present
    if (loaded.apiKey) {
      try {
        loaded.apiKey = decryptApiKey(loaded.apiKey)
        console.log('API key decrypted successfully')
      } catch {
        console.error('Failed to decrypt API key')
        loaded.apiKey = ''
      }
    }
    setSettings(loaded)
    setIsLoaded(true)
  }, [])

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value }
      setHasChanges(true)
      return updated
    })
  }, [])

  // Save all settings to localStorage
  const save = useCallback(() => {
    const toSave: EncryptedSettings = { ...settings }
    // Encrypt API key before saving
    if (settings.apiKey) {
      toSave.apiKey = encryptApiKey(settings.apiKey)
    }
    console.log('Saving settings to localStorage:', { ...toSave, apiKey: toSave.apiKey ? '***encrypted***' : '' })
    saveSettings(toSave as unknown as Settings)
    setHasChanges(false)
  }, [settings])

  // Reset to defaults
  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    clearSettingsUtil()
    setHasChanges(true)
  }, [])

  // Discard changes
  const discardChanges = useCallback(() => {
    const loaded = loadSettings()
    if (loaded.apiKey) {
      try {
        loaded.apiKey = decryptApiKey(loaded.apiKey)
      } catch {
        loaded.apiKey = ''
      }
    }
    setSettings(loaded)
    setHasChanges(false)
  }, [])

  return {
    settings,
    updateSetting,
    save,
    reset,
    discardChanges,
    hasChanges,
    isLoaded,
  }
}
