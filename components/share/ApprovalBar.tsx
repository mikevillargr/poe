'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import { CheckCircle2, Loader2, MessageSquare, PencilLine, X } from 'lucide-react'
import type { Decision } from '@/lib/comments/types'
import type { Guest } from './useGuest'
import { guestFetch } from './useGuest'

// DR-021: the sign-off bar on a shared page: Approve or Request changes (with a note). The decision is
// recorded in the article's History and the owner is notified; it never changes the article's status.

const input =
  'w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-3 py-2 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'

export function ApprovalBar({
  token,
  decision,
  onDecision,
  guest,
  onGuest,
  ownerName,
  commentCount,
  onOpenComments,
}: {
  token: string
  decision: Decision | null
  onDecision: (d: Decision) => void
  guest: Guest
  onGuest: (patch: Partial<Pick<Guest, 'name' | 'email'>>) => void
  ownerName: string | null
  /** Shown on phones, where comments open in a drawer. Null when comments are off. */
  commentCount: number | null
  onOpenComments: () => void
}) {
  const [asking, setAsking] = useState<Decision['decision'] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanks, setThanks] = useState(false)

  async function submit() {
    if (!asking) return
    setBusy(true)
    setError(null)
    try {
      const r = await guestFetch<{ decision: Decision }>(`/api/public/shares/${token}/review`, guest.key, {
        method: 'POST',
        body: { decision: asking, name: guest.name, note: note.trim() || undefined },
      })
      onDecision(r.decision)
      setAsking(null)
      setNote('')
      setThanks(true)
      setTimeout(() => setThanks(false), 6000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t send that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[calc(100vw-2rem)] max-w-[620px]">
        <div className="glass-card bg-surface/95 backdrop-blur-md shadow-xl px-3 py-2 flex items-center gap-2">
          <div className="min-w-0 flex-1 text-sm px-1">
            {thanks ? (
              <span className="text-heading">Thanks, {ownerName ?? 'the team'} has been notified.</span>
            ) : decision ? (
              <span className={`inline-flex items-center gap-1.5 truncate ${decision.decision === 'approved' ? 'text-green-600' : 'text-orange-500'}`}>
                {decision.decision === 'approved' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <PencilLine className="w-4 h-4 shrink-0" />}
                <span className="truncate">
                  {decision.decision === 'approved' ? 'Approved' : 'Changes requested'} by {decision.name} · {format(new Date(decision.at), 'MMM d')}
                </span>
              </span>
            ) : (
              <span className="text-muted truncate block">Happy with this article?</span>
            )}
          </div>
          {commentCount !== null && (
            <button
              type="button"
              onClick={onOpenComments}
              className="lg:hidden shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-input border border-border text-sm text-heading"
              aria-label="Comments"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="font-mono tabular-nums text-xs">{commentCount}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setAsking('changes_requested')}
            className="shrink-0 px-3 py-1.5 rounded-input border border-border text-sm text-heading hover:bg-surface-hover whitespace-nowrap"
          >
            <span className="hidden sm:inline">Request changes</span>
            <span className="sm:hidden">Changes</span>
          </button>
          <button
            type="button"
            onClick={() => setAsking('approved')}
            className="shrink-0 px-3 py-1.5 rounded-input bg-accent hover:bg-accent/90 text-white text-sm font-medium whitespace-nowrap"
          >
            Approve
          </button>
        </div>
      </div>

      <AnimatePresence>
        {asking && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: 'var(--color-modal-backdrop)' }}
              onClick={() => setAsking(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={asking === 'approved' ? 'Approve this article' : 'Request changes'}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 30 } }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="relative glass-card bg-surface w-full max-w-[440px] p-6 space-y-3"
              onKeyDown={(e) => e.key === 'Escape' && setAsking(null)}
            >
              <div className="flex items-start gap-2">
                <h2 className="font-display text-xl text-heading flex-1">{asking === 'approved' ? 'Approve this article' : 'Request changes'}</h2>
                <button type="button" onClick={() => setAsking(null)} aria-label="Close" className="p-1 text-muted hover:text-heading">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted">
                {asking === 'approved'
                  ? `${ownerName ?? 'The team'} will be told it’s good to go.`
                  : 'Say what should change. For specific passages, you can also select the text and comment on it.'}
              </p>
              <input className={input} value={guest.name} onChange={(e) => onGuest({ name: e.target.value })} placeholder="Your name" maxLength={80} aria-label="Your name" />
              <textarea
                className={`${input} resize-y`}
                rows={asking === 'approved' ? 2 : 4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                autoFocus
                placeholder={asking === 'approved' ? 'Anything to add? (optional)' : 'What should change?'}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAsking(null)} className="px-4 py-2 text-sm text-muted hover:text-heading">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !guest.name.trim() || (asking === 'changes_requested' && !note.trim())}
                  className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {asking === 'approved' ? 'Approve' : 'Send request'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
