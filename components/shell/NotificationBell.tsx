'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { Bell, CheckCheck } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import type { NotificationDTO } from '@/lib/notifications/notify'

// DR-021: in-app notifications (comments, replies, client sign-offs on shared articles). Polls every minute
// and when the tab regains focus; opens beside the sidebar.

type Data = { items: NotificationDTO[]; unread: number }

export function NotificationBell() {
  const router = useRouter()
  const [data, setData] = useState<Data>({ items: [], unread: 0 })
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Data>('/api/notifications', { silent: true }))
    } catch {
      // offline or signed out: keep the last state
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 60_000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  useEffect(() => {
    if (!open) return
    void load()
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, load])

  async function mark(body: { ids: string[] } | { all: true }) {
    try {
      setData(await apiFetch<Data>('/api/notifications', { method: 'PATCH', body, silent: true }))
    } catch {
      // not critical
    }
  }

  function go(n: NotificationDTO) {
    if (!n.read) void mark({ ids: [n.id] })
    setOpen(false)
    if (n.href) router.push(n.href)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative p-2 text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/[0.06] rounded-input transition-colors"
      >
        <Bell className="w-4 h-4" />
        {data.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-mono tabular-nums flex items-center justify-center">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
            exit={{ opacity: 0, x: -6 }}
            className="fixed left-[248px] bottom-4 w-[360px] max-h-[70vh] glass-card bg-surface shadow-2xl z-[60] flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <h2 className="text-sm font-semibold text-heading flex-1">Notifications</h2>
              {data.unread > 0 && (
                <button type="button" onClick={() => void mark({ all: true })} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {data.items.length === 0 ? (
                <p className="text-sm text-muted text-center py-10 px-6">Nothing yet. Comments and sign-offs on shared articles appear here.</p>
              ) : (
                <ol>
                  {data.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => go(n)}
                        className={`w-full text-left px-4 py-3 border-b border-border last:border-0 flex gap-3 hover:bg-surface-hover transition-colors ${n.read ? '' : 'bg-accent/[0.04]'}`}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-transparent' : 'bg-accent'}`} />
                        <span className="min-w-0">
                          <span className={`block text-sm ${n.read ? 'text-body' : 'text-heading font-medium'}`}>{n.text}</span>
                          <span className="block text-xs text-muted mt-0.5">{formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
