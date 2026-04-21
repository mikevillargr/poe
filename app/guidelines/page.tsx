'use client'

import React, { useState, useEffect } from 'react'
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
  const [discoveredDimensions, setDiscoveredDimensions] = useState<any[]>([])
  const [savedHeuristics, setSavedHeuristics] = useState<Heuristic[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('All')
  const [editingHeuristic, setEditingHeuristic] = useState<Heuristic | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const { settings } = useSettings()

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      setInputMethod('upload')
      setError('') // Clear any previous errors
    }
  }
  
  // Load saved heuristics on mount
  useEffect(() => {
    const loadHeuristics = async () => {
      try {
        const response = await fetch('/api/guidelines/list')
        if (response.ok) {
          const { heuristics } = await response.json()
          setSavedHeuristics(heuristics || [])
        }
      } catch (error) {
        console.error('Failed to load heuristics:', error)
      }
    }
    loadHeuristics()
  }, [])

  // Note: Persistent job system removed for simplicity
  // Direct extraction is faster and simpler for most use cases

  // Auto-trigger extraction when file is set
  useEffect(() => {
    if (file && inputMethod === 'upload' && step === 'input') {
      // Small delay to show the file was uploaded
      const timer = setTimeout(() => {
        handleIngest()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [file, inputMethod])

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

      // Get content based on input method
      if (inputMethod === 'paste') {
        content = inputValue
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
      }

      // Extract heuristics directly - simple and synchronous
      console.log('Extracting heuristics from content length:', content.length)
      const extractResponse = await fetch('/api/guidelines/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          source: inputMethod,
          apiKey: settings.apiKey,
        }),
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.error || 'Failed to extract heuristics')
      }

      const { heuristics, dimensions } = await extractResponse.json()
      console.log('Extracted heuristics:', heuristics.length)
      
      setExtractedHeuristics(heuristics)
      setDiscoveredDimensions(dimensions || [])
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
    console.log('Saving heuristics:', extractedHeuristics)
    setIsProcessing(true)
    setError('') // Clear any previous errors
    
    try {
      const response = await fetch('/api/guidelines/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heuristics: extractedHeuristics }),
      })

      console.log('Save response status:', response.status)
      console.log('Save response ok:', response.ok)
      
      // Get response text first to see what we're dealing with
      const responseText = await response.text()
      console.log('Save response text:', responseText)
      
      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = JSON.parse(responseText)
        } catch (e) {
          console.error('Could not parse error response:', responseText)
        }
        console.error('Save failed:', errorData)
        throw new Error(errorData.error || `Failed to save heuristics (${response.status})`)
      }

      let saveData = {}
      try {
        saveData = JSON.parse(responseText)
      } catch (e) {
        console.error('Could not parse success response:', responseText)
      }
      console.log('Save successful:', saveData)

      // Try to reload from storage
      let loaded = false
      try {
        const listResponse = await fetch('/api/guidelines/list')
        if (listResponse.ok) {
          const data = await listResponse.json()
          console.log('Loaded heuristics from storage:', data.heuristics?.length)
          if (data.heuristics && data.heuristics.length > 0) {
            setSavedHeuristics(data.heuristics)
            loaded = true
          }
        }
      } catch (listErr) {
        console.warn('Failed to reload from storage:', listErr)
      }

      // Fallback: add extracted heuristics directly to local state
      if (!loaded) {
        console.log('Using extracted heuristics directly as fallback')
        setSavedHeuristics(prev => [...prev, ...extractedHeuristics])
      }

      setExtractedHeuristics([])
      setStep('input')
      setInputValue('')
      setFile(null)
    } catch (err: any) {
      console.error('Save error:', err)
      setError(err.message || 'Failed to save heuristics')
      setStep('review') // Stay on review page to show error
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

  // Handle edit saved heuristic
  const handleEditHeuristic = async (updates: { text: string; weight: number }) => {
    if (!editingHeuristic) return

    try {
      const response = await fetch(`/api/guidelines/${editingHeuristic.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        // Update local state
        setSavedHeuristics(prev =>
          prev.map(h => h.id === editingHeuristic.id ? { ...h, ...updates } : h)
        )
        setEditingHeuristic(null)
      } else {
        alert('Failed to update heuristic')
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('Failed to update heuristic')
    }
  }

  // Handle delete saved heuristic
  const handleDeleteHeuristic = async (id: string) => {
    try {
      const response = await fetch(`/api/guidelines/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSavedHeuristics(prev => prev.filter(h => h.id !== id))
        setDeleteConfirmId(null)
      } else {
        alert('Failed to delete heuristic')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete heuristic')
    }
  }

  // Get unique categories from saved heuristics for dynamic filter tabs
  const savedCategories = Array.from(new Set(savedHeuristics.map(h => h.category)))

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
                  onClick={() => {
                    setStep('input')
                    setError('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveHeuristics}
                  disabled={extractedHeuristics.length === 0 || isProcessing}
                  className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-input text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

            {/* Error Message */}
            {error && (
              <div className="mb-6 bg-danger/10 border border-danger/20 rounded-input px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Save Failed</p>
                  <p className="text-xs text-red-400/80 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Discovered Dimensions */}
            {discoveredDimensions.length > 0 && (
              <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-medium text-heading">
                    Discovered Dimensions ({discoveredDimensions.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {discoveredDimensions.map((dim: any, idx: number) => (
                    <div key={idx} className="bg-surface/50 rounded-input p-3 border border-border">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full bg-badge-${dim.color || 'client'}`} />
                        <span className="text-sm font-medium text-heading">{dim.name}</span>
                      </div>
                      <p className="text-xs text-muted">{dim.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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


        {/* Saved Heuristics List - always visible when heuristics exist */}
        {savedHeuristics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 mt-10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display text-heading">
                Heuristic Store
                <span className="ml-3 text-sm font-mono text-muted">
                  {savedHeuristics.length} rules
                </span>
              </h2>
              <div className="flex gap-2 flex-wrap">
                {['All', ...savedCategories].map((filter) => (
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
                  <button 
                    onClick={() => setEditingHeuristic(heuristic)}
                    className="p-2 text-muted hover:text-accent transition-colors"
                    title="Edit heuristic"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(heuristic.id)}
                    className="p-2 text-muted hover:text-red-400 transition-colors"
                    title="Delete heuristic"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {savedHeuristics.length === 0 && (step === 'input' || step === 'complete') && (
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

        {/* Edit Modal */}
        <AnimatePresence>
          {editingHeuristic && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setEditingHeuristic(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <h3 className="text-xl font-display text-heading mb-6">Edit Heuristic</h3>
                
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    handleEditHeuristic({
                      text: formData.get('text') as string,
                      weight: parseInt(formData.get('weight') as string),
                    })
                  }}
                  className="space-y-6"
                >
                  {/* Category (read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-heading mb-2">
                      Category
                    </label>
                    <CategoryBadge category={editingHeuristic.category} variant="solid" />
                    <p className="text-xs text-muted mt-1">
                      Category cannot be changed after creation
                    </p>
                  </div>

                  {/* Heuristic Text */}
                  <div>
                    <label className="block text-sm font-medium text-heading mb-2">
                      Heuristic Rule
                    </label>
                    <textarea
                      name="text"
                      defaultValue={editingHeuristic.text}
                      rows={4}
                      className="w-full bg-surface border border-border rounded-input px-4 py-3 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                      placeholder="Enter the heuristic rule..."
                      required
                    />
                    <p className="text-xs text-muted mt-1">
                      This is the instruction that will be used to evaluate content
                    </p>
                  </div>

                  {/* Weight */}
                  <div>
                    <label className="block text-sm font-medium text-heading mb-2">
                      Scoring Weight
                    </label>
                    <input
                      type="number"
                      name="weight"
                      defaultValue={editingHeuristic.weight}
                      min="1"
                      max="10"
                      className="w-full bg-surface border border-border rounded-input px-4 py-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                    <p className="text-xs text-muted mt-1">
                      Weight from 1-10. Higher weights have more impact on the overall score. 
                      Use 10 for critical rules, 5 for moderate importance, 1 for minor guidelines.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 justify-end pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setEditingHeuristic(null)}
                      className="px-4 py-2 rounded-input text-sm font-medium text-body hover:bg-surface transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-input text-sm font-medium bg-accent hover:bg-accent/90 text-white transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation */}
        <AnimatePresence>
          {deleteConfirmId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDeleteConfirmId(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card p-6 max-w-md w-full"
              >
                <h3 className="text-lg font-display text-heading mb-2">Delete Heuristic?</h3>
                <p className="text-sm text-muted mb-6">
                  This will permanently remove this heuristic from your scoring equation. 
                  Content will no longer be evaluated against this rule. This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-4 py-2 rounded-input text-sm font-medium text-body hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteHeuristic(deleteConfirmId)}
                    className="px-4 py-2 rounded-input text-sm font-medium bg-danger hover:bg-danger/90 text-white transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageErrorBoundary>
  )
}
