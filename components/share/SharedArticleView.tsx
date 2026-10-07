'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { BookOpen, ChevronDown, Feather, ListChecks, X } from 'lucide-react'
import { ScoreGauge } from '@/components/ScoreGauge'
import { CategoryBadge } from '@/components/CategoryBadge'
import { categoryShortLabel } from '@/lib/guidelines/categories'
import { StatusPill } from '@/components/home/StatusPill'
import { EventAvatar } from '@/components/home/ActivityRail'
import type { ArticleStatus } from '@/lib/articles/schemas'
import { describeHistoryEvent, groupByDay, historyMeta } from '@/lib/articles/history-format'
import type { SharedArticle } from '@/lib/shares/public'
import { BrandMark } from './BrandMark'
import { StoryStepper } from './StoryStepper'
import { ArticleReader } from './ArticleReader'

// DR-021: the shared article page: brand bar, hero (title, keywords, score), how it was made, the article,
// the rules it was checked against, and a short "About Poe".

const nf = new Intl.NumberFormat('en-US')
const SEEN_KEY = (token: string) => `poe-share-seen:${token.slice(0, 12)}`

export function SharedArticleView({ token, data }: { token: string; data: SharedArticle }) {
  const { article, branding, client, score, story, totals } = data
  const [rulesOpen, setRulesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [updatedSince, setUpdatedSince] = useState<string | null>(null)

  // "Updated since your last visit", remembered in this browser only.
  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY(token))
      if (seen && seen < article.updatedAt) setUpdatedSince(seen)
      localStorage.setItem(SEEN_KEY(token), article.updatedAt)
    } catch {
      // storage unavailable (private mode): no banner
    }
  }, [token, article.updatedAt])

  const ruleCount = useMemo(() => data.rules?.reduce((n, g) => n + g.rules.length, 0) ?? null, [data.rules])
  const checked = score.rules ? score.rules.universal + score.rules.client : null

  return (
    <div className="min-h-screen bg-background text-body">
      {/* Brand bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-16 px-5 flex items-center gap-4">
          <BrandMark branding={branding} />
          <span className="w-px h-6 bg-border shrink-0" />
          <span className="text-sm text-muted truncate min-w-0">
            Prepared for <span className="text-heading font-medium">{client.name}</span>
          </span>
          <a
            href="#about-poe"
            title="Made with Poe"
            className="ml-auto shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs text-muted border border-border rounded-full px-2 sm:px-3 py-1 hover:text-accent hover:border-accent/40 transition-colors"
          >
            <Feather className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Made with Poe</span>
          </a>
        </div>
      </header>

      {updatedSince && (
        <div className="bg-accent/5 border-b border-accent/20">
          <p className="max-w-6xl mx-auto px-5 py-2 text-sm text-heading">
            Updated since your last visit ({formatDistanceToNowStrict(new Date(updatedSince), { addSuffix: true })}).
          </p>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-5 pb-24">
        {/* Hero */}
        <section className="pt-12 pb-10 grid gap-8 lg:grid-cols-[1fr_300px] items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-[0.18em] text-muted">Article preview</span>
              <StatusPill status={article.status as ArticleStatus} />
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-tight text-heading">{article.title}</h1>
            {(article.primaryKeyword || article.keywords.length > 0) && (
              <div className="mt-5 flex flex-wrap gap-1.5" aria-label="SEO keywords">
                {[article.primaryKeyword, ...article.keywords.filter((k) => k !== article.primaryKeyword)].filter(Boolean).map((k, i) => (
                  <span
                    key={k}
                    className={`text-xs px-2.5 py-1 rounded-full border ${i === 0 && article.primaryKeyword ? 'border-accent/40 bg-accent/10 text-accent font-medium' : 'border-border text-body bg-surface'}`}
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Length</dt>
                <dd className="font-mono tabular-nums text-heading">
                  {nf.format(article.wordCount)}
                  {article.targetWordCount ? <span className="text-muted"> / {nf.format(article.targetWordCount)} words</span> : ' words'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">People involved</dt>
                <dd className="font-mono tabular-nums text-heading">{totals.people}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Human edits &amp; reviews</dt>
                <dd className="font-mono tabular-nums text-heading">{nf.format(totals.humanActions)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Last updated</dt>
                <dd className="text-heading">{format(new Date(article.updatedAt), 'MMM d, yyyy')}</dd>
              </div>
              {article.owner && (
                <div>
                  <dt className="text-xs text-muted">Editor</dt>
                  <dd className="flex items-center gap-1.5 text-heading">
                    <EventAvatar name={article.owner.name} image={article.owner.image} />
                    {article.owner.name}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <aside className="glass-card p-6 flex flex-col items-center text-center" aria-label="Guideline score">
            {score.overall !== null ? (
              <>
                <ScoreGauge score={score.overall} size={132} />
                <p className="mt-3 text-sm font-medium text-heading">Guideline score</p>
                <p className="text-xs text-muted mt-1">
                  {checked !== null
                    ? `Checked against ${checked} rules · ${score.rules!.universal} agency-wide · ${score.rules!.client} ${client.name}`
                    : 'Checked against your brand and SEO guidelines'}
                </p>
              </>
            ) : (
              <>
                <ListChecks className="w-8 h-8 text-muted" />
                <p className="mt-3 text-sm font-medium text-heading">Guideline check pending</p>
                <p className="text-xs text-muted mt-1">The score appears here once an editor checks the draft.</p>
              </>
            )}
            {data.rules && ruleCount !== null && ruleCount > 0 && (
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 border border-border rounded-input px-3 py-2 text-sm text-heading hover:bg-surface-hover transition-colors"
              >
                <BookOpen className="w-4 h-4 text-accent" />
                See the {ruleCount} rules
              </button>
            )}
          </aside>
        </section>

        {/* How it was made */}
        <section aria-labelledby="made-title" className="pb-12">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <h2 id="made-title" className="font-display text-2xl text-heading">
                How this article was made
              </h2>
              <p className="text-sm text-muted mt-1">AI does the heavy lifting; our editors decide what ships. Every step below is recorded as it happens.</p>
            </div>
            {data.history && data.history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-expanded={historyOpen}
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                {historyOpen ? 'Hide the full history' : 'See the full history'}
                <ChevronDown className={`w-4 h-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          <StoryStepper steps={story} />
          <AnimatePresence initial={false}>
            {historyOpen && data.history && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <PublicHistory events={data.history} people={data.people} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* The article */}
        <section aria-label="Article" className="glass-card px-6 py-10 md:px-12 md:py-14">
          <div className="max-w-[720px] mx-auto">
            {article.html ? <ArticleReader html={article.html} /> : <p className="text-center text-muted py-16">The draft hasn’t been written yet. This page updates as soon as it is.</p>}
          </div>
        </section>

        {/* About Poe */}
        <section id="about-poe" className="mt-12 grid gap-6 md:grid-cols-[auto_1fr] items-start glass-card p-6 md:p-8">
          <span className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Feather className="w-6 h-6 text-accent" />
          </span>
          <div>
            <h2 className="font-display text-xl text-heading">About Poe</h2>
            <p className="mt-2 text-sm text-body leading-relaxed max-w-3xl">{branding.about}</p>
            <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
              {story.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted">→</span>}
                  <span className={`px-2 py-0.5 rounded-full border ${s.actor === 'ai' ? 'border-border text-muted' : 'border-accent/30 text-accent'}`}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center gap-4 text-xs text-muted">
          <BrandMark branding={branding} className="h-5" />
          {branding.website && (
            <a href={branding.website} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {branding.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          <span className="ml-auto">Shared privately with you. Please don’t forward this link.</span>
        </div>
      </footer>

      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} rules={data.rules ?? []} clientName={client.name} />
    </div>
  )
}

function PublicHistory({ events, people }: { events: SharedArticle['history'] & object; people: Record<string, string> }) {
  const days = groupByDay(events)
  return (
    <div className="mt-6 glass-card p-5 md:p-6">
      {days.map((d) => (
        <section key={d.label} className="mb-4 last:mb-0">
          <h3 className="text-[11px] uppercase tracking-wider text-muted mb-2">{d.label}</h3>
          <ol className="space-y-2.5">
            {d.events.map((e) => {
              const meta = historyMeta(e)
              return (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <EventAvatar name={e.userName} image={e.userImage} />
                  <p className="flex-1 min-w-0">
                    <span className="text-heading font-medium">{e.userName ?? 'Poe'}</span> {describeHistoryEvent(e, people)}
                    {meta && <span className="block text-xs text-muted">{meta}</span>}
                  </p>
                  <time dateTime={e.at} className="text-xs text-muted font-mono tabular-nums shrink-0">
                    {format(new Date(e.at), 'h:mm a')}
                  </time>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}

function RulesDrawer({ open, onClose, rules, clientName }: { open: boolean; onClose: () => void; rules: NonNullable<SharedArticle['rules']>; clientName: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const tiers = [
    { tier: 'universal' as const, title: 'Agency-wide standards', note: 'Applied to every client' },
    { tier: 'client' as const, title: `${clientName} guidelines`, note: 'Your brand and SEO rules' },
  ]
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 backdrop-blur-sm"
            style={{ background: 'var(--color-modal-backdrop)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Guidelines checked"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed top-4 right-4 bottom-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] glass-card bg-surface shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent" />
              <h2 className="font-display text-lg text-heading flex-1">Guidelines this article is checked against</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
              {tiers.map(({ tier, title, note }) => {
                const groups = rules.filter((g) => g.tier === tier)
                if (!groups.length) return null
                return (
                  <section key={tier}>
                    <h3 className="text-sm font-semibold text-heading">{title}</h3>
                    <p className="text-xs text-muted mb-3">{note}</p>
                    <div className="space-y-4">
                      {groups.map((g) => (
                        <div key={g.category}>
                          <CategoryBadge category={categoryShortLabel(g.category)} />
                          <ul className="mt-2 space-y-2">
                            {g.rules.map((r, i) => (
                              <li key={i} className="text-sm leading-snug">
                                {r.title && <span className="text-heading font-medium">{r.title}. </span>}
                                <span className="text-body">{r.rule}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
