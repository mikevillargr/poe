'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Sparkles, Clock, Loader2 } from 'lucide-react'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { CategoryBadge, CategoryType } from '@/components/CategoryBadge'
import { ScoreGauge } from '@/components/ScoreGauge'
import { SuggestionRecomposition } from '@/components/SuggestionRecomposition'
import { useSuggestionStore } from '@/stores/useSuggestionStore'
import { useVersionStore } from '@/stores/useVersionStore'
import { useSettings } from '@/hooks/useSettings'

interface DocumentTab {
  id: string
  title: string
  type: 'url' | 'docx' | 'new'
  score?: number
}

interface EditorViewProps {
  tab: DocumentTab | undefined
  dimensions: Array<{ category: string; score: number; status: string }>
  activeFilter: string
  onFilterChange: (filter: string) => void
  activeSuggestionId: string | null
  onSuggestionClick: (id: string | null) => void
  expandedSuggestionId: string | null
  onExpandSuggestion: (id: string | null) => void
  editorRef: React.MutableRefObject<any>
  onShowVersionHistory: () => void
}

export function EditorView({
  tab,
  dimensions,
  activeFilter,
  onFilterChange,
  activeSuggestionId,
  onSuggestionClick,
  expandedSuggestionId,
  onExpandSuggestion,
  editorRef,
  onShowVersionHistory,
}: EditorViewProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [isAnalyzingBase, setIsAnalyzingBase] = useState(false)
  const [baseSuggestions, setBaseSuggestions] = useState<any[]>([])
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [currentScore, setCurrentScore] = useState<number | null>(tab?.score || null)
  const [currentDimensions, setCurrentDimensions] = useState<Array<{ category: string; score: number; passCount?: number; failCount?: number }>>([])
  const [heuristicsCount, setHeuristicsCount] = useState<number>(0)
  
  // Zustand stores
  const {
    suggestions,
    acceptSuggestion,
    dismissSuggestion,
    undoDismiss,
    startRecomposition,
    updateSuggestion,
    finishRecomposition,
    getPendingSuggestions,
    getAcceptedSuggestions,
    getDismissedSuggestions,
    setSuggestions,
  } = useSuggestionStore()
  
  const { addVersion } = useVersionStore()
  const { settings } = useSettings()

  // Plain content
  const plainContent = `
    <h1>${tab?.title || 'Nevada LLC Formation Guide'}</h1>

    <p>Starting a business in Nevada is an exciting venture that offers entrepreneurs significant advantages. From tax benefits to asset protection, the Silver State has become a premier destination for business formation.</p>

    <h2>What is a Registered Agent?</h2>

    <p>A registered agent is a person or entity designated to receive legal documents on behalf of your business. services like LegalZoom or Rocket Lawyer can provide this service, or you can act as your own registered agent if you meet the requirements.</p>

    <h2>Filing Your Articles of Organization</h2>

    <p>The Articles of Organization must be filed with the Nevada Secretary of State to officially form your LLC. Nevada law requires all LLCs to maintain this designation throughout the existence of your business entity.</p>
  `

  // Analyze base content for grammar/readability
  const analyzeBaseContent = async (content: string) => {
    if (!settings.apiKey || !content.trim() || content.length < 100) return
    
    setIsAnalyzingBase(true)
    try {
      const response = await fetch('/api/content/analyze-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          apiKey: settings.apiKey,
        }),
      })

      if (!response.ok) {
        console.error('Base analysis failed')
        return
      }

      const { suggestions: baseSuggs } = await response.json()
      setBaseSuggestions(baseSuggs || [])
      
      // Add base suggestions to the store with special status
      const formattedSuggestions = baseSuggs.map((s: any) => ({
        ...s,
        status: 'pending' as const,
        category: 'Quality' as any,
      }))
      
      // Merge with existing suggestions
      setSuggestions(formattedSuggestions)
    } catch (error) {
      console.error('Base analysis error:', error)
    } finally {
      setIsAnalyzingBase(false)
    }
  }

  // Note: Auto-scoring disabled to save tokens
  // User must manually click Score button to analyze content

  // Filter suggestions based on active filter
  const filteredSuggestions = Array.from(suggestions.values()).filter(s => {
    if (activeFilter === 'All') return s.status === 'pending'
    if (activeFilter === 'Accepted') return s.status === 'accepted'
    if (activeFilter === 'Dismissed') return s.status === 'dismissed'
    return (s.category as string) === activeFilter && s.status === 'pending'
  })

  // Handle accept suggestion
  const handleAccept = (suggestionId: string) => {
    const suggestion = suggestions.get(suggestionId)
    if (!suggestion || !editorRef.current) return

    // Find and replace text in editor
    const editor = editorRef.current
    const { state } = editor
    const { doc } = state
    
    // Find the text to replace
    const searchText = suggestion.original.toLowerCase()
    let found = false
    
    doc.descendants((node: any, pos: number) => {
      if (found || !node.isText) return
      const text = node.text || ''
      const lower = text.toLowerCase()
      const idx = lower.indexOf(searchText)
      
      if (idx !== -1) {
        const from = pos + idx
        const to = from + suggestion.original.length
        
        // Replace the text - use deleteRange + insertContentAt to avoid HTML parsing
        editor.chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, suggestion.suggested)
          .run()
        
        found = true
      }
    })

    // Mark as accepted
    acceptSuggestion(suggestionId)
    
    // Clear active selection
    onSuggestionClick(null)
    
    // Create version snapshot
    const content = editor.getHTML()
    const wordCount = editor.getText().trim().split(/\s+/).filter((w: string) => w.length > 0).length
    const charCount = editor.storage.characterCount.characters()
    addVersion(content, wordCount, charCount, `Accepted: ${suggestion.title}`, false)
  }

  // Handle dismiss suggestion
  const handleDismiss = (suggestionId: string) => {
    dismissSuggestion(suggestionId)
    if (activeSuggestionId === suggestionId) {
      onSuggestionClick(null)
    }
  }

  // Handle recomposition
  const handleRecompose = (suggestionId: string, newText: string, metadata: { prompt?: string; tonality?: string }) => {
    updateSuggestion(suggestionId, newText, metadata)
    finishRecomposition(suggestionId)
    onExpandSuggestion(null)
  }

  // Handle content change for auto-versioning
  const handleContentChange = (content: string, wordCount: number, charCount: number) => {
    setSaveStatus('unsaved')
    // Auto-save version every change (will be pruned to last 50)
    addVersion(content, wordCount, charCount, undefined, true)
    
    setTimeout(() => {
      setSaveStatus('saved')
    }, 1000)
  }

  const handleSaveContent = async (content: string) => {
    if (documentId) {
      try {
        await fetch(`/api/documents/${documentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editedText: content }),
        })
      } catch (e) {
        console.warn('Failed to save content to DB:', e)
      }
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT: Content Editor (55%) */}
      <div className="w-[55%] flex flex-col border-r border-border relative">
        {activeSuggestionId && (
          <div className="absolute top-14 right-4 z-20">
            <button
              onClick={() => onSuggestionClick(null)}
              className="bg-surface border border-border hover:bg-surface-hover text-muted px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear selection
            </button>
          </div>
        )}
        
        {/* Version History Button */}
        <div className="absolute top-14 left-4 z-20">
          <button
            onClick={onShowVersionHistory}
            className="bg-surface border border-border hover:bg-surface-hover text-muted px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1"
          >
            <Clock className="w-3 h-3" />
            {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
          </button>
        </div>
        
        <RichTextEditor
          content={plainContent}
          suggestions={filteredSuggestions}
          placeholder="Start writing or paste your content here..."
          onSave={handleSaveContent}
          autoSaveDelay={2000}
          activeSuggestionId={activeSuggestionId}
          onSuggestionClick={onSuggestionClick}
          onContentChange={handleContentChange}
          editorRef={editorRef}
        />
      </div>

      {/* CENTER: Suggestions (25%) */}
      <div className="w-[25%] flex flex-col border-r border-border bg-background">
        <div className="p-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading font-display text-lg flex items-center gap-2">
              Suggestions
              <span className="bg-surface text-muted px-2 py-0.5 rounded-full text-xs font-mono border border-border">
                {filteredSuggestions.length}
              </span>
            </h2>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['All', 'Quality', 'Brand', 'SEO', 'Blacklist', 'Agency', 'Client', 'Accepted', 'Dismissed'].map((filter) => (
              <button
                key={filter}
                onClick={() => onFilterChange(filter)}
                className={`px-3 py-1.5 rounded-input text-xs font-medium transition-all ${
                  activeFilter === filter
                    ? 'bg-accent text-white shadow-glow-accent'
                    : 'bg-surface border border-border text-muted hover:text-heading hover:border-accent/50'
                }`}
              >
                {filter}
                {filter === 'Quality' && isAnalyzingBase && (
                  <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {filteredSuggestions.map((suggestion) => {
            const isActive = activeSuggestionId === suggestion.id
            const isExpanded = expandedSuggestionId === suggestion.id
            
            return (
              <motion.div
                key={suggestion.id}
                layout
                onClick={() => onSuggestionClick(suggestion.id)}
                className={`glass-card p-4 relative overflow-visible cursor-pointer transition-all ${
                  isActive
                    ? 'ring-2 ring-accent ring-offset-2 ring-offset-background bg-accent/10 shadow-lg'
                    : 'hover:ring-1 hover:ring-accent/50'
                }`}
                style={{ background: 'var(--color-card-bg)' }}
              >
                {/* Status badge */}
                {suggestion.status === 'accepted' && (
                  <div className="absolute -top-2 -right-2 bg-success text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
                    ✓ Accepted
                  </div>
                )}
                {suggestion.status === 'dismissed' && (
                  <div className="absolute -top-2 -right-2 bg-muted text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
                    Dismissed
                  </div>
                )}
                {isActive && suggestion.status === 'pending' && (
                  <div className="absolute -top-2 -right-2 bg-accent text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-glow-accent animate-bounce">
                    Active
                  </div>
                )}

                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  suggestion.category === 'Brand' ? 'bg-badge-brand' :
                  suggestion.category === 'SEO' ? 'bg-badge-seo' :
                  suggestion.category === 'Blacklist' ? 'bg-badge-blacklist' :
                  suggestion.category === 'Agency' ? 'bg-badge-agency' :
                  'bg-badge-client'
                } ${isActive ? 'shadow-glow-accent animate-pulse' : ''}`} />

                <div className="flex items-center justify-between mb-3">
                  <CategoryBadge category={suggestion.category as CategoryType} variant="solid" />
                  <span className={`text-xs font-mono ${
                    suggestion.severity === 'high' ? 'text-red-400' :
                    suggestion.severity === 'medium' ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {suggestion.severity === 'high' ? 'High Impact' :
                     suggestion.severity === 'medium' ? 'Medium Impact' : 'Low Impact'}
                  </span>
                </div>
                
                <p className="text-sm text-heading font-medium mb-3">
                  {suggestion.title}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="bg-danger/10 border border-danger/20 rounded p-2 text-xs text-red-400 line-through">
                    {suggestion.original}
                  </div>
                  <div className="bg-success/10 border border-success/20 rounded p-2 text-xs text-green-400">
                    {suggestion.suggested}
                  </div>
                </div>

                {/* Recomposition UI */}
                {isExpanded && suggestion.status === 'pending' && (
                  <SuggestionRecomposition
                    suggestionId={suggestion.id}
                    originalText={suggestion.original}
                    currentSuggestion={suggestion.suggested}
                    onRecompose={(newText, metadata) => handleRecompose(suggestion.id, newText, metadata)}
                    onCancel={() => onExpandSuggestion(null)}
                  />
                )}

                {/* Action buttons */}
                {suggestion.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAccept(suggestion.id)
                      }}
                      className="flex-1 bg-success hover:bg-success/90 text-white py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onExpandSuggestion(isExpanded ? null : suggestion.id)
                      }}
                      className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Adjust
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDismiss(suggestion.id)
                      }}
                      className="flex-1 bg-surface border border-border hover:bg-surface-hover text-muted py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Dismiss
                    </button>
                  </div>
                )}

                {/* Undo dismiss button */}
                {suggestion.status === 'dismissed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      undoDismiss(suggestion.id)
                    }}
                    className="w-full bg-surface border border-border hover:bg-surface-hover text-heading py-1.5 rounded text-xs font-medium transition-colors mt-3"
                  >
                    Undo Dismiss
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* RIGHT: Score Summary (20%) */}
      <div className="w-[20%] bg-background flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-surface to-transparent pointer-events-none opacity-30" />

        <div className="p-8 border-b border-border flex flex-col items-center justify-center shrink-0 relative z-10">
          <h2 className="text-sm font-medium text-muted mb-8 w-full text-left uppercase tracking-wider text-[10px]">
            Overall Score
          </h2>
          <ScoreGauge score={currentScore ?? 0} size={160} />
          <p className="text-xs text-muted mt-8 font-mono">
            {currentScore !== null ? `${heuristicsCount} rules evaluated` : 'Not scored yet'}
          </p>
          
          {/* Score Button */}
          <button
            onClick={async () => {
              if (!editorRef.current || !settings.apiKey) {
                alert('Please set your API key in Settings')
                return
              }
              
              const content = editorRef.current.getText()
              if (!content || content.length < 50) {
                alert('Please add more content to analyze (minimum 50 characters)')
                return
              }

              setIsAnalyzingBase(true)
              try {
                // Create document in DB if not already tracked
                let docId = documentId
                if (!docId) {
                  try {
                    const docRes = await fetch('/api/documents', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: tab?.title || 'Untitled Analysis',
                        content,
                        source: 'paste',
                      }),
                    })
                    if (docRes.ok) {
                      const { document } = await docRes.json()
                      docId = document.id
                      setDocumentId(document.id)
                    }
                  } catch (e) {
                    console.warn('Could not create document in DB:', e)
                  }
                }

                const response = await fetch('/api/score', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content,
                    source: 'paste',
                    documentId: docId || undefined,
                    apiKey: settings.apiKey,
                  }),
                })

                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Scoring failed')
                }

                const data = await response.json()
                console.log('Score results:', data)

                // Update local state with score results
                setCurrentScore(data.overallScore)
                setCurrentDimensions(data.dimensionScores || [])
                setHeuristicsCount(data.heuristicsCount || 0)
                
                // Add suggestions to store
                if (data.suggestions && data.suggestions.length > 0) {
                  setSuggestions(data.suggestions)
                }
              } catch (error: any) {
                console.error('Scoring error:', error)
                alert(error.message || 'Failed to score content')
              } finally {
                setIsAnalyzingBase(false)
              }
            }}
            disabled={isAnalyzingBase}
            className="mt-6 w-full bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAnalyzingBase ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scoring...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Score Content
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <h3 className="text-sm font-medium text-heading mb-6 font-display">
            Dimension Breakdown
          </h3>
          {currentDimensions.length > 0 ? (
            <div className="space-y-6">
              {currentDimensions.map((dim) => {
                const pass = dim.score >= 70
                return (
                  <div key={dim.category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-body">{dim.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-heading tabular-nums">
                          {dim.score}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${pass ? 'bg-success' : 'bg-danger'}`} />
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${pass ? 'bg-success' : 'bg-danger'}`}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-4">
              Click "Score Content" to see dimension breakdown
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
