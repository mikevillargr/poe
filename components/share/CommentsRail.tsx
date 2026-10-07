'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { CheckCircle2, CornerDownRight, Loader2, MessageSquarePlus, Quote, X } from 'lucide-react'
import { EventAvatar } from '@/components/home/ActivityRail'
import type { CommentAnchor, ThreadDTO, CommentDTO } from '@/lib/comments/types'
import type { Guest } from './useGuest'

// DR-021: comments on a shared article. Threads (newest first, Open / Resolved), each on a passage or the whole
// article, with replies. Guests give their name once (remembered in this browser) and can edit or delete
// their own comments. Staff resolve threads in Poe.

export interface CommentsRailProps {
  threads: ThreadDTO[]
  loading: boolean
  orphaned: Set<string>
  activeId: string | null
  onActivate: (id: string | null) => void
  /** A passage the guest just selected to comment on. */
  pending: CommentAnchor | null
  onClearPending: () => void
  guest: Guest
  onGuest: (patch: Partial<Pick<Guest, 'name' | 'email'>>) => void
  onPost: (body: string, opts: { anchor?: CommentAnchor | null; parentId?: string | null }) => Promise<void>
  onEdit: (id: string, body: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function CommentsRail(props: CommentsRailProps) {
  const { threads, loading, activeId, onActivate, pending } = props
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const open = threads.filter((t) => t.status === 'open')
  const resolved = threads.filter((t) => t.status === 'resolved')
  const list = tab === 'open' ? open : resolved

  // A thread chosen from the article (clicking a highlight) shows in its tab.
  useEffect(() => {
    const t = threads.find((x) => x.id === activeId)
    if (t) setTab(t.status === 'resolved' ? 'resolved' : 'open')
  }, [activeId, threads])

  return (
    <div className="space-y-4">
      <Composer {...props} key={pending?.quote ?? 'general'} />

      <div role="tablist" className="flex gap-4 border-b border-border">
        {(['open', 'resolved'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`pb-2 -mb-px text-sm border-b-2 ${tab === t ? 'border-accent text-heading font-medium' : 'border-transparent text-muted hover:text-heading'}`}
          >
            {t === 'open' ? 'Open' : 'Resolved'} <span className="font-mono tabular-nums text-xs text-muted">{t === 'open' ? open.length : resolved.length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-6 text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">
          {tab === 'open' ? 'No open comments. Select any text in the article to comment on it.' : 'Nothing resolved yet.'}
        </p>
      ) : (
        <ol className="space-y-3">
          {list.map((t) => (
            <Thread key={t.id} t={t} active={t.id === activeId} orphaned={props.orphaned.has(t.id)} onActivate={onActivate} rail={props} />
          ))}
        </ol>
      )}
    </div>
  )
}

const input =
  'w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-3 py-2 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'

function Composer({ pending, onClearPending, guest, onGuest, onPost }: CommentsRailProps) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  // Ask who they are once (first comment in this browser); keep the fields up while they type.
  const [askIdentity, setAskIdentity] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const needsName = askIdentity || editingName

  useEffect(() => {
    if (guest.key && !guest.name) setAskIdentity(true)
    // Only when the stored guest loads, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest.key])

  useEffect(() => {
    if (pending) ref.current?.focus()
  }, [pending])

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onPost(body, { anchor: pending })
      setBody('')
      setEditingName(false)
      setAskIdentity(false)
      onClearPending()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t post the comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${pending ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface'}`}>
      {pending ? (
        <div className="flex items-start gap-2 text-xs text-body">
          <Quote className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <span className="italic line-clamp-3 flex-1">{pending.quote}</span>
          <button type="button" onClick={onClearPending} aria-label="Comment on the whole article instead" className="text-muted hover:text-heading">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted flex items-center gap-1.5">
          <MessageSquarePlus className="w-3.5 h-3.5" /> Comment on the article, or select text to comment on a passage.
        </p>
      )}
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void submit()}
        placeholder={pending ? 'What should change here?' : 'Add a comment…'}
        rows={pending ? 3 : 2}
        maxLength={4000}
        className={`${input} resize-y`}
      />
      {needsName ? (
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={guest.name} onChange={(e) => onGuest({ name: e.target.value })} placeholder="Your name" maxLength={80} aria-label="Your name" />
          <input
            className={input}
            value={guest.email}
            onChange={(e) => onGuest({ email: e.target.value })}
            placeholder="Email (optional)"
            type="email"
            maxLength={200}
            aria-label="Email (optional)"
            title="Optional, so the team can reply by email later"
          />
        </div>
      ) : (
        <p className="text-xs text-muted">
          Commenting as <span className="text-heading">{guest.name}</span> ·{' '}
          <button type="button" onClick={() => setEditingName(true)} className="text-accent hover:underline">
            change
          </button>
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !body.trim() || !guest.name.trim()}
          className="bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-input text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Comment
        </button>
      </div>
    </div>
  )
}

function Thread({ t, active, orphaned, onActivate, rail }: { t: ThreadDTO; active: boolean; orphaned: boolean; onActivate: (id: string | null) => void; rail: CommentsRailProps }) {
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askName, setAskName] = useState(false)
  const ref = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  async function send() {
    setBusy(true)
    setError(null)
    try {
      await rail.onPost(reply, { parentId: t.id })
      setReply('')
      setReplying(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t post the reply.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      ref={ref}
      onClick={() => onActivate(active ? null : t.id)}
      className={`rounded-xl border p-3 cursor-pointer transition-colors ${active ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface hover:border-accent/30'}`}
    >
      {t.anchor && (
        <p className={`mb-2 text-xs border-l-2 pl-2 ${orphaned ? 'border-border text-muted' : 'border-accent/50 text-body'}`}>
          {orphaned ? <span className="not-italic">On text that has since changed: </span> : null}
          <span className="italic line-clamp-2">“{t.anchor.quote}”</span>
        </p>
      )}
      <Comment c={t} rail={rail} />
      {t.replies.length > 0 && (
        <ol className="mt-2 space-y-2 border-l border-border pl-3">
          {t.replies.map((r) => (
            <li key={r.id}>
              <Comment c={r} rail={rail} />
            </li>
          ))}
        </ol>
      )}
      {t.status === 'resolved' && (
        <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved{t.resolvedBy ? ` by ${t.resolvedBy}` : ''}
        </p>
      )}
      <div onClick={(e) => e.stopPropagation()}>
        <AnimatePresence initial={false}>
          {replying ? (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 space-y-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && void send()}
                  rows={2}
                  maxLength={4000}
                  autoFocus
                  placeholder={rail.guest.name ? `Reply as ${rail.guest.name}…` : 'Reply…'}
                  className={`${input} resize-y`}
                />
                {askName && (
                  <input className={input} value={rail.guest.name} onChange={(e) => rail.onGuest({ name: e.target.value })} placeholder="Your name" maxLength={80} aria-label="Your name" />
                )}
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReplying(false)} className="text-xs text-muted hover:text-heading px-2">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={busy || !reply.trim() || !rail.guest.name.trim()}
                    className="bg-accent hover:bg-accent/90 text-white px-3 py-1 rounded-input text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-3 h-3 animate-spin" />} Reply
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAskName(!rail.guest.name)
                setReplying(true)
              }}
              className="mt-2 text-xs text-accent hover:underline inline-flex items-center gap-1">
              <CornerDownRight className="w-3 h-3" /> Reply
            </button>
          )}
        </AnimatePresence>
      </div>
    </li>
  )
}

function Comment({ c, rail }: { c: CommentDTO; rail: CommentsRailProps }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(c.body)
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <EventAvatar name={c.author.name} image={c.author.image} />
        <span className="text-heading font-medium truncate">{c.author.name}</span>
        {c.author.kind === 'staff' && <span className="text-[10px] uppercase tracking-wider text-accent border border-accent/30 rounded-full px-1.5">Team</span>}
        <span className="text-xs text-muted ml-auto shrink-0">{formatDistanceToNowStrict(new Date(c.createdAt), { addSuffix: true })}</span>
      </div>
      {editing ? (
        <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} className={`${input} resize-y`} />
          <div className="flex justify-end gap-2 text-xs">
            <button type="button" onClick={() => setEditing(false)} className="text-muted hover:text-heading">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void rail.onEdit(c.id, text).then(() => setEditing(false))}
              disabled={!text.trim()}
              className="text-accent font-medium disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-body whitespace-pre-wrap break-words">
          {c.body}
          {c.editedAt && <span className="text-xs text-muted"> (edited)</span>}
        </p>
      )}
      {c.mine && !editing && (
        <div className="mt-1 flex gap-3 text-xs text-muted" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setEditing(true)} className="hover:text-heading">
            Edit
          </button>
          <button type="button" onClick={() => void rail.onDelete(c.id)} className="hover:text-red-500">
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
