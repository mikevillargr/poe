'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  FileText,
  Upload,
} from 'lucide-react'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'
import { useSettings } from '@/hooks/useSettings'
import { AVAILABLE_MODELS, FILE_TYPE_OPTIONS, MAX_FILE_SIZE_OPTIONS } from '@/utils/settings'
import { maskApiKey } from '@/lib/crypto'

// Simple inline toast system
interface SimpleToast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
}

export default function SettingsPage() {
  const { settings, updateSetting, save, reset, discardChanges, hasChanges, isLoaded } =
    useSettings()

  // Simple toast state
  const [toasts, setToasts] = useState<SimpleToast[]>([])

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>(
    settings.fileUpload.allowedTypes
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      updateSetting('fileUpload', {
        ...settings.fileUpload,
        allowedTypes: selectedFileTypes,
      })

      await new Promise(resolve => setTimeout(resolve, 0))

      save()
      setIsSaving(false)
      showToast('success', 'Settings saved successfully')
    } catch (error) {
      setIsSaving(false)
      showToast('error', 'Failed to save settings')
    }
  }

  const handleReset = () => {
    reset()
    setSelectedFileTypes(['pdf', 'docx', 'txt', 'url'])
    showToast('info', 'Settings reset to defaults')
  }

  const handleTestApiKey = async () => {
    if (!settings.apiKey) {
      showToast('error', 'Please enter an API key first')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/settings/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: settings.apiKey }),
      })

      const data = await response.json() as { ok?: boolean; message?: string; model?: string; error?: string; details?: string }

      if (response.ok) {
        showToast('success', 'API key is valid and working')
      } else {
        showToast('error', data.error || 'Unable to validate API key')
      }
    } catch (error) {
      showToast('error', 'Could not reach the server')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleFileType = (type: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted">Loading settings...</div>
      </div>
    )
  }

  return (
    <PageErrorBoundary>
      {/* Toast Container - Fixed at top */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 w-fit max-w-md pointer-events-none">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`px-6 py-4 rounded-lg shadow-lg border-l-4 pointer-events-auto ${
              toast.type === 'success' ? 'bg-surface border-green-500 text-heading' :
              toast.type === 'error' ? 'bg-surface border-red-500 text-heading' :
              toast.type === 'warning' ? 'bg-surface border-orange-500 text-heading' :
              'bg-surface border-accent text-heading'
            }`}
          >
            <p className="font-medium">{toast.message}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="p-10 max-w-4xl mx-auto"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-3xl font-display text-heading mb-2">Settings</h1>
          <p className="text-muted">
            Configure your AI scoring preferences and application settings
          </p>
        </motion.div>

        {/* AI Settings Section */}
        <motion.div variants={itemVariants} className="glass-card mb-6">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <SettingsIcon className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-display text-heading">AI Settings</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-heading mb-2">
                Anthropic API Key
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.apiKey}
                    onChange={(e) => updateSetting('apiKey', e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full bg-surface border border-border rounded-input px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all"
                  />
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={handleTestApiKey}
                  className="px-4 py-2.5 bg-surface border border-border hover:bg-surface-hover text-heading rounded-input text-sm font-medium transition-colors"
                >
                  Test
                </button>
              </div>
              {settings.apiKey && (
                <p className="text-xs text-muted mt-2">
                  Using key: {maskApiKey(settings.apiKey)}
                </p>
              )}
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-heading mb-2">
                Default Model
              </label>
              <select
                value={settings.model}
                onChange={(e) => updateSetting('model', e.target.value)}
                className="w-full bg-surface border border-border rounded-input px-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Scoring Thresholds Section */}
        <motion.div variants={itemVariants} className="glass-card mb-6">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-display text-heading">Scoring Thresholds</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Warning Threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-heading">
                  Warning Threshold
                </label>
                <span className="text-sm font-mono text-accent tabular-nums">
                  {settings.scoreThresholds.warning}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.scoreThresholds.warning}
                onChange={(e) =>
                  updateSetting('scoreThresholds', {
                    ...settings.scoreThresholds,
                    warning: parseInt(e.target.value),
                  })
                }
                className="w-full accent-orange-400"
              />
              <p className="text-xs text-muted mt-2">
                Scores below this value will show a warning (default: 70)
              </p>
            </div>

            {/* Error Threshold */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-heading">
                  Error Threshold
                </label>
                <span className="text-sm font-mono text-danger tabular-nums">
                  {settings.scoreThresholds.error}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.scoreThresholds.error}
                onChange={(e) =>
                  updateSetting('scoreThresholds', {
                    ...settings.scoreThresholds,
                    error: parseInt(e.target.value),
                  })
                }
                className="w-full accent-red-400"
              />
              <p className="text-xs text-muted mt-2">
                Scores below this value will be flagged as critical (default: 50)
              </p>
            </div>
          </div>
        </motion.div>

        {/* File Upload Settings Section */}
        <motion.div variants={itemVariants} className="glass-card mb-6">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <Upload className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-display text-heading">File Upload Settings</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Max File Size */}
            <div>
              <label className="block text-sm font-medium text-heading mb-3">
                Maximum File Size
              </label>
              <div className="flex flex-wrap gap-2">
                {MAX_FILE_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      updateSetting('fileUpload', {
                        ...settings.fileUpload,
                        maxSize: option.value,
                      })
                    }
                    className={`px-4 py-2 rounded-input text-sm font-medium transition-all ${
                      settings.fileUpload.maxSize === option.value
                        ? 'bg-accent text-white shadow-glow-accent'
                        : 'bg-surface border border-border hover:bg-surface-hover text-heading'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Allowed File Types */}
            <div>
              <label className="block text-sm font-medium text-heading mb-3">
                Allowed File Types
              </label>
              <div className="flex flex-wrap gap-2">
                {FILE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleFileType(option.id)}
                    className={`px-4 py-2 rounded-input text-sm font-medium transition-all ${
                      selectedFileTypes.includes(option.id)
                        ? 'bg-accent text-white shadow-glow-accent'
                        : 'bg-surface border border-border hover:bg-surface-hover text-heading'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-3">
                Select which file types can be uploaded for scoring
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div variants={itemVariants} className="flex justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover text-heading rounded-input text-sm font-medium transition-colors"
          >
            Reset to Defaults
          </button>
          {hasChanges && (
            <button
              onClick={discardChanges}
              className="px-6 py-2.5 bg-transparent border border-border hover:bg-surface-hover text-heading rounded-input text-sm font-medium transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-input text-sm font-medium transition-all hover:shadow-glow-accent flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </motion.div>
      </motion.div>
    </PageErrorBoundary>
  )
}
