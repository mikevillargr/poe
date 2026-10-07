'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, ChevronDown } from 'lucide-react'
import { latestThought } from '@/lib/ai/client/activity'
import { formatElapsed } from '@/lib/pipeline/run-state'

// DR-016: the model's latest thought as a live one-line peek (muted italics), "Show thinking" for the full
// trail, and "Thought for Ns" once it moves on. Display only.
export function ThinkingPeek({ thinking, active, thoughtMs }: { thinking: string; active: boolean; thoughtMs: number | null }) {
  const [open, setOpen] = useState(false)
  const trailRef = useRef<HTMLDivElement>(null)
  const peek = latestThought(thinking)
  // A new key per sentence (not per token), so the line cross-fades when the thought changes, not on every chunk.
  const sentenceKey = thinking.split(/[.!?]\s/).length

  useEffect(() => {
    if (open && trailRef.current) trailRef.current.scrollTop = trailRef.current.scrollHeight
  }, [open, thinking])

  if (!thinking.trim()) return null
  return (
    <div className="rounded-input border border-border bg-background/60 px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <Brain className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-accent animate-pulse' : 'text-muted'}`} />
        <span className={active ? 'text-heading' : 'text-muted'}>
          {active ? 'Thinking…' : thoughtMs !== null ? `Thought for ${formatElapsed(thoughtMs)}` : 'Thought'}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1 text-muted hover:text-accent"
        >
          {open ? 'Hide thinking' : 'Show thinking'}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open ? (
        <div ref={trailRef} className="mt-2 max-h-48 overflow-y-auto custom-scrollbar text-xs italic text-muted whitespace-pre-wrap leading-relaxed">
          {thinking.trim()}
        </div>
      ) : (
        active && (
          <div className="mt-1 min-h-[2.25rem]" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={sentenceKey}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="text-xs italic text-muted line-clamp-2"
              >
                {peek}
              </motion.p>
            </AnimatePresence>
          </div>
        )
      )}
    </div>
  )
}
