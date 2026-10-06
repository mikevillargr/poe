'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, ChevronDown, MoreHorizontal, Search, Send, CheckCircle2, Undo2, FileText, Trash2, PanelLeft, PanelRight, Sparkles, Loader2 } from 'lucide-react'
import { StatusPill } from '@/components/home/StatusPill'
import { ARTICLE_STATUS_LABELS, ARTICLE_STATUSES, canTransition, type ArticleStatus } from '@/lib/articles/schemas'
import type { WorkspaceArticle } from './types'
import { hasResearch } from './types'

const PREV: Partial<Record<ArticleStatus, ArticleStatus>> = { draft: 'queued', in_review: 'draft', done: 'in_review' }

export type PrimaryAction = 'research' | 'generate' | 'review' | 'done' | null

/** DR-005: the primary action follows the status (Queued → Run research, Draft → Send to review, In Review → Mark done). */
export function primaryActionFor(a: WorkspaceArticle): PrimaryAction {
  // Templated articles go straight to Generate (a template's research step is optional and built in).
  if (a.status === 'queued') return a.templateId || hasResearch(a) ? 'generate' : 'research'
  if (a.status === 'draft') return 'review'
  if (a.status === 'in_review') return 'done'
  return null
}

const PRIMARY_META = {
  research: { label: 'Run research', icon: Search },
  generate: { label: 'Generate draft', icon: Sparkles },
  review: { label: 'Send to review', icon: Send },
  done: { label: 'Mark done', icon: CheckCircle2 },
} as const

export function WorkspaceHeader({
  clientSlug,
  article,
  busy,
  statusSaving,
  showBriefToggle,
  showOptimizeToggle,
  briefOpen,
  optimizeOpen,
  onToggleBrief,
  onToggleOptimize,
  onTitleChange,
  onPrimary,
  onMoveBack,
  onChangeStatus,
  onExportDocx,
  onExportDrive,
  onDelete,
}: {
  clientSlug: string
  article: WorkspaceArticle
  busy: boolean
  statusSaving: boolean
  showBriefToggle: boolean
  showOptimizeToggle: boolean
  briefOpen: boolean
  optimizeOpen: boolean
  onToggleBrief: () => void
  onToggleOptimize: () => void
  onTitleChange: (title: string) => void
  onPrimary: (action: Exclude<PrimaryAction, null>) => void
  onMoveBack: (to: ArticleStatus) => void
  onChangeStatus: (to: ArticleStatus) => void
  onExportDocx: () => void
  onExportDrive: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(article.title)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statusOpen) return
    const onDown = (e: MouseEvent) => {
      if (!statusRef.current?.contains(e.target as Node)) setStatusOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setStatusOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [statusOpen])

  useEffect(() => setTitle(article.title), [article.title])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  function commitTitle() {
    const t = title.trim()
    if (!t) return setTitle(article.title)
    if (t !== article.title) onTitleChange(t)
  }

  const action = primaryActionFor(article)
  const meta = action ? PRIMARY_META[action] : null
  const prev = PREV[article.status]
  const hasDraft = !!article.draftHtml

  const item = 'w-full text-left px-3 py-2 text-sm flex items-center gap-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <header className="relative z-40 h-16 shrink-0 border-b border-border bg-surface/80 backdrop-blur-md px-4 flex items-center gap-3">
      <Link
        href={`/c/${clientSlug}`}
        className="p-2 rounded-input text-muted hover:text-heading hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-sm"
        title="Back to Home"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden min-[1200px]:inline">Home</span>
      </Link>
      {showBriefToggle && (
        <button
          type="button"
          onClick={onToggleBrief}
          aria-pressed={briefOpen}
          className={`p-2 rounded-input transition-colors flex items-center gap-1.5 text-sm ${briefOpen ? 'bg-accent/10 text-accent' : 'text-muted hover:text-heading hover:bg-surface-hover'}`}
          title="Brief"
        >
          <PanelLeft className="w-4 h-4" />
          Brief
        </button>
      )}
      <div className="w-px h-6 bg-border" />

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setTitle(article.title)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        maxLength={300}
        aria-label="Article title"
        className="flex-1 min-w-0 bg-transparent text-lg font-display text-heading truncate rounded-input px-2 py-1 border border-transparent hover:border-border focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
      />
      <div className="relative" ref={statusRef}>
        <button
          type="button"
          onClick={() => setStatusOpen((o) => !o)}
          disabled={busy || statusSaving}
          aria-haspopup="menu"
          aria-expanded={statusOpen}
          aria-label={`Status: ${ARTICLE_STATUS_LABELS[article.status]}. Change status`}
          className="flex items-center gap-1 rounded-full disabled:opacity-60"
        >
          <StatusPill status={article.status} />
          <ChevronDown className="w-3.5 h-3.5 text-muted -ml-0.5" />
        </button>
        <AnimatePresence>
          {statusOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              className="absolute left-0 top-full mt-2 w-56 glass-card bg-surface shadow-2xl p-1.5 z-40"
            >
              {ARTICLE_STATUSES.map((s) => {
                const current = s === article.status
                const allowed = canTransition(article.status, s)
                return (
                  <button
                    key={s}
                    type="button"
                    role="menuitemradio"
                    aria-checked={current}
                    disabled={current || !allowed}
                    title={!current && !allowed ? 'Statuses change one step at a time' : undefined}
                    onClick={() => {
                      setStatusOpen(false)
                      onChangeStatus(s)
                    }}
                    className={`${item} ${current ? 'text-heading' : 'text-body hover:bg-surface-hover'}`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center">{current && <Check className="w-4 h-4 text-accent" />}</span>
                    {ARTICLE_STATUS_LABELS[s]}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {meta && action && (
        <button
          type="button"
          onClick={() => onPrimary(action)}
          disabled={busy || statusSaving}
          className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all hover:shadow-glow-accent-strong disabled:opacity-50 whitespace-nowrap"
        >
          {statusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <meta.icon className="w-4 h-4" />}
          {meta.label}
        </button>
      )}

      {showOptimizeToggle && (
        <button
          type="button"
          onClick={onToggleOptimize}
          aria-pressed={optimizeOpen}
          className={`p-2 rounded-input transition-colors flex items-center gap-1.5 text-sm ${optimizeOpen ? 'bg-accent/10 text-accent' : 'text-muted hover:text-heading hover:bg-surface-hover'}`}
          title="Optimize"
        >
          <PanelRight className="w-4 h-4" />
          Optimize
        </button>
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More actions"
          className="p-2 rounded-input text-muted hover:text-heading hover:bg-surface-hover transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              className="absolute right-0 top-full mt-2 w-60 glass-card bg-surface shadow-2xl p-1.5 z-40"
            >
              {prev && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy || statusSaving}
                  onClick={() => {
                    setMenuOpen(false)
                    onMoveBack(prev)
                  }}
                  className={`${item} text-body hover:bg-surface-hover`}
                >
                  <Undo2 className="w-4 h-4 text-muted" /> Move back to {ARTICLE_STATUS_LABELS[prev]}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={!hasDraft || busy}
                onClick={() => {
                  setMenuOpen(false)
                  onExportDocx()
                }}
                className={`${item} text-body hover:bg-surface-hover`}
              >
                <FileText className="w-4 h-4 text-muted" /> Export DOCX
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!hasDraft || busy}
                onClick={() => {
                  setMenuOpen(false)
                  onExportDrive()
                }}
                className={`${item} text-body hover:bg-surface-hover`}
              >
                <svg className="w-4 h-4" viewBox="0 0 87.3 78" aria-hidden="true">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                </svg>
                Export to Google Docs
              </button>
              <div className="h-px bg-border my-1" />
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                className={`${item} text-red-400 hover:bg-danger/10`}
              >
                <Trash2 className="w-4 h-4" /> Delete article
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
