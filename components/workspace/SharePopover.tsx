'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, Copy, ExternalLink, Eye, Link2, Loader2, RefreshCw, Share2, Unlink } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import type { ShareDTO } from '@/lib/shares/repo'

// DR-021: share an article (any status) as a private link: create, copy, choose what it shows, reset or turn off.

type Toggle = 'showComments' | 'showRules' | 'showHistory'
const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: 'showComments', label: 'Comments', hint: 'Viewers can comment on the article or a passage' },
  { key: 'showRules', label: 'Guidelines', hint: 'The rules behind the score' },
  { key: 'showHistory', label: 'Full history', hint: 'Every step, by person' },
]

export function SharePopover({ base }: { base: string }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState<ShareDTO | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState<'reset' | 'revoke' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const url = share ? `${typeof window !== 'undefined' ? window.location.origin : ''}${share.path}` : ''

  useEffect(() => {
    if (!open) return
    apiFetch<{ share: ShareDTO | null }>(`${base}/share`, { errorTitle: 'Couldn’t load the share link' })
      .then((r) => setShare(r.share))
      .catch(() => setShare(null))
    const onDown = (e: MouseEvent) => {
      if (!confirm && !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirm && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, base, confirm])

  async function copy(link = url) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Couldn’t copy', 'Select the link and copy it instead.')
    }
  }

  async function create(reset = false) {
    setBusy(true)
    try {
      const r = await apiFetch<{ share: ShareDTO }>(`${base}/share`, { method: 'POST', body: { reset }, errorTitle: 'Couldn’t create the link' })
      setShare(r.share)
      await copy(`${window.location.origin}${r.share.path}`)
      toast.success(reset ? 'New link created and copied' : 'Link created and copied', reset ? 'The old link no longer works.' : undefined)
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    try {
      await apiFetch(`${base}/share`, { method: 'DELETE', errorTitle: 'Couldn’t turn off the link' })
      setShare(null)
      toast.success('Link turned off', 'Anyone opening it now sees that it’s no longer active.')
    } catch {
      // toasted
    } finally {
      setBusy(false)
    }
  }

  async function toggle(key: Toggle) {
    if (!share) return
    const next = { ...share, [key]: !share[key] }
    setShare(next)
    try {
      const r = await apiFetch<{ share: ShareDTO }>(`${base}/share`, { method: 'PATCH', body: { [key]: next[key] }, errorTitle: 'Couldn’t update the link' })
      setShare(r.share)
    } catch {
      setShare(share)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`p-2 rounded-input transition-colors flex items-center gap-1.5 text-sm ${open ? 'bg-accent/10 text-accent' : 'text-muted hover:text-heading hover:bg-surface-hover'}`}
        title="Share a preview link"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden min-[1200px]:inline">Share</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Share this article"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute right-0 top-full mt-2 w-[360px] glass-card bg-surface shadow-2xl p-4 z-40"
          >
            <h3 className="text-sm font-semibold text-heading flex items-center gap-2">
              <Link2 className="w-4 h-4 text-accent" /> Share a preview
            </h3>
            {share === undefined ? (
              <div className="py-6 flex justify-center text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : share === null ? (
              <div className="mt-2">
                <p className="text-sm text-muted">
                  A private, branded page with this article, its guideline score and how it was made, where viewers can comment and approve. Anyone with the link can view it, so send it only
                  to people who should see it. You can turn it off anytime.
                </p>
                <button
                  type="button"
                  onClick={() => void create()}
                  disabled={busy}
                  className="mt-3 w-full bg-accent hover:bg-accent/90 text-white rounded-input px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Create link
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Share link"
                    className="flex-1 min-w-0 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-2.5 py-1.5 text-xs font-mono text-heading"
                  />
                  <button
                    type="button"
                    onClick={() => void copy()}
                    className="shrink-0 bg-accent hover:bg-accent/90 text-white rounded-input px-3 py-1.5 text-sm font-medium flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{share.viewCount}</span> view{share.viewCount === 1 ? '' : 's'}
                    {share.lastViewedAt && ` · last ${formatDistanceToNowStrict(new Date(share.lastViewedAt), { addSuffix: true })}`}
                  </span>
                  <a href={share.path} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted">The page shows</p>
                  {TOGGLES.map((t) => (
                    <label key={t.key} className="flex items-center gap-3 cursor-pointer">
                      <span className="flex-1">
                        <span className="block text-sm text-heading">{t.label}</span>
                        <span className="block text-xs text-muted">{t.hint}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={share[t.key]}
                        aria-label={t.label}
                        onClick={() => void toggle(t.key)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${share[t.key] ? 'bg-accent' : 'bg-[var(--color-gauge-bg)] border border-border'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${share[t.key] ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                    </label>
                  ))}
                </div>
                <div className="border-t border-border pt-3 flex items-center gap-2">
                  <button type="button" onClick={() => setConfirm('reset')} disabled={busy} className="text-xs text-muted hover:text-heading inline-flex items-center gap-1 disabled:opacity-50">
                    <RefreshCw className="w-3.5 h-3.5" /> Reset link
                  </button>
                  <button type="button" onClick={() => setConfirm('revoke')} disabled={busy} className="ml-auto text-xs text-red-400 hover:text-red-500 inline-flex items-center gap-1 disabled:opacity-50">
                    <Unlink className="w-3.5 h-3.5" /> Turn off link
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={confirm === 'reset'}
        title="Reset the share link?"
        message="A new link is created and the current one stops working. Anyone you sent it to will need the new link."
        confirmLabel="Reset link"
        confirmVariant="warning"
        onConfirm={() => {
          setConfirm(null)
          void create(true)
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        isOpen={confirm === 'revoke'}
        title="Turn off the share link?"
        message="The link stops working right away. You can create a new one later."
        confirmLabel="Turn off link"
        confirmVariant="danger"
        onConfirm={() => {
          setConfirm(null)
          void revoke()
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
