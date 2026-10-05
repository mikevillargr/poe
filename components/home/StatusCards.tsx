'use client'

import { motion } from 'framer-motion'
import { ARTICLE_STATUSES, ARTICLE_STATUS_LABELS, type ArticleStatus, type StatusCounts } from '@/lib/articles/schemas'
import { STATUS_STYLE } from './status'

// DR-003: four status cards (old Job Queue metric-card style); clicking one filters the queue.
export function StatusCards({
  counts,
  active,
  onSelect,
}: {
  counts: StatusCounts
  active: ArticleStatus | null
  onSelect: (s: ArticleStatus | null) => void
}) {
  const total = ARTICLE_STATUSES.reduce((n, s) => n + counts[s], 0)
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6">
      {ARTICLE_STATUSES.map((s) => {
        const st = STATUS_STYLE[s]
        const Icon = st.icon
        const share = total ? counts[s] / total : 0
        const isActive = active === s
        return (
          <motion.button
            key={s}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(isActive ? null : s)}
            aria-pressed={isActive}
            className={`glass-card p-5 border-t-2 ${st.border} relative overflow-hidden group text-left transition-shadow ${
              isActive ? 'ring-2 ring-accent/60 shadow-glow-accent' : ''
            }`}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-b ${st.glow} to-transparent transition-opacity duration-500 ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <h3 className="text-muted text-sm font-medium">{ARTICLE_STATUS_LABELS[s]}</h3>
              <Icon className={`w-4 h-4 ${st.text}`} />
            </div>
            <div className="flex items-end gap-2 relative z-10">
              <span className={`text-4xl font-mono font-bold tabular-nums ${s === 'queued' ? 'text-heading' : st.text}`}>
                {counts[s]}
              </span>
              <span className="text-muted text-sm font-mono mb-1 tabular-nums">{Math.round(share * 100)}%</span>
            </div>
            <div className="mt-4 h-1 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden relative z-10">
              <motion.div
                className={`h-full rounded-full ${st.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${share * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
