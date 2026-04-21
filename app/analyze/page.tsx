'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
} from 'lucide-react'
import Link from 'next/link'
import { ScoreGauge } from '@/components/ScoreGauge'
import { CategoryBadge, CategoryType } from '@/components/CategoryBadge'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'

interface DocumentTab {
  id: string
  title: string
  type: 'url' | 'docx' | 'new'
  score?: number
}

interface Suggestion {
  id: string
  category: 'Brand' | 'SEO' | 'Blacklist' | 'Agency' | 'Client'
  severity: 'high' | 'medium' | 'low'
  title: string
  original: string
  suggested: string
  accepted: boolean | null
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

const SUGGESTIONS: Suggestion[] = [
  {
    id: '1',
    category: 'SEO',
    severity: 'high',
    title: 'H2 missing question format for PAA capture',
    original: 'Appointing a Registered Agent',
    suggested: 'How Do I Appoint a Registered Agent in Nevada?',
    accepted: null,
  },
  {
    id: '2',
    category: 'Brand',
    severity: 'medium',
    title: 'Opening lacks a stat-led hook per brand guidelines',
    original: 'Forming an LLC in Nevada offers significant benefits...',
    suggested: 'According to the Nevada Secretary of State, over 78,000 LLCs were formed in 2023 alone...',
    accepted: null,
  },
  {
    id: '3',
    category: 'Blacklist',
    severity: 'high',
    title: 'Blacklisted competitor mentioned: LegalZoom',
    original: 'Many entrepreneurs choose to use a commercial service like LegalZoom...',
    suggested: 'Many entrepreneurs choose to use a commercial registered agent service...',
    accepted: null,
  },
  {
    id: '4',
    category: 'Agency',
    severity: 'low',
    title: 'Missing authoritative source citation',
    original: 'The process requires careful attention to detail...',
    suggested: 'According to Nevada Revised Statutes (NRS) 86.241, the process requires...',
    accepted: null,
  },
]

const DIMENSIONS = [
  { category: 'Brand', score: 82, status: 'pass' },
  { category: 'SEO', score: 61, status: 'fail' },
  { category: 'Blacklist', score: 100, status: 'pass' },
  { category: 'Agency', score: 70, status: 'pass' },
  { category: 'Client', score: 68, status: 'fail' },
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
  const [tabs, setTabs] = useState<DocumentTab[]>([
    {
      id: '1',
      title: 'Nevada LLC Formation Guide',
      type: 'url',
      score: 74,
    },
  ])
  const [activeTabId, setActiveTabId] = useState<string>('1')
  const [activeFilter, setActiveFilter] = useState<string>('All')

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

  const handleOpenBatchItem = (batchItemId: string) => {
    const item = BATCH_ITEMS.find((b) => b.id === batchItemId)
    if (!item) return

    // Check if tab already exists for this item
    const existingTab = tabs.find((t) => t.id === batchItemId)
    if (existingTab) {
      setActiveTabId(batchItemId)
      return
    }

    // Create new tab from batch item
    const newTab: DocumentTab = {
      id: batchItemId,
      title: item.title,
      type: 'url',
      score: item.score,
    }
    setTabs([...tabs, newTab])
    setActiveTabId(batchItemId)
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
            <BatchQueueView onOpenTab={handleOpenBatchItem} />
          ) : activeTab?.type === 'new' ? (
            <BlankCanvasView />
          ) : (
            <EditorView
              tab={activeTab}
              suggestions={filteredSuggestions}
              dimensions={DIMENSIONS}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          )}
        </div>
      </motion.div>
    </PageErrorBoundary>
  )
}

// Blank Canvas View
function BlankCanvasView() {
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-6 flex flex-col items-center text-center hover:border-accent/50 transition-colors cursor-pointer group">
            <div className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center mb-3 group-hover:text-accent transition-colors">
              <FileTextIcon className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-heading text-sm mb-1">Paste Content</h3>
            <p className="text-xs text-muted">Directly paste text</p>
          </div>

          <div className="glass-card p-6 flex flex-col items-center text-center hover:border-accent/50 transition-colors cursor-pointer group relative overflow-hidden">
            <div className="absolute inset-0 dashed-border-animated opacity-20 group-hover:opacity-50 transition-opacity" />
            <div className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center mb-3 group-hover:text-accent transition-colors relative z-10">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-heading text-sm mb-1 relative z-10">Drop DOCX</h3>
            <p className="text-xs text-muted relative z-10">Upload a file</p>
          </div>

          <div className="glass-card p-6 flex flex-col items-center text-center border-accent/30 bg-accent/5 cursor-pointer group">
            <div className="w-10 h-10 bg-surface border border-border rounded-full flex items-center justify-center mb-3 text-accent shadow-glow-accent">
              <Link2 className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-heading text-sm mb-1">Enter URL</h3>
            <p className="text-xs text-muted">Fetch from web</p>
          </div>
        </div>

        <div className="glass-card p-2 flex items-center gap-2">
          <div className="pl-3 text-muted">
            <Link2 className="w-5 h-5" />
          </div>
          <input
            type="text"
            placeholder="https://example.com/blog-post"
            className="flex-1 bg-transparent border-none text-body focus:outline-none focus:ring-0 text-sm"
          />
          <button className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent">
            Fetch & Score
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Editor View
function EditorView({
  tab,
  suggestions,
  dimensions,
  activeFilter,
  onFilterChange
}: {
  tab: DocumentTab | undefined,
  suggestions: typeof SUGGESTIONS,
  dimensions: typeof DIMENSIONS,
  activeFilter: string,
  onFilterChange: (filter: string) => void
}) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT: Content Editor (55%) */}
      <div
        className="w-[55%] flex flex-col border-r border-border relative"
        style={{ background: 'var(--color-editor-bg)' }}
      >
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
          <div className="absolute left-0 top-10 bottom-0 w-8 flex flex-col items-end pr-2 text-[10px] font-mono select-none pointer-events-none space-y-6 leading-relaxed pt-14 opacity-20">
            {Array.from({ length: 20 }).map((_, i) => (
              <span key={i} className="text-muted">{i + 1}</span>
            ))}
          </div>

          <div className="max-w-2xl mx-auto pl-6">
            <h1 className="text-4xl font-display text-heading mb-8">
              {tab?.title || 'Untitled Document'}
            </h1>

            <div className="text-body text-lg leading-relaxed space-y-6 font-serif">
              <p>
                <span className="border-b-2 border-dashed border-danger bg-danger/10 text-heading">
                  Forming an LLC in Nevada offers significant benefits for
                  business owners
                </span>
                , including strong asset protection and tax advantages. However,
                the process requires careful attention to detail to ensure full
                compliance with state regulations.
              </p>

              <h2 className="text-heading text-2xl font-display mt-10 mb-4">
                <span className="bg-accent/10 border-b-2 border-dashed border-accent text-heading relative">
                  Appointing a Registered Agent
                  <span className="absolute -left-4 top-0 bottom-0 w-[3px] bg-accent rounded-full shadow-glow-accent" />
                </span>
              </h2>

              <p>
                Every Nevada LLC must have a registered agent with a physical
                address in the state. Many entrepreneurs choose to use a
                commercial service like{' '}
                <span className="bg-danger/20 text-danger font-medium px-1 rounded border border-danger/30">
                  LegalZoom
                </span>{' '}
                to handle this requirement, though you can also act as your own
                agent if you reside in Nevada and maintain regular business
                hours.
              </p>

              <p>
                Once your agent is selected,{' '}
                <span className="border-b-2 border-dashed border-warning bg-warning/10 text-heading">
                  your Articles of Organization should be filed with the
                  Secretary of State
                </span>
                . This document officially creates your business entity and must
                include specific information about your company's management
                structure.
              </p>
            </div>
          </div>
        </div>

        <div className="h-12 border-t border-border bg-surface backdrop-blur-md flex items-center justify-between px-6 shrink-0 text-xs text-muted font-mono">
          <div className="flex items-center gap-6">
            <span className="tabular-nums">342 words</span>
            <span className="tabular-nums">2,184 characters</span>
            <span>Readability: Grade 9</span>
          </div>
          <div>Last saved: 2 mins ago</div>
        </div>
      </div>

      {/* CENTER: Suggestions (25%) */}
      <div className="w-[25%] flex flex-col border-r border-border bg-background">
        <div className="p-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading font-display text-lg flex items-center gap-2">
              Suggestions
              <span className="bg-surface text-muted px-2 py-0.5 rounded-full text-xs font-mono border border-border">
                {suggestions.length}
              </span>
            </h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {['All', 'Brand', 'SEO', 'Blacklist'].map((filter) => (
              <button
                key={filter}
                onClick={() => onFilterChange(filter)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeFilter === filter ? 'bg-accent text-white shadow-glow-accent' : 'bg-surface text-muted hover:text-body border border-border'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="glass-card p-4 relative overflow-hidden" style={{ background: 'var(--color-card-bg)' }}>
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                suggestion.category === 'Brand' ? 'bg-badge-brand' :
                suggestion.category === 'SEO' ? 'bg-badge-seo' :
                suggestion.category === 'Blacklist' ? 'bg-badge-blacklist' :
                suggestion.category === 'Agency' ? 'bg-badge-agency' :
                'bg-badge-client'
              } shadow-glow-accent`} />

              <div className="flex items-center justify-between mb-3">
                <CategoryBadge category={suggestion.category} variant="solid" />
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

              <div className="flex items-center gap-2">
                <button className="flex-1 bg-success/20 hover:bg-success/30 text-green-400 py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-success/30">
                  <Check className="w-3.5 h-3.5" /> Accept
                </button>
                <button className="flex-1 bg-surface border border-border hover:bg-surface-hover text-muted py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  <X className="w-3.5 h-3.5" /> Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Score Summary (20%) */}
      <div className="w-[20%] bg-background flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-surface to-transparent pointer-events-none opacity-30" />

        <div className="p-8 border-b border-border flex flex-col items-center justify-center shrink-0 relative z-10">
          <h2 className="text-sm font-medium text-muted mb-8 w-full text-left uppercase tracking-wider text-[10px]">
            Overall Score
          </h2>
          <ScoreGauge score={tab?.score || 74} size={160} />
          <p className="text-xs text-muted mt-8 font-mono">
            32 rules evaluated
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <h3 className="text-sm font-medium text-heading mb-6 font-display">
            Dimension Breakdown
          </h3>
          <div className="space-y-6">
            {dimensions.map((dim) => (
              <div key={dim.category}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-body">{dim.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-heading tabular-nums">
                      {dim.score}
                    </span>
                    {dim.status === 'pass' ? (
                      <span className="text-success text-xs">✓</span>
                    ) : (
                      <span className="text-warning text-xs">⚠</span>
                    )}
                  </div>
                </div>
                <div
                  className="h-1 w-full rounded-full overflow-hidden"
                  style={{ background: 'var(--color-gauge-bg)' }}
                >
                  <div
                    className={`h-full rounded-full shadow-[0_0_8px_rgba(232,69,10,0.5)] ${
                      dim.category === 'Brand' ? 'bg-badge-brand' :
                      dim.category === 'SEO' ? 'bg-badge-seo' :
                      dim.category === 'Blacklist' ? 'bg-badge-blacklist' :
                      dim.category === 'Agency' ? 'bg-badge-agency' :
                      'bg-badge-client'
                    }`}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-border shrink-0 space-y-3 bg-surface">
          <button className="w-full bg-accent hover:bg-accent/90 text-white py-2.5 rounded-input text-sm font-medium transition-all hover:shadow-glow-accent">
            Re-Score Content
          </button>
          <button className="w-full bg-transparent border border-border hover:bg-surface-hover text-heading py-2.5 rounded-input text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>
    </div>
  )
}

// Batch Queue View
function BatchQueueView({ onOpenTab }: { onOpenTab: (id: string) => void }) {
  const getStatusBadge = (status: BatchItem['status']) => {
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
            <p className="text-sm text-muted">File must have a 'url' column</p>
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
            Batch Queue — 7 items
          </h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-green-400 border border-success/20">
              3 Complete
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20 shadow-glow-accent">
              2 Scoring
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-muted border border-border">
              2 Queued/Error
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
              {BATCH_ITEMS.map((item, index) => (
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
                      className={`text-sm font-medium truncate max-w-[300px] transition-colors ${
                        item.status === 'Complete'
                          ? 'text-heading cursor-pointer hover:text-accent hover:underline'
                          : 'text-heading'
                      }`}
                      onClick={() =>
                        item.status === 'Complete' && onOpenTab(item.id)
                      }
                    >
                      {item.title}
                    </div>
                    {item.errorMsg && (
                      <div className="text-xs text-red-400 mt-1">
                        {item.errorMsg}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-5">
                    {item.score ? (
                      <button
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-mono font-bold tabular-nums hover:opacity-80 transition-opacity ${getScoreColor(
                          item.score
                        )}`}
                      >
                        {item.score}
                      </button>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {item.dimensions ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.dimensions.map((dim) => (
                          <CategoryBadge
                            key={dim}
                            category={dim}
                            variant="outline"
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.status === 'Complete' && (
                        <button
                          className="p-1.5 text-muted hover:text-accent transition-colors rounded hover:bg-surface"
                          title="Open in editor"
                          onClick={() => onOpenTab(item.id)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(item.status === 'Complete' ||
                        item.status === 'Error') && (
                        <button
                          className="p-1.5 text-muted hover:text-accent transition-colors rounded hover:bg-surface"
                          title={item.status === 'Error' ? 'Retry' : 'Re-score'}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        className="p-1.5 text-muted hover:text-danger transition-colors rounded hover:bg-surface"
                        title="Remove from queue"
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
        <div className="p-5 border-t border-border bg-surface shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-heading font-medium">
              3 of 7 complete · 2 scoring · 2 queued/error
            </span>
            <span className="text-sm text-muted font-mono tabular-nums">
              43%
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full overflow-hidden border border-border"
            style={{ background: 'var(--color-gauge-bg)' }}
          >
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(232,69,10,0.6)]"
              style={{ width: '43%' }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
