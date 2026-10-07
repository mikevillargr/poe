'use client'

import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { CheckCircle2, FileText, PenLine, Search, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { EventAvatar } from '@/components/home/ActivityRail'
import type { StoryStep, StoryStepKey } from '@/lib/shares/story'

// DR-021: "How this article was made", six connected step cards. Human steps carry the accent; AI steps stay
// neutral, so the human-in-the-loop part reads at a glance.

const ICONS: Record<StoryStepKey, LucideIcon> = {
  brief: FileText,
  research: Search,
  draft: Sparkles,
  editing: PenLine,
  check: ShieldCheck,
  review: CheckCircle2,
}

const ACTOR_LABEL = { human: 'People', ai: 'AI', both: 'AI + people' } as const

export function StoryStepper({ steps }: { steps: StoryStep[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {steps.map((s, i) => {
        const Icon = ICONS[s.key]
        const human = s.actor !== 'ai'
        const dim = s.state !== 'done'
        return (
          <motion.li
            key={s.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: dim ? 0.6 : 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 26 }}
            className={`relative glass-card p-4 flex flex-col gap-3 ${s.key === 'editing' && !dim ? 'ring-1 ring-accent/40' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  human ? 'bg-accent/10 text-accent' : 'bg-surface-hover text-heading border border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="font-mono tabular-nums text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-heading">{s.label}</h3>
              <p className="text-xs text-muted mt-0.5">
                {s.state === 'skipped' ? 'Skipped' : s.state === 'pending' ? 'Not yet' : s.at ? format(new Date(s.at), 'MMM d') : 'Done'}
                <span className={human ? 'text-accent' : ''}> · {ACTOR_LABEL[s.actor]}</span>
              </p>
            </div>
            {s.stats.length > 0 && (
              <ul className="space-y-1 text-xs text-body leading-snug">
                {s.stats.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {s.people.length > 0 && (
              <div className="mt-auto flex items-center gap-2 pt-1">
                <div className="flex -space-x-1.5">
                  {s.people.slice(0, 4).map((p) => (
                    <EventAvatar key={p.name} name={p.name} image={p.image} />
                  ))}
                </div>
                <span className="text-xs text-muted truncate">{s.people.length === 1 ? s.people[0]!.name : `${s.people[0]!.name} +${s.people.length - 1}`}</span>
              </div>
            )}
          </motion.li>
        )
      })}
    </ol>
  )
}
