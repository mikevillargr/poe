'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import type { ClientSummary } from '@/lib/clients/schemas'
import { switchClientPath } from '@/lib/nav'
import { useToast } from '@/hooks/useToast'
import { AddClientModal } from './AddClientModal'

function Initial({ name, active }: { name: string; active?: boolean }) {
  return (
    <div
      className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border ${
        active ? 'bg-accent/20 text-accent border-accent/30' : 'bg-white/[0.04] text-[#CBD5E1] border-white/[0.08]'
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

// DR-001 option A: popover anchored to the sidebar's client button, with search, list and "Add client".
export function ClientSwitcher({ clients, activeSlug }: { clients: ClientSummary[]; activeSlug: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const active = clients.find((c) => c.slug === activeSlug) ?? null
  const showSearch = clients.length > 6
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)) : clients
  }, [clients, query])
  const optionCount = filtered.length + 1 // + "Add client"

  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlight(Math.max(0, filtered.findIndex((c) => c.slug === activeSlug)))
    setTimeout(() => searchRef.current?.focus(), 30)
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function choose(index: number) {
    if (index === filtered.length) {
      setOpen(false)
      setAdding(true)
      return
    }
    const c = filtered[index]
    setOpen(false)
    if (c && c.slug !== activeSlug) router.push(switchClientPath(pathname, c.slug))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % optionCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + optionCount) % optionCount)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(highlight)
    }
  }

  return (
    <div className="relative" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.06] rounded-input p-2 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Initial name={active?.name ?? '?'} active />
          <span className="text-sm font-medium text-[#F1F5F9] truncate">{active?.name ?? 'Select a client'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-full mt-2 w-[280px] z-[55] rounded-card border border-white/[0.08] bg-[#111118] shadow-2xl overflow-hidden"
          >
            {showSearch && (
              <div className="p-2 border-b border-white/[0.06] relative">
                <Search className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setHighlight(0)
                  }}
                  placeholder="Search clients"
                  className="w-full pl-8 pr-2 py-2 bg-white/[0.03] rounded-input text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
            <ul role="listbox" className="max-h-[320px] overflow-y-auto py-1">
              {filtered.map((c, i) => {
                const isActive = c.slug === activeSlug
                return (
                  <li key={c.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => choose(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        highlight === i ? 'bg-white/[0.06]' : ''
                      }`}
                    >
                      <Initial name={c.name} active={isActive} />
                      <span className="flex-1 min-w-0 text-sm text-[#F1F5F9] truncate">{c.name}</span>
                      <span className="text-xs text-[#64748B] font-mono tabular-nums">{c.articleCount}</span>
                      <Check className={`w-4 h-4 text-accent ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                  </li>
                )
              })}
              {filtered.length === 0 && <li className="px-3 py-2 text-sm text-[#64748B]">No clients match.</li>}
            </ul>
            <div className="border-t border-white/[0.06] py-1">
              <button
                type="button"
                onMouseEnter={() => setHighlight(filtered.length)}
                onClick={() => choose(filtered.length)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-[#CBD5E1] hover:text-[#F1F5F9] transition-colors ${
                  highlight === filtered.length ? 'bg-white/[0.06]' : ''
                }`}
              >
                <Plus className="w-4 h-4 text-accent" />
                Add client
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddClientModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        onCreated={(client, copied) => {
          setAdding(false)
          toast.success(`${client.name} created`, `Started with ${copied} Universal ${copied === 1 ? 'guideline' : 'guidelines'}.`)
          router.push(`/c/${client.slug}`)
          router.refresh()
        }}
      />
    </div>
  )
}
