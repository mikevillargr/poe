'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, PenLine, X } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { useAIStream } from '@/lib/ai/client/useAIStream'
import type { AIStreamEvent } from '@/lib/ai/types'
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from '@/lib/articles/schemas'
import type { ArticleVersionDTO, ResearchEdit, WorkspaceResearch } from '@/lib/pipeline/schemas'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import { VersionHistory } from '@/components/VersionHistory'
import { WorkspaceHeader, type PrimaryAction } from './WorkspaceHeader'
import { BriefPanel, type BriefPatch } from './BriefPanel'
import { ResearchTab } from './ResearchTab'
import { DraftTab } from './DraftTab'
import { OptimizePanel } from './OptimizePanel'
import { useEditorApi } from './useEditorApi'
import { useDebouncedPatch } from './useDebouncedPatch'
import { exportDocx, exportToGoogleDrive } from './export'
import {
  hasDraft,
  hasResearch,
  toWorkspaceArticle,
  type ModelsInUse,
  type WorkspaceArticle,
  type WorkspaceClient,
  type WorkspacePerson,
} from './types'

type Tab = 'research' | 'draft'
type RawArticle = Record<string, unknown>

const WIDE_QUERY = '(min-width: 1440px)'
const nf = new Intl.NumberFormat('en-US')

function useMediaQuery(query: string, initial: boolean) {
  const [matches, setMatches] = useState(initial)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const on = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/** Ref-backed event handler so useAIStream (which captures onEvent once) always calls the latest. */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

// DR-005 Option A: Brief | Research/Draft tabs | Optimize.
export function WorkspaceView({
  client,
  initialArticle,
  people,
  models,
  isSuperAdmin,
}: {
  client: WorkspaceClient
  initialArticle: WorkspaceArticle
  people: WorkspacePerson[]
  models: ModelsInUse
  isSuperAdmin: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const base = `/api/clients/${client.id}/articles/${initialArticle.id}`

  const [article, setArticle] = useState(initialArticle)
  const [tab, setTab] = useState<Tab>(hasDraft(initialArticle) || initialArticle.templateId ? 'draft' : 'research')
  const [editorGen, setEditorGen] = useState(0)
  const [liveHtml, setLiveHtml] = useState(initialArticle.draftHtml ?? '')
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null)
  const [versions, setVersions] = useState<ArticleVersionDTO[]>([])
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [confirm, setConfirm] = useState<'regenerate' | 'delete' | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [researchSaving, setResearchSaving] = useState(false)

  const wide = useMediaQuery(WIDE_QUERY, true)
  const [briefOpen, setBriefOpen] = useState(true)
  const [optimizeOpen, setOptimizeOpen] = useState(true)
  useEffect(() => {
    setBriefOpen(wide)
    setOptimizeOpen(wide)
  }, [wide])

  const editorRef = useRef<Editor | null>(null)
  const editorApi = useEditorApi(editorRef)
  const draftDirty = useRef(false)

  // ── persistence ────────────────────────────────────────────────────────────────────────────
  const fieldPatch = useDebouncedPatch<BriefPatch & { title?: string }, { article: RawArticle }>({
    url: base,
    errorTitle: 'Couldn’t save the brief',
  })
  const researchPatch = useDebouncedPatch<ResearchEdit, { research: WorkspaceResearch }>({
    url: `${base}/research`,
    errorTitle: 'Couldn’t save the research',
  })

  const saveDraft = useCallback(
    async (html: string) => {
      draftDirty.current = false
      try {
        const { article: saved } = await apiFetch<{ article: RawArticle }>(base, {
          method: 'PATCH',
          body: { draftHtml: html },
          errorTitle: 'Couldn’t save the draft',
        })
        setArticle((a) => ({ ...a, draftHtml: html, wordCount: (saved.wordCount as number | null) ?? a.wordCount }))
      } catch (err) {
        draftDirty.current = true
        throw err
      }
    },
    [base],
  )

  /** Sends every pending autosave so server-side steps see the latest brief, research and draft. */
  const flushAll = useCallback(async () => {
    await Promise.all([fieldPatch.flush(), researchPatch.flush()])
    const editor = editorRef.current
    if (draftDirty.current && editor && !editor.isDestroyed) await saveDraft(editor.getHTML())
  }, [fieldPatch, researchPatch, saveDraft])

  const refetch = useCallback(async () => {
    const { article: raw } = await apiFetch<{ article: RawArticle }>(base, { errorTitle: 'Couldn’t reload the article' })
    const next = toWorkspaceArticle(raw)
    setArticle(next)
    return next
  }, [base])

  function patchFields(patch: BriefPatch & { title?: string }) {
    setArticle((a) => ({ ...a, ...patch, keywords: patch.keywords ?? a.keywords }))
    fieldPatch.schedule(patch)
  }

  function editResearch(edit: ResearchEdit, next: WorkspaceResearch) {
    setArticle((a) => ({ ...a, research: next }))
    researchPatch.schedule(edit)
  }

  // Timestamp of when a live stream last toasted/handled an outcome, so the polling path doesn't repeat it.
  const handledLocally = useRef({ research: 0, generation: 0 })

  // ── research stream ───────────────────────────────────────────────────────────────────────
  const onResearchEvent = useLatest((ev: AIStreamEvent) => {
    if (ev.type === 'done') setResearchSaving(true)
    if (ev.type === 'saved') {
      handledLocally.current.research = Date.now()
      setResearchSaving(false)
      refetch()
        .then((a) => toast.success('Research ready', `${a.research?.citations.length ?? 0} sources · ${a.research?.queries.length ?? 0} searches`))
        .catch(() => {})
    }
    if (ev.type === 'error') {
      setResearchSaving(false)
      if (ev.code === 'CONFLICT') toast.info('Already running', ev.message)
      else {
        handledLocally.current.research = Date.now()
        toast.error('Research failed', ev.message)
      }
      refetch().catch(() => {})
    }
  })
  const research = useAIStream({ onEvent: (ev) => onResearchEvent.current(ev) })

  // ── generation stream ─────────────────────────────────────────────────────────────────────
  const onGenerateEvent = useLatest((ev: AIStreamEvent) => {
    if (ev.type === 'saved') {
      handledLocally.current.generation = Date.now()
      refetch()
        .then((a) => {
          setLiveHtml(a.draftHtml ?? '')
          setEditorGen((g) => g + 1)
          const target = a.targetWordCount
          const words = a.wordCount ?? 0
          if (target && (words < target * 0.9 || words > target * 1.1)) {
            toast.warning('Draft generated, off target length', `${nf.format(words)} words vs. a target of ${nf.format(target)}.`)
          } else {
            toast.success('Draft generated', `${nf.format(words)} words · saved as v${ev.versionNo ?? '?'}`)
          }
          if (versionsOpen) void loadVersions()
        })
        .catch(() => {})
    }
    if (ev.type === 'error') {
      if (ev.code === 'CONFLICT') toast.info('Already running', ev.message)
      else {
        handledLocally.current.generation = Date.now()
        toast.error('Generation failed', ev.message)
      }
      refetch().catch(() => {})
    }
  })
  const generation = useAIStream({ onEvent: (ev) => onGenerateEvent.current(ev) })

  // ── revise-with-feedback stream (DR-009) ───────────────────────────────────────────────────
  // Shares the server's 'generation' run slot and generation_status, so reload/stale recovery below
  // treats it exactly like a generation run.
  const [reviseOpen, setReviseOpen] = useState(false)
  const [reviseFeedback, setReviseFeedback] = useState('')
  const onReviseEvent = useLatest((ev: AIStreamEvent) => {
    if (ev.type === 'saved') {
      handledLocally.current.generation = Date.now()
      setReviseFeedback('')
      setReviseOpen(false)
      refetch()
        .then((a) => {
          setLiveHtml(a.draftHtml ?? '')
          setEditorGen((g) => g + 1)
          const target = a.targetWordCount
          const words = a.wordCount ?? 0
          if (target && (words < target * 0.9 || words > target * 1.1)) {
            toast.info('Revised, off target length', `${nf.format(words)} words vs. a target of ${nf.format(target)}. Previous draft: “Before revision” in Versions.`)
          } else {
            toast.success('Revised', `${nf.format(words)} words · previous draft saved as “Before revision”`)
          }
          if (versionsOpen) void loadVersions()
        })
        .catch(() => {})
    }
    if (ev.type === 'error') {
      if (ev.code === 'CONFLICT') toast.info('Already running', ev.message)
      else {
        handledLocally.current.generation = Date.now()
        if (ev.code === 'NO_DRAFT') toast.error('Nothing to revise yet', ev.message)
        else toast.error('Revision failed', ev.message)
        setReviseOpen(true) // keep the feedback so it can be retried
      }
      refetch().catch(() => {})
    }
  })
  const revision = useAIStream({ onEvent: (ev) => onReviseEvent.current(ev) })

  const researching = research.status === 'streaming'
  const revising = revision.status === 'streaming'
  const generating = generation.status === 'streaming' || revising
  // The server is the source of truth: a run can be going without a stream attached to this page
  // (we left and came back, or the connection dropped).
  const researchRemote = article.researchStatus === 'running' && !researching && !researchSaving
  const generationRemote = article.generationStatus === 'running' && !generating
  const researchActive = researching || researchSaving || researchRemote
  const generationActive = generating || generationRemote
  const streaming = researchActive || generationActive

  // Streams that ended without a result (stopped elsewhere, dropped connection): re-sync with the server.
  useEffect(() => {
    if (research.status === 'aborted' || generation.status === 'aborted') setResearchSaving(false)
    for (const s of [research, generation, revision]) {
      if (s.status === 'error' && s.error?.code === 'NETWORK_ERROR') {
        toast.info('Connection lost', 'The run keeps going on the server. We’ll show it when it finishes.')
      }
    }
    if (
      ['aborted', 'done', 'error'].includes(research.status) ||
      ['aborted', 'done', 'error'].includes(generation.status) ||
      ['aborted', 'done', 'error'].includes(revision.status)
    ) {
      refetch().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [research.status, generation.status, revision.status])

  // Poll while the server reports a run we have no live stream for; pick up the result when it ends.
  useEffect(() => {
    if (!researchRemote && !generationRemote) return
    const t = setInterval(() => void refetch().catch(() => {}), 4000)
    return () => clearInterval(t)
  }, [researchRemote, generationRemote, refetch])

  const prevStatus = useRef({ research: initialArticle.researchStatus, generation: initialArticle.generationStatus })
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = { research: article.researchStatus, generation: article.generationStatus }
    if (prev.research === 'running' && article.researchStatus !== 'running') {
      if (Date.now() - handledLocally.current.research < 15000) handledLocally.current.research = 0
      else if (article.researchStatus === 'ready') {
        toast.success('Research ready', `${article.research?.citations.length ?? 0} sources · ${article.research?.queries.length ?? 0} searches`)
      } else if (article.researchStatus === 'error') {
        toast.error('Research didn’t finish', 'It failed or was interrupted. You can run it again.')
      }
    }
    if (prev.generation === 'running' && article.generationStatus !== 'running') {
      if (Date.now() - handledLocally.current.generation < 15000) handledLocally.current.generation = 0
      else if (article.generationStatus === 'ready') {
        setLiveHtml(article.draftHtml ?? '')
        setEditorGen((g) => g + 1)
        toast.success('Draft ready', `${nf.format(article.wordCount ?? 0)} words`)
        if (versionsOpen) void loadVersions()
      } else if (article.generationStatus === 'error') {
        toast.error('Generation didn’t finish', 'It failed or was interrupted. You can run it again.')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.researchStatus, article.generationStatus])

  // Runs continue on the server when you leave, so only unsaved editor changes warrant a warning.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!draftDirty.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  /** Explicit Stop: the only way to cancel. Cancels server-side, then detaches this page's stream. */
  async function stopRun(kind: 'research' | 'generation') {
    try {
      await apiFetch(`${base}/${kind === 'research' ? 'research' : 'generate'}`, { method: 'DELETE', errorTitle: 'Couldn’t stop the run' })
    } catch {
      return
    }
    const wasRevising = kind === 'generation' && revising
    ;(kind === 'research' ? research : generation).abort()
    if (kind === 'generation') revision.abort()
    setResearchSaving(false)
    refetch().catch(() => {})
    if (wasRevising) {
      setReviseOpen(true)
      toast.info('Revision stopped', 'Your draft is unchanged. “Before revision” is in Versions.')
    } else toast.info('Stopped', 'Nothing was saved from that run.')
  }

  async function runResearch() {
    if (researchActive || generationActive) return
    setTab('research')
    try {
      await flushAll()
    } catch {
      return
    }
    void research.start(`${base}/research`, {})
  }

  async function runGenerate(useResearch = true) {
    if (researchActive || generationActive) return
    setConfirm(null)
    try {
      await flushAll()
    } catch {
      return
    }
    setActiveSuggestionId(null)
    setTab('draft')
    void generation.start(`${base}/generate`, { useResearch })
  }

  async function runRevise() {
    const feedback = reviseFeedback.trim()
    if (!feedback || researchActive || generationActive) return
    try {
      await flushAll()
    } catch {
      return
    }
    setActiveSuggestionId(null)
    setReviseOpen(false)
    setTab('draft')
    void revision.start(`${base}/revise`, { feedback })
  }

  function requestGenerate(useResearch = true) {
    if (hasDraft(article)) {
      pendingUseResearch.current = useResearch
      setConfirm('regenerate')
    } else void runGenerate(useResearch)
  }
  const pendingUseResearch = useRef(true)

  // ── status ────────────────────────────────────────────────────────────────────────────────
  async function moveStatus(to: ArticleStatus) {
    setStatusSaving(true)
    try {
      await flushAll()
      const { article: raw } = await apiFetch<{ article: RawArticle }>(base, {
        method: 'PATCH',
        body: { status: to },
        errorTitle: 'Couldn’t change the status',
      })
      setArticle((a) => ({ ...a, status: toWorkspaceArticle(raw).status }))
      toast.success(`Moved to ${ARTICLE_STATUS_LABELS[to]}`)
      router.refresh()
    } catch {
      // toasted
    } finally {
      setStatusSaving(false)
    }
  }

  function onPrimary(action: Exclude<PrimaryAction, null>) {
    if (action === 'research') void runResearch()
    else if (action === 'generate') requestGenerate(true)
    else if (action === 'review') void moveStatus('in_review')
    else void moveStatus('done')
  }

  // ── versions ──────────────────────────────────────────────────────────────────────────────
  async function loadVersions() {
    setVersionsLoading(true)
    try {
      const { versions: list } = await apiFetch<{ versions: ArticleVersionDTO[] }>(`${base}/versions`, {
        errorTitle: 'Couldn’t load versions',
      })
      setVersions(list)
    } catch {
      // toasted
    } finally {
      setVersionsLoading(false)
    }
  }

  async function saveVersion(label?: string) {
    await flushAll()
    const { version } = await apiFetch<{ version: ArticleVersionDTO }>(`${base}/versions`, {
      method: 'POST',
      body: { label: label || undefined },
      errorTitle: 'Couldn’t save the version',
    })
    setVersions((v) => [version, ...v])
    toast.success(`Saved v${version.versionNo}`, version.label ?? undefined)
  }

  async function restore(v: ArticleVersionDTO) {
    await flushAll()
    const res = await apiFetch<{ article: RawArticle; version: ArticleVersionDTO }>(`${base}/versions/${v.versionNo}/restore`, {
      method: 'POST',
      errorTitle: 'Restore failed',
    })
    const next = toWorkspaceArticle(res.article)
    setArticle(next)
    setLiveHtml(next.draftHtml ?? '')
    setActiveSuggestionId(null)
    setEditorGen((g) => g + 1)
    setTab('draft')
    toast.success(`Restored v${v.versionNo}`, 'The previous draft was saved as a version first.')
    void loadVersions()
  }

  // ── export / delete ───────────────────────────────────────────────────────────────────────
  const currentHtml = () => editorApi.getHTML() || article.draftHtml || ''

  async function onExportDrive() {
    try {
      const url = await exportToGoogleDrive(article.title, currentHtml())
      window.open(url, '_blank', 'noopener')
      toast.success('Saved to Google Drive')
    } catch (err) {
      toast.error('Google Drive export failed', err instanceof Error ? err.message : 'Please try again.')
    }
  }

  async function confirmDelete() {
    setConfirm(null)
    try {
      await apiFetch(base, { method: 'DELETE', errorTitle: 'Delete failed' })
      toast.success('Article deleted', article.title)
      router.push(`/c/${client.slug}`)
      router.refresh()
    } catch {
      // toasted
    }
  }

  // ── layout ────────────────────────────────────────────────────────────────────────────────
  const brief = (
    <BriefPanel
      article={article}
      people={people}
      models={models}
      isSuperAdmin={isSuperAdmin}
      disabled={streaming}
      onChange={patchFields}
      onTemplateSaved={(next) => setArticle((a) => ({ ...a, ...next }))}
    />
  )
  const optimize = (
    <OptimizePanel
      clientId={client.id}
      articleId={article.id}
      html={liveHtml}
      keywords={article.keywords}
      primaryKeyword={article.primaryKeyword}
      targetWordCount={article.targetWordCount}
      editorApi={editorApi}
      activeSuggestionId={activeSuggestionId}
      onActiveSuggestionChange={setActiveSuggestionId}
    />
  )

  const tabBtn = (t: Tab, label: string, Icon: typeof BookOpen, badge?: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`relative px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors ${
        tab === t ? 'text-heading' : 'text-muted hover:text-heading'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge && <span className="text-xs font-mono tabular-nums text-muted">{badge}</span>}
      {tab === t && <motion.div layoutId="ws-tab" className="absolute left-2 right-2 -bottom-px h-0.5 bg-accent rounded-full" />}
    </button>
  )

  return (
    <div className="h-screen flex flex-col bg-background">
      <WorkspaceHeader
        clientSlug={client.slug}
        article={article}
        busy={streaming}
        statusSaving={statusSaving}
        showBriefToggle
        showOptimizeToggle
        briefOpen={briefOpen}
        optimizeOpen={optimizeOpen}
        onToggleBrief={() => setBriefOpen((o) => !o)}
        onToggleOptimize={() => setOptimizeOpen((o) => !o)}
        onTitleChange={(title) => patchFields({ title })}
        onPrimary={onPrimary}
        onMoveBack={moveStatus}
        onChangeStatus={moveStatus}
        onExportDocx={() => {
          try {
            exportDocx(article.title, currentHtml())
          } catch (err) {
            toast.error('Export failed', err instanceof Error ? err.message : undefined)
          }
        }}
        onExportDrive={onExportDrive}
        onDelete={() => setConfirm('delete')}
      />

      <div className="flex-1 flex min-h-0 relative">
        {/* Left: Brief */}
        {wide ? (
          <AnimatePresence initial={false}>
            {briefOpen && (
              <motion.aside
                key="brief"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="shrink-0 border-r border-border bg-background overflow-y-auto overflow-x-hidden custom-scrollbar"
                aria-label="Brief"
              >
                <div className="w-[300px]">{brief}</div>
              </motion.aside>
            )}
          </AnimatePresence>
        ) : (
          <Drawer side="left" open={briefOpen} onClose={() => setBriefOpen(false)} title="Brief">
            {brief}
          </Drawer>
        )}

        {/* Center: tabs */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div role="tablist" className="shrink-0 border-b border-border px-4 flex items-center gap-1 bg-background">
            {tabBtn('research', 'Research', BookOpen, hasResearch(article) ? `${article.research?.citations.length ?? 0} sources` : undefined)}
            {tabBtn(
              'draft',
              'Draft',
              PenLine,
              article.wordCount ? `${nf.format(article.wordCount)}${article.targetWordCount ? ` / ${nf.format(article.targetWordCount)}` : ''}` : undefined,
            )}
          </div>
          {tab === 'research' ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <ResearchTab
                article={article}
                models={models}
                stream={{
                  active: researchActive,
                  remote: researchRemote,
                  searches: research.searches,
                  citations: research.citations,
                  text: research.text,
                  saving: researchSaving,
                }}
                generating={generationActive}
                onRun={runResearch}
                onStop={() => void stopRun('research')}
                onEdit={editResearch}
                onGenerate={(useResearch) => requestGenerate(useResearch)}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <DraftTab
                article={article}
                models={models}
                editorKey={`${article.id}:${editorGen}`}
                editorRef={editorRef}
                streaming={generationActive}
                remote={generationRemote}
                streamText={revising ? revision.text : generation.text}
                activeSuggestionId={activeSuggestionId}
                onClearSuggestion={() => {
                  setActiveSuggestionId(null)
                  editorApi.highlight([])
                }}
                onSave={saveDraft}
                onContentChange={(html) => {
                  draftDirty.current = true
                  setLiveHtml(html)
                }}
                onEditorReady={(e) => setLiveHtml(e.getHTML())}
                onSaveVersion={() => void saveVersion().catch(() => {})}
                onOpenVersions={() => {
                  setVersionsOpen(true)
                  void loadVersions()
                }}
                onRegenerate={() => requestGenerate(true)}
                onGenerate={() => requestGenerate(true)}
                onStop={() => void stopRun('generation')}
                revising={revising}
                reviseOpen={reviseOpen}
                onReviseOpenChange={setReviseOpen}
                feedback={reviseFeedback}
                onFeedback={setReviseFeedback}
                onRevise={() => void runRevise()}
                aiEditUrl={`${base}/ai-edit`}
              />
            </div>
          )}
        </main>

        {/* Right: Optimize (WS optimize mounts its panel here) */}
        {wide ? (
          <AnimatePresence initial={false}>
            {optimizeOpen && (
              <motion.aside
                key="optimize"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="shrink-0 border-l border-border bg-background overflow-hidden"
                aria-label="Optimize"
              >
                <div className="w-[320px] h-full">{optimize}</div>
              </motion.aside>
            )}
          </AnimatePresence>
        ) : (
          <Drawer side="right" open={optimizeOpen} onClose={() => setOptimizeOpen(false)} title="Optimize">
            {optimize}
          </Drawer>
        )}
      </div>

      <AnimatePresence>
        {versionsOpen && (
          <VersionHistory
            versions={versions}
            loading={versionsLoading}
            onClose={() => setVersionsOpen(false)}
            onRestore={restore}
            onCreate={(label) => saveVersion(label)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirm === 'regenerate'}
        title="Regenerate the draft?"
        message="The current draft is saved as a version first (“Before regenerate”), so you can restore it from Versions."
        confirmLabel="Regenerate"
        confirmVariant="warning"
        onConfirm={() => void runGenerate(pendingUseResearch.current)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        isOpen={confirm === 'delete'}
        title="Delete article"
        message={`“${article.title}” will be permanently deleted, including its research, draft and version history. This can’t be undone.`}
        confirmLabel="Delete article"
        confirmVariant="danger"
        requireText="delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function Drawer({
  side,
  open,
  onClose,
  title,
  children,
}: {
  side: 'left' | 'right'
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-30 flex" style={{ justifyContent: side === 'left' ? 'flex-start' : 'flex-end' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'var(--color-modal-backdrop)' }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: side === 'left' ? -340 : 340 }}
            animate={{ x: 0, transition: { type: 'spring', stiffness: 320, damping: 34 } }}
            exit={{ x: side === 'left' ? -340 : 340 }}
            className={`relative h-full w-[320px] bg-background shadow-2xl flex flex-col ${side === 'left' ? 'border-r' : 'border-l'} border-border`}
            role="dialog"
            aria-label={title}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          >
            <div className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-border">
              <span className="text-sm font-medium text-heading">{title}</span>
              <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="p-1 text-muted hover:text-heading">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
