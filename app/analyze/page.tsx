'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import {
  Check,
  X,
  Download,
  RefreshCw,
  FileText as FileTextIcon,
  FileSpreadsheet,
  Upload,
  Plus,
  Link2,
  PenLine,
  Eye,
  Trash2,
  MoreVertical,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { ScoreGauge } from '@/components/ScoreGauge'
import { CategoryBadge, CategoryType } from '@/components/CategoryBadge'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'
import { useSuggestionStore, SuggestionState } from '@/stores/useSuggestionStore'
import { useVersionStore } from '@/stores/useVersionStore'
import { SuggestionRecomposition } from '@/components/SuggestionRecomposition'
import { VersionHistory } from '@/components/VersionHistory'
import { EditorView } from './EditorView'

interface DocumentTab {
  id: string
  title: string
  type: 'url' | 'docx' | 'new'
  score?: number
  content?: string
  source?: string
  sourceRef?: string
  documentId?: string
}

interface Suggestion {
  id: string
  category: 'Brand' | 'SEO' | 'Blacklist' | 'Agency' | 'Client'
  severity: 'high' | 'medium' | 'low'
  title: string
  original: string
  suggested: string
  accepted: boolean | null
  charStart?: number
  charEnd?: number
}

interface BatchItem {
  id: string
  title: string
  type: 'url' | 'docx'
  status: 'Complete' | 'Scoring' | 'Queued' | 'Error'
  score?: number
  dimensions?: CategoryType[]
  errorMsg?: string
}

// Suggestions will be loaded from actual scoring results
const SUGGESTIONS: Suggestion[] = []

const DIMENSIONS = [
  { category: 'Brand', score: 72, status: 'fail' },
  { category: 'SEO', score: 58, status: 'fail' },
  { category: 'Blacklist', score: 85, status: 'pass' },
  { category: 'Agency', score: 88, status: 'pass' },
  { category: 'Client', score: 64, status: 'fail' },
]

const BATCH_ITEMS: BatchItem[] = [
  {
    id: '1',
    title: 'https://nchinc.com/blog/nevada-llc-guide',
    type: 'url',
    status: 'Complete',
    score: 91,
    dimensions: ['Brand', 'SEO'],
  },
  {
    id: '2',
    title: 'https://nchinc.com/blog/registered-agent',
    type: 'url',
    status: 'Complete',
    score: 84,
    dimensions: ['SEO', 'Agency'],
  },
  {
    id: '3',
    title: 'https://nchinc.com/blog/tax-benefits',
    type: 'url',
    status: 'Complete',
    score: 62,
    dimensions: ['Brand', 'Blacklist'],
  },
  {
    id: '4',
    title: 'business-credit-guide.docx',
    type: 'docx',
    status: 'Scoring',
  },
  {
    id: '5',
    title: 'corporate-veil-protection.docx',
    type: 'docx',
    status: 'Scoring',
  },
  {
    id: '6',
    title: 'https://nchinc.com/blog/annual-list',
    type: 'url',
    status: 'Queued',
  },
  {
    id: '7',
    title: 'https://nchinc.com/blog/broken-link-test',
    type: 'url',
    status: 'Error',
    errorMsg: '404 Not Found - Could not fetch content',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

export default function AnalyzePage() {
  const searchParams = useSearchParams()
  const [tabs, setTabs] = useState<DocumentTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('new')
  const [activeFilter, setActiveFilter] = useState<string>('All')
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null)
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [batchItems, setBatchItems] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const editorRef = useRef<any>(null)
  
  // Zustand stores
  const { suggestions, setSuggestions, acceptSuggestion, dismissSuggestion, updateSuggestion, startRecomposition, finishRecomposition } = useSuggestionStore()
  const { addVersion, restoreVersion } = useVersionStore()
  
  // Initialize suggestions from mock data
  useEffect(() => {
    const initialSuggestions: SuggestionState[] = SUGGESTIONS.map(s => ({
      ...s,
      status: 'pending' as const,
    }))
    setSuggestions(initialSuggestions)
  }, [])

  // Load document from query parameter
  useEffect(() => {
    const docId = searchParams.get('doc')
    if (docId) {
      handleOpenBatchItem(docId)
    }
  }, [searchParams])

  const handleNewTab = () => {
    const newId = `new-${Date.now()}`
    const newTab: DocumentTab = {
      id: newId,
      title: 'New Analysis',
      type: 'new',
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newId)
  }

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const newTabs = tabs.filter((t) => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
  }

  // Load batch items from database
  useEffect(() => {
    loadBatchItems()
  }, [])

  const loadBatchItems = async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const { documents } = await response.json()
        setBatchItems(documents)
      }
    } catch (e) {
      console.error('Failed to load documents:', e)
    }
  }

  const handleOpenBatchItem = async (documentId: string) => {
    const item = batchItems.find((b) => b.id === documentId)
    if (!item) return

    // Check if tab already exists
    const existingTab = tabs.find((t) => t.documentId === documentId)
    if (existingTab) {
      setActiveTabId(existingTab.id)
      return
    }

    // Load document content
    try {
      const response = await fetch(`/api/documents/${documentId}`)
      if (response.ok) {
        const { document } = await response.json()
        const newId = `doc-${Date.now()}`
        const newTab: DocumentTab = {
          id: newId,
          title: document.title,
          type: document.source === 'url' ? 'url' : 'docx',
          score: document.overallScore,
          content: document.editedText || document.originalText,
          source: document.source,
          sourceRef: document.sourceRef,
          documentId: document.id,
        }
        setTabs([...tabs, newTab])
        setActiveTabId(newId)
      }
    } catch (e) {
      console.error('Failed to load document:', e)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setBatchItems(batchItems.filter(item => item.id !== documentId))
        setDeleteConfirm(null)
      }
    } catch (e) {
      console.error('Failed to delete document:', e)
    }
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const filteredSuggestions = SUGGESTIONS.filter(s =>
    activeFilter === 'All' || s.category === activeFilter
  )

  return (
    <PageErrorBoundary>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-screen flex flex-col overflow-hidden"
      >
        {/* Tab Bar */}
        <div className="h-12 border-b border-border bg-surface flex items-center justify-between shrink-0 z-10 pr-4">
          <div className="flex items-center h-full overflow-x-auto custom-scrollbar flex-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`h-full flex items-center gap-2 px-4 border-r border-border min-w-[160px] max-w-[240px] cursor-pointer transition-colors group relative ${
                  activeTabId === tab.id ? 'bg-background text-heading' : 'bg-surface text-muted hover:bg-surface-hover hover:text-body'
                }`}
              >
                {activeTabId === tab.id && (
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-accent shadow-glow-accent" />
                )}
                <div className="shrink-0">
                  {tab.type === 'url' ? (
                    <Link2 className="w-3.5 h-3.5" />
                  ) : (
                    <PenLine className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs font-medium truncate flex-1 select-none">
                  {tab.title}
                </span>
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className={`shrink-0 p-1 rounded hover:bg-border transition-colors ${
                    activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={handleNewTab}
              className="h-full px-3 flex items-center justify-center text-muted hover:text-heading hover:bg-surface-hover transition-colors border-r border-border"
              title="New Analysis"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Batch Queue Button */}
          <button
            onClick={() => setActiveTabId('batch')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-input text-xs font-medium transition-all mr-4 ${
              activeTabId === 'batch' ? 'bg-accent/10 border border-accent text-accent shadow-glow-accent' : 'bg-transparent border border-border text-muted hover:text-heading hover:border-muted'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Batch Queue
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex overflow-hidden bg-background">
          {activeTabId === 'batch' ? (
            <BatchQueueView 
              items={batchItems}
              onOpenTab={handleOpenBatchItem}
              onDeleteItem={(id) => setDeleteConfirm(id)}
            />
          ) : activeTabId === 'new' || !activeTab ? (
            <BlankCanvasView onCreateDocument={async (title, content, source, sourceRef) => {
              const newId = `doc-${Date.now()}`
              
              // Create document in DB
              let documentId: string | undefined
              try {
                const response = await fetch('/api/documents', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title, content, source, sourceRef }),
                })
                if (response.ok) {
                  const { document } = await response.json()
                  documentId = document.id
                }
              } catch (e) {
                console.warn('Failed to create document in DB:', e)
              }

              const newTab: DocumentTab = {
                id: newId,
                title,
                type: source === 'url' ? 'url' : 'docx',
                content,
                source,
                sourceRef,
                documentId,
              }
              setTabs([...tabs, newTab])
              setActiveTabId(newId)
            }} />
          ) : (
            <EditorView
              tab={activeTab}
              dimensions={DIMENSIONS}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              activeSuggestionId={activeSuggestionId}
              onSuggestionClick={setActiveSuggestionId}
              expandedSuggestionId={expandedSuggestionId}
              onExpandSuggestion={setExpandedSuggestionId}
              editorRef={editorRef}
              onShowVersionHistory={() => setShowVersionHistory(true)}
              initialContent={activeTab.content}
              initialDocumentId={activeTab.documentId}
            />
          )}
        </div>
      </motion.div>
      
      {/* Version History Modal */}
      <AnimatePresence>
        {showVersionHistory && (
          <VersionHistory
            onClose={() => setShowVersionHistory(false)}
            onRestore={(version) => {
              if (editorRef.current) {
                editorRef.current.commands.setContent(version.content)
              }
              setShowVersionHistory(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-display text-heading mb-2">Delete Document?</h3>
              <p className="text-sm text-muted mb-6">
                This will permanently delete this document and all associated scores. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-input text-sm font-medium text-body hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteDocument(deleteConfirm)}
                  className="px-4 py-2 rounded-input text-sm font-medium bg-danger hover:bg-danger/90 text-white transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageErrorBoundary>
  )
}

// Blank Canvas View
function BlankCanvasView({ onCreateDocument }: { onCreateDocument: (title: string, content: string, source: string, sourceRef?: string) => void }) {
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload' | 'url'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [pasteContent, setPasteContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      const isGoogleDocs = urlInput.includes('docs.google.com')
      const endpoint = isGoogleDocs ? '/api/content/fetch-gdoc' : '/api/content/parse'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch URL')
      }

      const data = await response.json()
      const title = data.title || urlInput.split('/').pop() || 'Untitled'
      onCreateDocument(title, data.content, 'url', urlInput)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch URL')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePaste = () => {
    if (!pasteContent.trim()) {
      setError('Please paste some content')
      return
    }
    onCreateDocument('Pasted Content', pasteContent, 'paste')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError('')
    try {
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
      onCreateDocument(file.name, data.content, 'docx', file.name)
    } catch (err: any) {
      setError(err.message || 'Failed to upload file')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-2xl w-full"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <PenLine className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-display text-heading mb-3">
            Start a new analysis
          </h1>
          <p className="text-muted">
            Choose how you want to input your content for scoring.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-danger/10 border border-danger/20 rounded-input px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div 
            onClick={() => setInputMethod('paste')}
            className={`glass-card p-6 flex flex-col items-center text-center hover:border-accent/50 transition-colors cursor-pointer group ${
              inputMethod === 'paste' ? 'border-accent/50 bg-accent/5' : ''
            }`}
          >
            <div className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center mb-3 group-hover:text-accent transition-colors">
              <FileTextIcon className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-heading text-sm mb-1">Paste Content</h3>
            <p className="text-xs text-muted">Directly paste text</p>
          </div>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="glass-card p-6 flex flex-col items-center text-center hover:border-accent/50 transition-colors cursor-pointer group relative overflow-hidden"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="absolute inset-0 dashed-border-animated opacity-20 group-hover:opacity-50 transition-opacity" />
            <div className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center mb-3 group-hover:text-accent transition-colors relative z-10">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-heading text-sm mb-1 relative z-10">Upload DOCX</h3>
            <p className="text-xs text-muted relative z-10">Upload a file</p>
          </div>

          <div 
            onClick={() => setInputMethod('url')}
            className={`glass-card p-6 flex flex-col items-center text-center hover:border-accent/50 transition-colors cursor-pointer group ${
              inputMethod === 'url' ? 'border-accent/30 bg-accent/5' : ''
            }`}
          >
            <div className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center mb-3 text-accent shadow-glow-accent">
              <Link2 className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-heading text-sm mb-1">Enter URL</h3>
            <p className="text-xs text-muted">Fetch from web</p>
          </div>
        </div>

        {inputMethod === 'url' && (
          <div className="glass-card p-2 flex items-center gap-2">
            <div className="pl-3 text-muted">
              <Link2 className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
              placeholder="https://example.com/blog-post or Google Docs URL"
              className="flex-1 bg-transparent border-none text-body focus:outline-none focus:ring-0 text-sm"
            />
            <button 
              onClick={handleFetchUrl}
              disabled={isLoading}
              className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                'Fetch & Analyze'
              )}
            </button>
          </div>
        )}

        {inputMethod === 'paste' && (
          <div className="glass-card p-4">
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste your content here..."
              className="w-full h-48 bg-transparent border-none text-body focus:outline-none focus:ring-0 text-sm resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handlePaste}
                disabled={!pasteContent.trim()}
                className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Analyze Content
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// Batch Queue View
function BatchQueueView({ items, onOpenTab, onDeleteItem }: { items: any[]; onOpenTab: (id: string) => void; onDeleteItem: (id: string) => void }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Complete':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-green-400 border border-success/20 backdrop-blur-sm">
            <CheckCircle2 className="w-3.5 h-3.5" /> Complete
          </span>
        )
      case 'Scoring':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20 backdrop-blur-sm shadow-glow-accent">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scoring
          </span>
        )
      case 'Queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface text-muted border border-border backdrop-blur-sm">
            Queued
          </span>
        )
      case 'Error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-red-400 border border-danger/20 backdrop-blur-sm">
            <AlertCircle className="w-3.5 h-3.5" /> Error
          </span>
        )
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-success/20 text-green-400 border border-success/30'
    if (score >= 70) return 'bg-warning/20 text-orange-400 border border-warning/30'
    return 'bg-danger/20 text-red-400 border border-danger/30'
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="p-10 max-w-6xl mx-auto flex-1 flex flex-col overflow-hidden w-full"
    >
      {/* Drop Zones */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 shrink-0"
      >
        <div className="relative rounded-card p-[1px] overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 dashed-border-animated opacity-30 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-background/80 backdrop-blur-sm rounded-card p-10 flex flex-col items-center justify-center text-center m-[1px] hover:bg-surface-hover transition-colors">
            <div className="w-14 h-14 bg-surface border border-border rounded-full flex items-center justify-center mb-4 group-hover:animate-bounce-subtle">
              <FileSpreadsheet className="w-6 h-6 text-accent drop-shadow-[0_0_8px_rgba(232,69,10,0.5)]" />
            </div>
            <h3 className="text-heading font-medium mb-1 text-lg">
              Upload CSV
            </h3>
            <p className="text-sm text-muted">File must have a &apos;url&apos; column</p>
          </div>
        </div>

        <div className="relative rounded-card p-[1px] overflow-hidden group cursor-pointer">
          <div className="absolute inset-0 dashed-border-animated opacity-30 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-background/80 backdrop-blur-sm rounded-card p-10 flex flex-col items-center justify-center text-center m-[1px] hover:bg-surface-hover transition-colors">
            <div className="w-14 h-14 bg-surface border border-border rounded-full flex items-center justify-center mb-4 group-hover:animate-bounce-subtle">
              <FileTextIcon className="w-6 h-6 text-muted group-hover:text-heading" />
            </div>
            <h3 className="text-heading font-medium mb-1 text-lg">
              Drop DOCX Files
            </h3>
            <p className="text-sm text-muted">Upload multiple content files</p>
          </div>
        </div>
      </motion.div>

      {/* Queue Table */}
      <motion.div
        variants={itemVariants}
        className="glass-card flex flex-col flex-1 overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0 bg-surface">
          <h2 className="text-xl font-display text-heading">
            Documents — {items.length} {items.length === 1 ? 'item' : 'items'}
          </h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-green-400 border border-success/20">
              {items.filter(i => i.status === 'scored').length} Scored
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-muted border border-border">
              {items.filter(i => i.status === 'draft').length} Draft
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-surface backdrop-blur-md z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-muted uppercase tracking-wider w-12 border-b border-border">
                  #
                </th>
                <th className="px-4 py-4 text-xs font-medium text-muted uppercase tracking-wider w-12 border-b border-border text-center">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
                  Content URL / Title
                </th>
                <th className="px-6 py-4 text-xs font-medium text-muted uppercase tracking-wider w-32 border-b border-border">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-medium text-muted uppercase tracking-wider w-24 border-b border-border">
                  Score
                </th>
                <th className="px-6 py-4 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
                  Dimensions
                </th>
                <th className="px-6 py-4 text-xs font-medium text-muted uppercase tracking-wider text-right w-20 border-b border-border">
                  Actions
                </th>
              </tr>
            </thead>
            <motion.tbody
              variants={containerVariants}
              className="divide-y divide-border"
            >
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted">
                    No documents yet. Create one from the New Analysis tab.
                  </td>
                </tr>
              ) : items.map((item, index) => (
                <motion.tr
                  variants={itemVariants}
                  key={item.id}
                  className="hover:bg-surface-hover transition-colors group"
                >
                  <td className="px-6 py-5 text-sm text-muted font-mono tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div
                      className="flex justify-center text-muted"
                      title={item.type === 'url' ? 'URL' : 'DOCX File'}
                    >
                      {item.type === 'url' ? (
                        <Link2 className="w-4 h-4" />
                      ) : (
                        <FileTextIcon className="w-4 h-4" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div
                      className="text-sm font-medium truncate max-w-[300px] text-heading cursor-pointer hover:text-accent hover:underline transition-colors"
                      onClick={() => onOpenTab(item.id)}
                    >
                      {item.title}
                    </div>
                    {item.sourceRef && (
                      <div className="text-xs text-muted mt-1 truncate max-w-[300px]">
                        {item.sourceRef}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-5">
                    {item.overallScore ? (
                      <button
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-mono font-bold tabular-nums hover:opacity-80 transition-opacity ${getScoreColor(
                          item.overallScore
                        )}`}
                      >
                        {item.overallScore}
                      </button>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {item.dimensionScores && item.dimensionScores.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.dimensionScores.slice(0, 3).map((dim: any) => (
                          <CategoryBadge
                            key={dim.category}
                            category={dim.category}
                            variant="outline"
                          />
                        ))}
                        {item.dimensionScores.length > 3 && (
                          <span className="text-xs text-muted">+{item.dimensionScores.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 text-muted hover:text-accent transition-colors rounded hover:bg-surface"
                        title="Open in editor"
                        onClick={() => onOpenTab(item.id)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 text-muted hover:text-danger transition-colors rounded hover:bg-surface"
                        title="Delete document"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>

        {/* Bottom Status Bar */}
        {items.length > 0 && (
          <div className="p-5 border-t border-border bg-surface shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-heading font-medium">
                {items.filter(i => i.status === 'scored').length} of {items.length} scored
              </span>
              <span className="text-sm text-muted font-mono tabular-nums">
                {items.length > 0 ? Math.round((items.filter(i => i.status === 'scored').length / items.length) * 100) : 0}%
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden border border-border"
              style={{ background: 'var(--color-gauge-bg)' }}
            >
              <div
                className="h-full bg-accent rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(232,69,10,0.6)]"
                style={{ width: `${items.length > 0 ? Math.round((items.filter(i => i.status === 'scored').length / items.length) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
