'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, 
  Link2, 
  FileText, 
  Trash2, 
  Check, 
  X, 
  Loader2,
  Sparkles,
  Plus,
  Edit2,
  AlertCircle,
} from 'lucide-react'
import { CategoryBadge, CategoryType } from '@/components/CategoryBadge'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'
import { useSettings } from '@/hooks/useSettings'
import { isGoogleDocsUrl } from '@/lib/google-docs'

interface Heuristic {
  id: string
  category: CategoryType
  text: string
  weight: number
  active: boolean
  reasoning?: string
}

type IngestStep = 'input' | 'processing' | 'review' | 'complete'

export default function GuidelinesPage() {
  const [step, setStep] = useState<IngestStep>('input')
  const [inputMethod, setInputMethod] = useState<'upload' | 'url' | 'paste'>('url')
  const [inputValue, setInputValue] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [extractedHeuristics, setExtractedHeuristics] = useState<Heuristic[]>([])
  const [savedHeuristics, setSavedHeuristics] = useState<Heuristic[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('All')
  const { settings } = useSettings()

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      setInputMethod('upload')
    }
  }

  // Process the input and extract heuristics
  const handleIngest = async () => {
    if (!settings.apiKey) {
      setError('API key not configured. Please set it in Settings.')
      return
    }

    setIsProcessing(true)
    setError('')
    setStep('processing')

    try {
      let content = ''
      let source = ''

      // Get content based on input method
      if (inputMethod === 'paste') {
        content = inputValue
        source = 'paste'
      } else if (inputMethod === 'url') {
        if (!inputValue.trim()) {
          throw new Error('Please enter a URL')
        }

        // Check if it's a Google Docs URL
        if (isGoogleDocsUrl(inputValue)) {
          const response = await fetch('/api/content/fetch-gdoc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: inputValue }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to fetch Google Docs')
          }

          const data = await response.json()
          content = data.content
          source = 'gdoc'
        } else {
          // Regular URL - use existing parse endpoint
          const response = await fetch('/api/content/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: inputValue }),
          })

          if (!response.ok) {
            throw new Error('Failed to fetch URL content')
          }

          const data = await response.json()
          content = data.content
          source = 'url'
        }
      } else if (inputMethod === 'upload' && file) {
        // Handle file upload
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/content/parse', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to parse file')
        }

        const data = await response.json()
        content = data.content
        source = 'docx'
      }

      // Extract heuristics using AI
      const extractResponse = await fetch('/api/guidelines/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          source,
          apiKey: settings.apiKey,
        }),
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.error || 'Failed to extract heuristics')
      }

      const { heuristics } = await extractResponse.json()
      setExtractedHeuristics(heuristics)
      setStep('review')
    } catch (err: any) {
      console.error('Ingest error:', err)
      setError(err.message || 'Failed to process guidelines')
      setStep('input')
    } finally {
      setIsProcessing(false)
    }
  }

  // Save heuristics to database
  const handleSaveHeuristics = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch('/api/guidelines/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heuristics: extractedHeuristics }),
      })

      if (!response.ok) {
        throw new Error('Failed to save heuristics')
      }

      setSavedHeuristics([...savedHeuristics, ...extractedHeuristics])
      setExtractedHeuristics([])
      setStep('complete')
      
      // Reset after 2 seconds
      setTimeout(() => {
        setStep('input')
        setInputValue('')
        setFile(null)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to save heuristics')
    } finally {
      setIsProcessing(false)
    }
  }

  // Update heuristic
  const updateHeuristic = (id: string, updates: Partial<Heuristic>) => {
    setExtractedHeuristics(prev =>
      prev.map(h => h.id === id ? { ...h, ...updates } : h)
    )
  }

  // Delete heuristic
  const deleteHeuristic = (id: string) => {
    setExtractedHeuristics(prev => prev.filter(h => h.id !== id))
  }

  // Filter heuristics
  const filteredHeuristics = savedHeuristics.filter(h => 
    activeFilter === 'All' || h.category === activeFilter
  )

  return (
    <PageErrorBoundary>
      <div className="p-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-display text-heading mb-3">Guidelines</h1>
          <p className="text-muted">
            Ingest client guidelines and brand standards to extract scoring heuristics
          </p>
        </div>

        {/* Ingest Section */}
        {step === 'input' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 mb-10"
          >
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-display text-heading">
                Ingest New Guidelines
              </h2>
            </div>

            {/* Input Method Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setInputMethod('url')}
                className={`flex-1 py-3 px-4 rounded-input text-sm font-medium transition-all ${
                  inputMethod === 'url'
                    ? 'bg-accent text-white shadow-glow-accent'
                    : 'bg-surface border border-border text-muted hover:text-heading'
                }`}
              >
                <Link2 className="w-4 h-4 inline mr-2" />
                URL or Google Docs
              </button>
              <button
                onClick={() => setInputMethod('upload')}
                className={`flex-1 py-3 px-4 rounded-input text-sm font-medium transition-all ${
                  inputMethod === 'upload'
                    ? 'bg-accent text-white shadow-glow-accent'
                    : 'bg-surface border border-border text-muted hover:text-heading'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Upload File
              </button>
              <button
                onClick={() => setInputMethod('paste')}
                className={`flex-1 py-3 px-4 rounded-input text-sm font-medium transition-all ${
                  inputMethod === 'paste'
                    ? 'bg-accent text-white shadow-glow-accent'
                    : 'bg-surface border border-border text-muted hover:text-heading'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Paste Text
              </button>
            </div>

            {/* Input Area */}
            {inputMethod === 'url' && (
              <div className="mb-4">
                <label className="text-sm text-muted mb-2 block">
                  Enter URL or Google Docs link
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="https://docs.google.com/document/d/... or https://example.com/guidelines"
                  className="w-full bg-surface border border-border rounded-input px-4 py-3 text-body focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
                />
              </div>
            )}

            {inputMethod === 'upload' && (
              <div className="mb-4">
                <label className="text-sm text-muted mb-2 block">
                  Upload DOCX file
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".docx,.doc"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center w-full bg-surface border-2 border-dashed border-border rounded-input px-4 py-8 cursor-pointer hover:border-accent/50 transition-colors"
                  >
                    {file ? (
                      <div className="text-center">
                        <FileText className="w-8 h-8 text-accent mx-auto mb-2" />
                        <p className="text-sm text-heading font-medium">{file.name}</p>
                        <p className="text-xs text-muted mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
                        <p className="text-sm text-heading font-medium">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted mt-1">DOCX files only</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}

            {inputMethod === 'paste' && (
              <div className="mb-4">
                <label className="text-sm text-muted mb-2 block">
                  Paste guidelines text
                </label>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Paste your brand guidelines, content standards, or style guide here..."
                  className="w-full bg-surface border border-border rounded-input px-4 py-3 text-body focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 min-h-[200px] resize-none"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 bg-danger/10 border border-danger/20 rounded-input px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleIngest}
              disabled={isProcessing || (!inputValue.trim() && !file)}
              className="w-full bg-accent hover:bg-accent/90 text-white py-3 rounded-input font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Extract Heuristics
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Processing State */}
        {step === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-12 text-center"
          >
            <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-display text-heading mb-2">
              Analyzing Guidelines...
            </h3>
            <p className="text-muted">
              AI is extracting actionable heuristics from your document
            </p>
          </motion.div>
        )}

        {/* Review State */}
        {step === 'review' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-display text-heading mb-1">
                  Review Extracted Heuristics
                </h2>
                <p className="text-sm text-muted">
                  {extractedHeuristics.length} heuristics found. Edit, remove, or approve them.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('input')}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveHeuristics}
                  disabled={extractedHeuristics.length === 0 || isProcessing}
                  className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-input text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save All ({extractedHeuristics.length})
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {extractedHeuristics.map((heuristic) => (
                <div
                  key={heuristic.id}
                  className="glass-card p-4 border border-border hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryBadge category={heuristic.category} variant="solid" />
                        <span className="text-xs text-muted">
                          Weight: {heuristic.weight}/10
                        </span>
                      </div>
                      <p className="text-sm text-heading mb-2">{heuristic.text}</p>
                      {heuristic.reasoning && (
                        <p className="text-xs text-muted italic">
                          Reasoning: {heuristic.reasoning}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteHeuristic(heuristic.id)}
                      className="p-2 text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Complete State */}
        {step === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-xl font-display text-heading mb-2">
              Heuristics Saved!
            </h3>
            <p className="text-muted">
              Your guidelines have been processed and saved to the heuristic store
            </p>
          </motion.div>
        )}

        {/* Saved Heuristics List */}
        {savedHeuristics.length > 0 && step === 'input' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display text-heading">
                Heuristic Store
                <span className="ml-3 text-sm font-mono text-muted">
                  {savedHeuristics.length} rules
                </span>
              </h2>
              <div className="flex gap-2">
                {['All', 'Brand', 'SEO', 'Blacklist', 'Agency', 'Client'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1.5 rounded-input text-xs font-medium transition-all ${
                      activeFilter === filter
                        ? 'bg-accent text-white shadow-glow-accent'
                        : 'bg-surface border border-border text-muted hover:text-heading'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {filteredHeuristics.map((heuristic) => (
                <div
                  key={heuristic.id}
                  className="glass-card p-4 flex items-center gap-4"
                >
                  <CategoryBadge category={heuristic.category} variant="solid" />
                  <p className="flex-1 text-sm text-heading">{heuristic.text}</p>
                  <span className="text-xs text-muted font-mono">
                    {heuristic.weight}/10
                  </span>
                  <button className="p-2 text-muted hover:text-accent transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {savedHeuristics.length === 0 && step === 'input' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted" />
            </div>
            <h3 className="text-lg font-display text-heading mb-2">
              No Heuristics Yet
            </h3>
            <p className="text-sm text-muted">
              Ingest your first guideline document to start building your heuristic store
            </p>
          </motion.div>
        )}
      </div>
    </PageErrorBoundary>
  )
}
