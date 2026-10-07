'use client'

import { format } from 'date-fns'
import { CheckCircle2, FileText, PenLine, Search, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import type { StoryStep, StoryStepKey } from '@/lib/shares/story'

// DR-021 (amendment A): "How this article was made" as a compact vertical timeline for the side rail. Human steps
// carry the accent; AI steps stay neutral; steps not reached yet are hollow.

const ICONS: Record<StoryStepKey, LucideIcon> = {
  brief: FileText,
  research: Search,
  draft: Sparkles,
  editing: PenLine,
  check: ShieldCheck,
  review: CheckCircle2,
}

const ACTOR_LABEL = { human: 'People', ai: 'AI', both: 'AI + people' } as const

export function StoryTimeline({ steps }: { steps: StoryStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const Icon = ICONS[s.key]
        const human = s.actor !== 'ai'
        const done = s.state === 'done'
        const last = i === steps.length - 1
        return (
          <li key={s.key} className="relative flex gap-3 pb-3.5 last:pb-0">
            {!last && <span aria-hidden className={`absolute left-[13px] top-7 bottom-0 w-px ${done ? 'bg-accent/30' : 'bg-border'}`} />}
            <span
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                !done
                  ? 'border border-dashed border-border text-muted bg-surface'
                  : human
                    ? 'bg-accent/10 text-accent'
                    : 'bg-surface-hover text-heading border border-border'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <div className={`min-w-0 flex-1 pt-0.5 ${done ? '' : 'opacity-60'}`}>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm font-medium ${s.key === 'editing' && done ? 'text-accent' : 'text-heading'}`}>{s.label}</span>
                <span className="text-[11px] text-muted ml-auto shrink-0">
                  {ACTOR_LABEL[s.actor]} · {s.state === 'skipped' ? 'Skipped' : s.state === 'pending' ? 'Not yet' : s.at ? format(new Date(s.at), 'MMM d') : ''}
                </span>
              </div>
              {s.stats.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-body leading-snug">
                  {s.stats.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
