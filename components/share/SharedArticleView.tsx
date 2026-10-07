'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { BookOpen, ChevronDown, Feather, History, ListChecks, MessageSquare, MessageSquarePlus, X } from 'lucide-react'
import { CategoryBadge } from '@/components/CategoryBadge'
import { categoryShortLabel } from '@/lib/guidelines/categories'
import { StatusPill } from '@/components/home/StatusPill'
import { EventAvatar } from '@/components/home/ActivityRail'
import type { ArticleStatus } from '@/lib/articles/schemas'
import { describeHistoryEvent, groupByDay, historyActor, historyMeta } from '@/lib/articles/history-format'
import type { SharedArticle } from '@/lib/shares/public'
import { BrandMark } from './BrandMark'
import { StoryTimeline } from './StoryTimeline'
import { ArticleReader } from './ArticleReader'
import { stripLeadingTitle } from '@/lib/shares/title'
import { CommentsRail } from './CommentsRail'
import { ApprovalBar } from './ApprovalBar'
import { guestFetch, useGuest } from './useGuest'
import { anchorFromSelection, buildTextIndex, indexAtPoint, paintHighlights, rangeForAnchor } from '@/lib/shares/text-index'
import type { CommentAnchor, Decision, ThreadDTO } from '@/lib/comments/types'

// DR-021 (amendment A, reading first): brand bar, then the title, a one-line byline and the article straight away.
// "Behind this article" (score, how it was made, rules, full history) sits in a sticky side rail on wide screens
// and in a collapsible bar under the byline on phones. "About Poe" closes the page.

const nf = new Intl.NumberFormat('en-US')
const SEEN_KEY = (token: string) => `poe-share-seen:${token.slice(0, 12)}`

type Drawer = 'rules' | 'history' | null

export function SharedArticleView({ token, data }: { token: string; data: SharedArticle }) {
  const { article, branding, client } = data
  const [drawer, setDrawer] = useState<Drawer>(null)
  const [railOpen, setRailOpen] = useState(false)
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

  // ── Comments + sign-off (DR-021 part 2) ─────────────────────────────────────────────────────────────
  const commentsOn = data.share.showComments
  const { guest, update: updateGuest } = useGuest()
  const [threads, setThreads] = useState<ThreadDTO[]>([])
  const [threadsLoading, setThreadsLoading] = useState(commentsOn)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<CommentAnchor | null>(null)
  const [railTab, setRailTab] = useState<'about' | 'comments'>('about')
  const [mobileComments, setMobileComments] = useState(false)
  const [selection, setSelection] = useState<{ anchor: CommentAnchor; x: number; y: number } | null>(null)
  const [readerReady, setReaderReady] = useState(false)
  const [orphaned, setOrphaned] = useState<Set<string>>(new Set())
  const readerRef = useRef<HTMLDivElement>(null)
  const rangesRef = useRef<Map<string, Range>>(new Map())
  const base = `/api/public/shares/${token}`

  const loadComments = useCallback(async () => {
    if (!guest.key) return
    try {
      const r = await guestFetch<{ threads: ThreadDTO[]; decision: Decision | null }>(`${base}/comments`, guest.key)
      setThreads(r.threads)
      setDecision(r.decision)
    } catch {
      // the page still works without comments
    } finally {
      setThreadsLoading(false)
    }
  }, [base, guest.key])

  useEffect(() => {
    void loadComments()
  }, [loadComments])

  // Selecting text in the article offers "Comment" next to the selection.
  useEffect(() => {
    if (!commentsOn) return
    let t: ReturnType<typeof setTimeout>
    const check = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const root = readerRef.current
        const anchor = root ? anchorFromSelection(root) : null
        const sel = window.getSelection()
        if (!anchor || !sel?.rangeCount) return setSelection(null)
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        setSelection({ anchor, x: rect.left + rect.width / 2, y: rect.top })
      }, 120)
    }
    document.addEventListener('selectionchange', check)
    const clear = () => setSelection(null)
    window.addEventListener('scroll', clear, { passive: true })
    return () => {
      clearTimeout(t)
      document.removeEventListener('selectionchange', check)
      window.removeEventListener('scroll', clear)
    }
  }, [commentsOn])

  // Highlight every open passage comment (and the active one, open or not).
  useEffect(() => {
    const root = readerRef.current
    if (!readerReady || !root || !commentsOn) return
    const idx = buildTextIndex(root)
    const map = new Map<string, Range>()
    const lost = new Set<string>()
    for (const t of threads) {
      if (!t.anchor) continue
      const r = rangeForAnchor(idx, t.anchor)
      if (r) map.set(t.id, r)
      else lost.add(t.id)
    }
    rangesRef.current = map
    setOrphaned(lost)
    paintHighlights(
      threads.filter((t) => t.status === 'open' && map.has(t.id)).map((t) => map.get(t.id)!),
      activeId ? (map.get(activeId) ?? null) : null,
    )
  }, [threads, activeId, readerReady, commentsOn])

  function openComments() {
    setRailTab('comments')
    if (window.matchMedia('(max-width: 1023px)').matches) setMobileComments(true)
  }

  function commentOnSelection() {
    if (!selection) return
    setPending(selection.anchor)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
    openComments()
  }

  function onReaderClick(e: React.MouseEvent) {
    const root = readerRef.current
    if (!root || !commentsOn || !window.getSelection()?.isCollapsed) return
    const idx = buildTextIndex(root)
    const at = indexAtPoint(idx, e.clientX, e.clientY)
    if (at < 0) return
    const node = idx.pos[at]
    if (!node) return
    for (const [id, r] of rangesRef.current) {
      if (r.isPointInRange(node.node, node.offset)) {
        setActiveId(id)
        openComments()
        return
      }
    }
  }

  async function post(body: string, opts: { anchor?: CommentAnchor | null; parentId?: string | null }) {
    await guestFetch(`${base}/comments`, guest.key, {
      method: 'POST',
      body: { name: guest.name, email: guest.email, body, anchor: opts.anchor ?? null, parentId: opts.parentId ?? null },
    })
    await loadComments()
  }

  const rail = commentsOn ? (
    <CommentsRail
      threads={threads}
      loading={threadsLoading}
      orphaned={orphaned}
      activeId={activeId}
      onActivate={setActiveId}
      pending={pending}
      onClearPending={() => setPending(null)}
      guest={guest}
      onGuest={updateGuest}
      onPost={post}
      onEdit={async (id, body) => {
        await guestFetch(`${base}/comments/${id}`, guest.key, { method: 'PATCH', body: { body } })
        await loadComments()
      }}
      onDelete={async (id) => {
        await guestFetch(`${base}/comments/${id}`, guest.key, { method: 'DELETE' })
        await loadComments()
      }}
    />
  ) : null
  const openCount = threads.filter((t) => t.status === 'open').length

  // The title is shown above; drop the draft's own H1 when it just repeats it.
  const readerHtml = useMemo(() => stripLeadingTitle(article.html, article.title), [article.html, article.title])

  const keywords = [article.primaryKeyword, ...article.keywords.filter((k) => k !== article.primaryKeyword)].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-background text-body">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-14 px-5 flex items-center gap-4">
          <BrandMark branding={branding} className="h-6" />
          <span className="w-px h-5 bg-border shrink-0" />
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

      <div className="max-w-6xl mx-auto px-5 pt-10 md:pt-14 pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-14">
        <main className="min-w-0">
          <article className="max-w-[720px] mx-auto lg:mx-0">
            <h1 className="font-display text-4xl md:text-[2.75rem] leading-tight text-heading">{article.title}</h1>

            {/* One-line byline */}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              {article.owner && (
                <span className="inline-flex items-center gap-1.5 text-heading">
                  <EventAvatar name={article.owner.name} image={article.owner.image} />
                  {article.owner.name}
                </span>
              )}
              <StatusPill status={article.status as ArticleStatus} />
              <span className="font-mono tabular-nums">
                {nf.format(article.wordCount)}
                {article.targetWordCount ? ` / ${nf.format(article.targetWordCount)}` : ''} words
              </span>
              <span>Updated {format(new Date(article.updatedAt), 'MMM d')}</span>
            </div>
            {keywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5" aria-label="SEO keywords">
                {keywords.map((k, i) => (
                  <span
                    key={k}
                    className={`text-xs px-2 py-0.5 rounded-full border ${i === 0 && article.primaryKeyword ? 'border-accent/40 text-accent' : 'border-border text-muted'}`}
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}

            {/* Phones and tablets: the rail folds into one bar under the byline */}
            <div className="lg:hidden mt-6">
              <button
                type="button"
                onClick={() => setRailOpen((o) => !o)}
                aria-expanded={railOpen}
                className="w-full glass-card px-4 py-3 flex items-center gap-3 text-left"
              >
                <ScoreRing score={data.score.overall} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-heading">How this was made</span>
                  <span className="block text-xs text-muted truncate">
                    {data.score.overall !== null ? 'Guideline score · ' : ''}
                    {data.totals.people} {data.totals.people === 1 ? 'person' : 'people'} · {data.totals.humanActions} human edits
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-muted transition-transform ${railOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {railOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-3">
                      <BehindRail data={data} onOpen={setDrawer} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-8 pt-8 border-t border-border" onClick={onReaderClick}>
              {article.html ? (
                <ArticleReader ref={readerRef} html={readerHtml} onReady={() => setReaderReady(true)} />
              ) : (
                <p className="text-center text-muted py-16">The draft hasn’t been written yet. This page updates as soon as it is.</p>
              )}
            </div>
          </article>
        </main>

        <aside className="hidden lg:block" aria-label="Behind this article">
          <div className="sticky top-20 max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar rounded-xl pb-16">
            {commentsOn && (
              <div role="tablist" aria-label="Side panel" className="mb-3 grid grid-cols-2 gap-1 p-1 rounded-input bg-surface border border-border text-sm">
                {(['about', 'comments'] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={railTab === t}
                    onClick={() => setRailTab(t)}
                    className={`py-1.5 rounded-md transition-colors inline-flex items-center justify-center gap-1.5 ${railTab === t ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-heading'}`}
                  >
                    {t === 'about' ? (
                      'About this article'
                    ) : (
                      <>
                        <MessageSquare className="w-3.5 h-3.5" /> Comments
                        {openCount > 0 && <span className="font-mono tabular-nums text-xs">{openCount}</span>}
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
            {railTab === 'comments' && rail ? rail : <BehindRail data={data} onOpen={setDrawer} />}
          </div>
        </aside>
      </div>

      <section id="about-poe" className="border-t border-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-10 grid gap-5 md:grid-cols-[auto_1fr] items-start">
          <span className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center">
            <Feather className="w-5 h-5 text-accent" />
          </span>
          <div>
            <h2 className="font-display text-xl text-heading">About Poe</h2>
            <p className="mt-2 text-sm text-body leading-relaxed max-w-3xl">{branding.about}</p>
            <ol className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
              {data.story.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted">→</span>}
                  <span className={`px-2 py-0.5 rounded-full border ${s.actor === 'ai' ? 'border-border text-muted' : 'border-accent/30 text-accent'}`}>{s.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Floating "Comment" next to a selection */}
      <AnimatePresence>
        {selection && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={commentOnSelection}
            style={{ left: selection.x, top: Math.max(64, selection.y - 44) }}
            className="fixed z-40 -translate-x-1/2 inline-flex items-center gap-1.5 bg-heading text-surface rounded-full px-3 py-1.5 text-sm font-medium shadow-lg"
          >
            <MessageSquarePlus className="w-4 h-4" /> Comment
          </motion.button>
        )}
      </AnimatePresence>

      <ApprovalBar
        token={token}
        decision={decision}
        onDecision={setDecision}
        guest={guest}
        onGuest={updateGuest}
        ownerName={article.owner?.name ?? null}
        commentCount={commentsOn ? openCount : null}
        onOpenComments={() => setMobileComments(true)}
      />

      <footer className="border-t border-border pb-20">
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

      <SideDrawer open={drawer === 'rules'} onClose={() => setDrawer(null)} title="Guidelines this article is checked against" icon={BookOpen}>
        <RulesList rules={data.rules ?? []} clientName={client.name} />
      </SideDrawer>
      <SideDrawer open={mobileComments} onClose={() => setMobileComments(false)} title="Comments" icon={MessageSquare}>
        {rail}
      </SideDrawer>
      <SideDrawer open={drawer === 'history'} onClose={() => setDrawer(null)} title="Full history" icon={History}>
        {data.history && <PublicHistory events={data.history} people={data.people} />}
      </SideDrawer>
    </div>
  )
}

function ScoreRing({ score, size = 40 }: { score: number | null; size?: number }) {
  if (score === null) {
    return (
      <span className="shrink-0 rounded-full border border-dashed border-border flex items-center justify-center" style={{ width: size, height: size }}>
        <ListChecks className="w-1/2 h-1/2 text-muted" />
      </span>
    )
  }
  const stroke = Math.max(3, size * 0.08)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const tone = score >= 70 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger'
  return (
    <span className="relative shrink-0 inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle r={r} cx={size / 2} cy={size / 2} fill="none" strokeWidth={stroke} stroke="var(--color-gauge-bg)" />
        <circle r={r} cx={size / 2} cy={size / 2} fill="none" strokeWidth={stroke} stroke="currentColor" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} className={tone} />
      </svg>
      <span className="absolute font-mono tabular-nums font-semibold text-heading" style={{ fontSize: size * 0.32 }}>
        {score}
      </span>
    </span>
  )
}

/** "Behind this article": the score, how it was made, and links to the rules and the full history. */
function BehindRail({ data, onOpen }: { data: SharedArticle; onOpen: (d: Drawer) => void }) {
  const { score, client, totals } = data
  const ruleCount = useMemo(() => data.rules?.reduce((n, g) => n + g.rules.length, 0) ?? 0, [data.rules])
  const checked = score.rules ? score.rules.universal + score.rules.client : null
  const people = useMemo(() => {
    const m = new Map<string, { name: string; image: string | null }>()
    for (const st of data.story) for (const p of st.people) m.set(p.name, p)
    return [...m.values()]
  }, [data.story])

  return (
    <div className="glass-card p-5 space-y-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Behind this article</p>

      <div className="flex items-center gap-4">
        <ScoreRing score={score.overall} size={64} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-heading">{score.overall !== null ? 'Guideline score' : 'Guideline check pending'}</p>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            {score.overall === null
              ? 'Appears once an editor checks the draft.'
              : checked !== null
                ? `${checked} rules · ${score.rules!.universal} agency-wide · ${score.rules!.client} ${client.name}`
                : 'Checked against your brand and SEO guidelines'}
          </p>
          {data.rules && ruleCount > 0 && (
            <button type="button" onClick={() => onOpen('rules')} className="mt-1 text-xs text-accent hover:underline">
              See the rules
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-heading">How it was made</h2>
          <span className="text-[11px] text-muted">
            {totals.people} {totals.people === 1 ? 'person' : 'people'} · {totals.humanActions} human edits
          </span>
        </div>
        {people.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex -space-x-1.5">
              {people.slice(0, 5).map((p) => (
                <EventAvatar key={p.name} name={p.name} image={p.image} />
              ))}
            </div>
            <span className="text-xs text-muted truncate">{people.map((p) => p.name).join(', ')}</span>
          </div>
        )}
        <StoryTimeline steps={data.story} />
      </div>

      {data.history && data.history.length > 0 && (
        <button
          type="button"
          onClick={() => onOpen('history')}
          className="w-full inline-flex items-center justify-center gap-1.5 border border-border rounded-input px-3 py-2 text-sm text-heading hover:bg-surface-hover transition-colors"
        >
          <History className="w-4 h-4 text-accent" />
          See the full history
        </button>
      )}
    </div>
  )
}

function PublicHistory({ events, people }: { events: NonNullable<SharedArticle['history']>; people: Record<string, string> }) {
  return (
    <>
      {groupByDay(events).map((d) => (
        <section key={d.label} className="mb-5 last:mb-0">
          <h3 className="text-[11px] uppercase tracking-wider text-muted mb-2">{d.label}</h3>
          <ol className="space-y-2.5">
            {d.events.map((e) => {
              const meta = historyMeta(e)
              return (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <EventAvatar name={historyActor(e)} image={e.userImage} />
                  <p className="flex-1 min-w-0">
                    <span className="text-heading font-medium">{historyActor(e)}</span> {describeHistoryEvent(e, people)}
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
    </>
  )
}

function RulesList({ rules, clientName }: { rules: NonNullable<SharedArticle['rules']>; clientName: string }) {
  const tiers = [
    { tier: 'universal' as const, title: 'Agency-wide standards', note: 'Applied to every client' },
    { tier: 'client' as const, title: `${clientName} guidelines`, note: 'Your brand and SEO rules' },
  ]
  return (
    <div className="space-y-6">
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
  )
}

function SideDrawer({
  open,
  onClose,
  title,
  icon: Icon,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon: typeof BookOpen
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
            aria-label={title}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="fixed top-4 right-4 bottom-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] glass-card bg-surface shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <Icon className="w-4 h-4 text-accent" />
              <h2 className="font-display text-lg text-heading flex-1">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
