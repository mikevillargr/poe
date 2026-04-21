import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'

interface SuggestionRecompositionProps {
  suggestionId: string
  originalText: string
  currentSuggestion: string
  onRecompose: (newText: string, metadata: { prompt?: string; tonality?: string }) => void
  onCancel: () => void
}

const TONALITIES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'persuasive', label: 'Persuasive' },
  { value: 'friendly', label: 'Friendly' },
]

export function SuggestionRecomposition({
  suggestionId,
  originalText,
  currentSuggestion,
  onRecompose,
  onCancel,
}: SuggestionRecompositionProps) {
  const [tonality, setTonality] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const { settings } = useSettings()

  const handleRegenerate = async () => {
    if (!tonality && !customPrompt.trim()) {
      return
    }

    if (!settings.apiKey) {
      setError('API key not configured. Please set it in Settings.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/suggestions/recompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          originalText,
          currentSuggestion,
          tonality: tonality || undefined,
          customPrompt: customPrompt.trim() || undefined,
          apiKey: settings.apiKey,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to recompose')
      }

      const data = await response.json()
      onRecompose(data.newSuggestion, {
        tonality: tonality || undefined,
        prompt: customPrompt.trim() || undefined,
      })
      
      // Reset form
      setTonality('')
      setCustomPrompt('')
    } catch (error: any) {
      console.error('Recomposition failed:', error)
      setError(error.message || 'Failed to regenerate suggestion')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-3 p-4 bg-surface-hover rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h4 className="text-sm font-medium text-heading">Adjust Suggestion</h4>
      </div>

      <div className="space-y-3">
        {/* Tonality Presets */}
        <div>
          <label className="text-xs text-muted mb-2 block">Tonality</label>
          <select
            value={tonality}
            onChange={(e) => {
              setTonality(e.target.value)
              setCustomPrompt('') // Clear custom prompt when selecting tonality
            }}
            disabled={isLoading}
            className="w-full bg-surface border border-border rounded-input px-3 py-2 text-sm text-body focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all disabled:opacity-50"
          >
            <option value="">Select a tonality...</option>
            {TONALITIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Custom Prompt */}
        <div>
          <label className="text-xs text-muted mb-2 block">Custom Prompt</label>
          <textarea
            value={customPrompt}
            onChange={(e) => {
              setCustomPrompt(e.target.value)
              setTonality('') // Clear tonality when typing custom prompt
            }}
            disabled={isLoading}
            placeholder="e.g., Make it more technical and add statistics..."
            className="w-full bg-surface border border-border rounded-input px-3 py-2 text-sm text-body focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 min-h-[80px] resize-none transition-all disabled:opacity-50"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-input px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleRegenerate}
            disabled={isLoading || (!tonality && !customPrompt.trim())}
            className="flex-1 bg-accent hover:bg-accent/90 text-white py-2 rounded-input text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Regenerate
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
