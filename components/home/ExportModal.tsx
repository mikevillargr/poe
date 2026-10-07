'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Download, ExternalLink, FileSpreadsheet, Link2, Loader2, Sheet, X, XCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { openGoogleConnectWindow, waitForGoogleConnect } from '@/lib/google/client/connect-window'
import type { ArticleSummary } from '@/lib/articles/schemas'
import type { ExportEvent } from '@/app/api/clients/[clientId]/exports/route'

// DR-021: bulk export from Home: Poe preview links and/or Google Docs, as a Google Sheet, Excel file or CSV.

type Scope = 'selected' | 'drafted' | 'all'
type Format = 'sheet' | 'xlsx' | 'csv'
type ItemState = { title: string; state: 'pending' | 'done' | 'reused' | 'skipped' | 'failed'; message?: string }

const PENDING_PAGE = `<!doctype html><meta charset="utf-8"><title>Creating your Google Sheet…</title>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#4a4a4a;background:#fafaf8">
<p>Creating your Google Sheet… this tab opens it when it’s ready.</p></body>`

export function ExportModal({
  open,
  onClose,
  clientId,
  articles,
  selectedIds,
  initialScope,
}: {
  open: boolean
  onClose: () => void
  clientId: string
  articles: ArticleSummary[]
  selectedIds: string[]
  initialScope: Scope
}) {
  const { toast } = useToast()
  const [scope, setScope] = useState<Scope>(initialScope)
  const [poeLinks, setPoeLinks] = useState(true)
  const [docs, setDocs] = useState(false)
  const [linkSharing, setLinkSharing] = useState(true)
  const [format, setFormat] = useState<Format>('sheet')
  const [drive, setDrive] = useState<{ connected: boolean; email: string | null } | null>(null)
  const [running, setRunning] = useState(false)
  const [items, setItems] = useState<Map<string, ItemState>>(new Map())
  const [result, setResult] = useState<{ sheetUrl?: string; file?: { name: string; url: string } } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sheetTab = useRef<Window | null>(null)

  useEffect(() => {
    if (!open) return
    setScope(initialScope)
    setItems(new Map())
    setResult(null)
    setError(null)
    apiFetch<{ connected: boolean; email: string | null }>('/api/google/drive', { silent: true })
      .then(setDrive)
      .catch(() => setDrive({ connected: false, email: null }))
  }, [open, initialScope])

  const scoped = useMemo(() => {
    if (scope === 'selected') return articles.filter((a) => selectedIds.includes(a.id))
    if (scope === 'drafted') return articles.filter((a) => a.status !== 'queued')
    return articles
  }, [scope, articles, selectedIds])

  const needsGoogle = docs || format === 'sheet'
  const canRun = scoped.length > 0 && (poeLinks || docs) && !running

  async function connect() {
    const win = openGoogleConnectWindow()
    if (!win) return toast.error('The browser blocked the Google window', 'Allow pop-ups for this site, then try again.')
    const r = await waitForGoogleConnect(win)
    if (r.ok) setDrive({ connected: true, email: r.email ?? null })
    else if (r.message) toast.error('Couldn’t connect Google', r.message)
  }

  async function run() {
    setRunning(true)
    setError(null)
    setResult(null)
    setItems(new Map(scoped.map((a) => [a.id, { title: a.title, state: 'pending' }])))
    // Browsers allow one new tab per click: open it now, point it at the Sheet when it exists.
    if (format === 'sheet') {
      sheetTab.current = window.open('', '_blank')
      sheetTab.current?.document.write(PENDING_PAGE)
    }
    try {
      const res = await fetch(`/api/clients/${clientId}/exports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ articleIds: scoped.map((a) => a.id), poeLinks, docs, linkSharing, format }),
      })
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(d?.error ?? `Export failed (${res.status}).`)
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (line) handle(JSON.parse(line) as ExportEvent)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
      sheetTab.current?.close()
    } finally {
      setRunning(false)
    }
  }

  function handle(e: ExportEvent) {
    if (e.type === 'item') {
      setItems((m) => new Map(m).set(e.articleId, { title: e.title, state: e.state, message: e.message }))
    } else if (e.type === 'error') {
      setError(e.message)
      sheetTab.current?.close()
    } else if (e.type === 'done') {
      if (e.sheetUrl) {
        if (sheetTab.current && !sheetTab.current.closed) sheetTab.current.location.href = e.sheetUrl
        setResult({ sheetUrl: e.sheetUrl })
        toast.success('Google Sheet ready', 'It opened in a new tab.')
      } else if (e.base64 && e.filename) {
        const bytes = Uint8Array.from(atob(e.base64), (c) => c.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], { type: e.mime }))
        const a = document.createElement('a')
        a.href = url
        a.download = e.filename
        a.click()
        setResult({ file: { name: e.filename, url } })
        toast.success('Export downloaded', e.filename)
      }
    }
  }

  const list = [...items.values()]
  const finished = list.filter((i) => i.state !== 'pending').length
  const failed = list.filter((i) => i.state === 'failed').length
  const option = (on: boolean) =>
    `flex items-start gap-3 rounded-input border p-3 cursor-pointer transition-colors ${on ? 'border-accent/50 bg-accent/5' : 'border-border hover:bg-surface-hover'}`

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'var(--color-modal-backdrop)' }}
            onClick={() => !running && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Export articles"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="relative glass-card bg-surface w-full max-w-[560px] max-h-[88vh] flex flex-col"
            onKeyDown={(e) => e.key === 'Escape' && !running && onClose()}
          >
            <div className="p-6 border-b border-border flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-accent mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-display text-heading">Export articles</h2>
                <p className="text-sm text-muted">A sheet with one row per article: status, keywords, score, owner and the links you choose.</p>
              </div>
              <button type="button" onClick={onClose} disabled={running} aria-label="Close" className="p-1.5 text-muted hover:text-heading disabled:opacity-40">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {list.length === 0 ? (
                <>
                  <fieldset>
                    <legend className="text-sm font-medium text-heading mb-2">Articles</legend>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['selected', `Selected (${selectedIds.length})`],
                          ['drafted', `Drafted (${articles.filter((a) => a.status !== 'queued').length})`],
                          ['all', `All (${articles.length})`],
                        ] as const
                      )
                        .filter(([k]) => k !== 'selected' || selectedIds.length > 0)
                        .map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={scope === k}
                            onClick={() => setScope(k)}
                            className={`px-3 py-1.5 rounded-full text-sm border ${scope === k ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-body hover:bg-surface-hover'}`}
                          >
                            {label}
                          </button>
                        ))}
                    </div>
                  </fieldset>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-heading mb-2">Include</legend>
                    <label className={option(poeLinks)}>
                      <input type="checkbox" checked={poeLinks} onChange={(e) => setPoeLinks(e.target.checked)} className="mt-1 accent-[#E8450A]" />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm text-heading">
                          <Link2 className="w-4 h-4 text-accent" /> Poe preview links
                        </span>
                        <span className="block text-xs text-muted">The branded page with the score, how it was made, comments and sign-off. Creates a link where there isn’t one.</span>
                      </span>
                    </label>
                    <label className={option(docs)}>
                      <input type="checkbox" checked={docs} onChange={(e) => setDocs(e.target.checked)} className="mt-1 accent-[#E8450A]" />
                      <span>
                        <span className="flex items-center gap-1.5 text-sm text-heading">
                          <FileSpreadsheet className="w-4 h-4 text-accent" /> Google Docs
                        </span>
                        <span className="block text-xs text-muted">One Doc per drafted article in your Drive. An unchanged draft reuses its Doc.</span>
                        {docs && (
                          <span className="mt-2 flex items-center gap-2 text-xs text-body" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={linkSharing} onChange={(e) => setLinkSharing(e.target.checked)} className="accent-[#E8450A]" />
                            Anyone with the link can view the Docs
                          </span>
                        )}
                      </span>
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend className="text-sm font-medium text-heading mb-2">As</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['sheet', 'Google Sheet', Sheet],
                          ['xlsx', 'Excel (.xlsx)', FileSpreadsheet],
                          ['csv', 'CSV', Download],
                        ] as const
                      ).map(([k, label, Icon]) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={format === k}
                          onClick={() => setFormat(k)}
                          className={`rounded-input border px-3 py-2.5 text-sm flex flex-col items-center gap-1 ${format === k ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-body hover:bg-surface-hover'}`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {needsGoogle && drive && !drive.connected && (
                    <div className="rounded-input border border-warning/40 bg-warning/5 p-3 text-sm flex items-center gap-3">
                      <span className="flex-1 text-body">
                        {docs && format === 'sheet' ? 'The Google Docs and the Sheet are' : docs ? 'The Google Docs are' : 'The Google Sheet is'} created in your own Drive.
                        Connect Google once to continue.
                      </span>
                      <button type="button" onClick={() => void connect()} className="shrink-0 border border-border rounded-input px-3 py-1.5 text-sm text-heading hover:bg-surface-hover">
                        Connect Google
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-heading">
                      {running ? 'Exporting…' : error ? 'Export stopped' : 'Export finished'}
                      {failed > 0 && <span className="text-red-500"> · {failed} failed</span>}
                    </span>
                    <span className="font-mono tabular-nums text-muted">
                      {finished} / {list.length}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-[width] duration-300" style={{ width: `${list.length ? (finished / list.length) * 100 : 0}%` }} />
                  </div>
                  <ol className="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-border rounded-input border border-border">
                    {list.map((i, k) => (
                      <li key={k} className="px-3 py-2 flex items-start gap-2 text-sm">
                        {i.state === 'pending' ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted mt-0.5 shrink-0" />
                        ) : i.state === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${i.state === 'skipped' ? 'text-muted' : 'text-green-600'}`} />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-heading">{i.title}</span>
                          {(i.message || i.state === 'reused') && (
                            <span className={`block text-xs ${i.state === 'failed' ? 'text-red-500' : 'text-muted'}`}>{i.message ?? 'Draft unchanged: reused its Google Doc'}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {result?.sheetUrl && (
                    <a href={result.sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                      Open the Google Sheet <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {result?.file && (
                    <a href={result.file.url} download={result.file.name} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                      <Download className="w-3.5 h-3.5" /> Download {result.file.name} again
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-2">
              {list.length > 0 && !running ? (
                <>
                  <button type="button" onClick={() => setItems(new Map())} className="px-4 py-2 text-sm text-muted hover:text-heading">
                    Export again
                  </button>
                  <button type="button" onClick={onClose} className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={onClose} disabled={running} className="px-4 py-2 text-sm text-muted hover:text-heading disabled:opacity-40">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void run()}
                    disabled={!canRun || (needsGoogle && !drive?.connected)}
                    className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {running && <Loader2 className="w-4 h-4 animate-spin" />}
                    Export {scoped.length} article{scoped.length === 1 ? '' : 's'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
