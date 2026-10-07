'use client'

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { CheckCircle2, Loader2, MessageSquare, PencilLine, RotateCcw, X } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { EventAvatar } from '@/components/home/ActivityRail'
import type { CommentDTO, Decision, ThreadDTO } from '@/lib/comments/types'

// DR-021: comments from a shared link, inside Poe. Staff read the threads, jump to the quoted passage in the
// editor, reply as the team, and resolve or reopen them. The latest client decision sits on top.

export function CommentsPanel({
  open,
  onClose,
  base,
  refreshKey,
  onCount,
  onShowQuote,
}: {
  open: boolean
  onClose: () => void
  /** `/api/clients/:id/articles/:id` */
  base: string
  refreshKey: string
  /** Open thread count, for the header badge. */
  onCount: (n: number) => void
  /** Highlights the quoted passage in the editor; returns whether it was found. */
  onShowQuote: (quote: string) => boolean
}) {
  const [data, setData] = useState<{ threads: ThreadDTO[]; decision: Decision | null } | null>(null)
  const [tab, setTab] = useState<'open' | 'resolved'>('open')

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ threads: ThreadDTO[]; decision: Decision | null }>(`${base}/comments`, { silent: true })
      setData(r)
      onCount(r.threads.filter((t) => t.status === 'open').length)
    } catch {
      setData((d) => d ?? { threads: [], decision: null })
    }
  }, [base, onCount])

  // Badge on load; refresh while open (comments arrive from outside).
  useEffect(() => {
    void load()
  }, [load, refreshKey])
  useEffect(() => {
    if (!open) return
    void load()
    const t = setInterval(() => void load(), 30_000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, load, onClose])

  const threads = data?.threads ?? []
  const list = threads.filter((t) => t.status === tab)

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="Comments"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed top-4 right-4 bottom-4 z-50 w-[440px] max-w-[calc(100vw-2rem)] glass-card bg-surface shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="px-5 pt-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <h2 className="text-base font-display text-heading flex-1">Comments</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted mt-1">From people viewing the share link, and replies from the team.</p>
            <div role="tablist" className="flex gap-4 mt-2 -mb-px">
              {(['open', 'resolved'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`pb-2 text-sm border-b-2 ${tab === t ? 'border-accent text-heading font-medium' : 'border-transparent text-muted hover:text-heading'}`}
                >
                  {t === 'open' ? 'Open' : 'Resolved'}{' '}
                  <span className="font-mono tabular-nums text-xs text-muted">{threads.filter((x) => x.status === t).length}</span>
                </button>
              ))}
            </div>
          </div>

          {data?.decision && (
            <div className={`mx-5 mt-4 rounded-input border px-3 py-2 text-sm ${data.decision.decision === 'approved' ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'}`}>
              <p className={`flex items-center gap-1.5 font-medium ${data.decision.decision === 'approved' ? 'text-green-600' : 'text-orange-500'}`}>
                {data.decision.decision === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : <PencilLine className="w-4 h-4" />}
                {data.decision.decision === 'approved' ? 'Approved' : 'Changes requested'} by {data.decision.name}
                <span className="ml-auto text-xs text-muted font-normal">{format(new Date(data.decision.at), 'MMM d, h:mm a')}</span>
              </p>
              {data.decision.note && <p className="mt-1 text-body whitespace-pre-wrap">{data.decision.note}</p>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {!data ? (
              <div className="flex justify-center py-10 text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-sm text-muted text-center py-10 px-6">
                {tab === 'open' ? 'No open comments. Share the article from the header to collect feedback.' : 'Nothing resolved yet.'}
              </p>
            ) : (
              <ol className="space-y-3">
                {list.map((t) => (
                  <StaffThread key={t.id} t={t} base={base} onChanged={load} onShowQuote={onShowQuote} />
                ))}
              </ol>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function StaffThread({ t, base, onChanged, onShowQuote }: { t: ThreadDTO; base: string; onChanged: () => Promise<void>; onShowQuote: (q: string) => boolean }) {
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState<'reply' | 'status' | null>(null)
  const [missing, setMissing] = useState(false)

  async function send() {
    setBusy('reply')
    try {
      await apiFetch(`${base}/comments`, { method: 'POST', body: { body: reply, parentId: t.id }, errorTitle: 'Couldn’t send the reply' })
      setReply('')
      await onChanged()
    } catch {
      // toasted
    } finally {
      setBusy(null)
    }
  }

  async function setStatus(status: 'open' | 'resolved') {
    setBusy('status')
    try {
      await apiFetch(`${base}/comments/${t.id}`, { method: 'PATCH', body: { status }, errorTitle: 'Couldn’t update the comment' })
      await onChanged()
    } catch {
      // toasted
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="rounded-xl border border-border p-3 space-y-2">
      {t.anchor && (
        <button
          type="button"
          onClick={() => setMissing(!onShowQuote(t.anchor!.quote))}
          className="w-full text-left text-xs border-l-2 border-accent/50 pl-2 text-body hover:text-heading"
          title="Show this passage in the draft"
        >
          <span className="italic line-clamp-2">“{t.anchor.quote}”</span>
          {missing && <span className="block not-italic text-muted mt-0.5">This passage isn’t in the draft any more.</span>}
        </button>
      )}
      <StaffComment c={t} />
      {t.replies.length > 0 && (
        <ol className="space-y-2 border-l border-border pl-3">
          {t.replies.map((r) => (
            <li key={r.id}>
              <StaffComment c={r} />
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && reply.trim() && void send()}
          rows={1}
          maxLength={4000}
          placeholder="Reply as the team…"
          className="flex-1 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-2.5 py-1.5 text-sm text-heading placeholder-muted resize-y focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!reply.trim() || !!busy}
          className="bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-input text-sm font-medium disabled:opacity-50"
        >
          {busy === 'reply' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reply'}
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {t.status === 'resolved' ? (
          <>
            <span className="text-green-600 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Resolved{t.resolvedBy ? ` by ${t.resolvedBy}` : ''}
            </span>
            <button type="button" onClick={() => void setStatus('open')} disabled={!!busy} className="ml-auto text-muted hover:text-heading inline-flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reopen
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void setStatus('resolved')}
            disabled={!!busy}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-success/40 text-green-600 px-2.5 py-1 hover:bg-success/10 disabled:opacity-50"
          >
            {busy === 'status' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Resolve
          </button>
        )}
      </div>
    </li>
  )
}

function StaffComment({ c }: { c: CommentDTO }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <EventAvatar name={c.author.name} image={c.author.image} />
        <span className="text-heading font-medium truncate">{c.author.name}</span>
        <span className={`text-[10px] uppercase tracking-wider rounded-full px-1.5 border ${c.author.kind === 'staff' ? 'text-accent border-accent/30' : 'text-muted border-border'}`}>
          {c.author.kind === 'staff' ? 'Team' : 'Guest'}
        </span>
        <span className="text-xs text-muted ml-auto shrink-0">{formatDistanceToNowStrict(new Date(c.createdAt), { addSuffix: true })}</span>
      </div>
      <p className="mt-1 text-body whitespace-pre-wrap break-words">
        {c.body}
        {c.editedAt && <span className="text-xs text-muted"> (edited)</span>}
      </p>
    </div>
  )
}
