'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowLeft, Check, FileSpreadsheet, Loader2, RotateCcw, AlertTriangle, AlertCircle, LayoutTemplate } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { openGoogleConnectWindow, waitForGoogleConnect } from '@/lib/google/client/connect-window'
import { useToast } from '@/hooks/useToast'
import { SheetFormatCard } from './SheetFormatCard'
import { calendarFormat, templateFormat } from '@/lib/import/sheet-format'
import {
  FIELD_LABELS,
  IMPORT_FIELDS,
  autoMap,
  buildRows,
  guessHeaderRow,
  templateAliases,
  type ColumnMapping,
  type ImportField,
  type ImportRow,
} from '@/lib/import/mapping'
import type { RecentImport } from '@/lib/import/repo'
import { useClientTemplates } from '@/components/workspace/TemplatePicker'

interface Parsed {
  filename: string
  sheetName: string
  grid: string[][]
  truncated: boolean
}

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}
const nf = new Intl.NumberFormat('en-US')
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

interface PagePreview {
  file: File
  rows: { row: number; title: string }[]
  skipped: { row: number; title: string; reason: string }[]
}

// DR-004 option A: Upload → Match & review → Confirm. DR-012: optionally into a content template, whose own
// columns (e.g. Item URL) are matched too and whose rows arrive set to that template.
export function ImportView({
  client,
  existingTitles,
  recent,
  google: initialGoogle,
}: {
  client: { id: string; name: string; slug: string }
  existingTitles: string[]
  recent: RecentImport[]
  /** DR-018: the person's own Google connection, used to read a pasted sheet link. */
  google: { connected: boolean; email: string | null; canReadSheets: boolean }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  // DR-018: import from a file, or from a Google Sheet link read with the person's own Google access.
  const [source, setSource] = useState<'file' | 'link'>('file')
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [google, setGoogle] = useState(initialGoogle)
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({ title: null, brief: null, keywords: null, wordcount: null })
  const [includeOverride, setIncludeOverride] = useState<Record<number, boolean>>({})
  const [importing, setImporting] = useState(false)
  const templates = useClientTemplates(client.id)
  const [templateId, setTemplateId] = useState('')
  const template = templates?.find((t) => t.id === templateId) ?? null
  const aliases = useMemo(() => templateAliases(template?.inputs), [template])
  const extraFields = template?.inputs.filter((f) => !(IMPORT_FIELDS as readonly string[]).includes(f.key)) ?? []
  const usesField = (f: ImportField) => f === 'title' || !template || template.inputs.some((i) => i.key === f)
  const [extraMap, setExtraMap] = useState<Record<string, number | null>>({})
  const [fromRow, setFromRow] = useState('')
  const [toRow, setToRow] = useState('')
  const [pagePreview, setPagePreview] = useState<PagePreview | null>(null)

  const headers = parsed?.grid[headerRow] ?? []
  const rows: ImportRow[] = useMemo(
    () => (parsed && mapping.title !== null ? buildRows(parsed.grid, headerRow, mapping, existingTitles) : []),
    [parsed, headerRow, mapping, existingTitles],
  )
  const cellAt = (r: ImportRow, col: number | null | undefined) => (col === null || col === undefined ? '' : String(parsed?.grid[r.sheetRow - 1]?.[col] ?? '').trim())
  const extraErrors = (r: ImportRow) => extraFields.filter((f) => f.required && !cellAt(r, extraMap[f.key])).map((f) => `Missing ${f.label}`)
  const inRange = (r: ImportRow) => (!fromRow || r.sheetRow >= Number(fromRow)) && (!toRow || r.sheetRow <= Number(toRow))
  const included = (r: ImportRow) =>
    r.errors.length === 0 && extraErrors(r).length === 0 && inRange(r) && (includeOverride[r.sheetRow] ?? !r.duplicate)
  const selected = rows.filter(included)
  const errorCount = rows.filter((r) => r.errors.length || extraErrors(r).length).length
  const dupCount = rows.filter((r) => r.duplicate && !r.errors.length).length
  const ignored = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => h && !Object.values(mapping).includes(i) && !Object.values(extraMap).includes(i))

  /** Template columns matched by their label or the template's aliases (the n8n column names). */
  function autoMapExtras(headers: string[]) {
    return Object.fromEntries(
      extraFields.map((f) => {
        const names = [f.label, ...(f.aliases ?? [])].map(norm)
        const i = headers.findIndex((h) => names.includes(norm(h ?? '')))
        return [f.key, i >= 0 ? i : null]
      }),
    )
  }

  /** Tribe community pages use their own sheet layout: the server reads it (dry run) for the preview. */
  async function previewPageTemplate(file: File) {
    const form = new FormData()
    form.append('file', file)
    form.append('dryRun', 'true')
    const res = await apiFetch<{ rows: PagePreview['rows']; skipped: PagePreview['skipped'] }>(
      `/api/clients/${client.id}/templates/${templateId}/import`,
      { method: 'POST', body: form, errorTitle: `Could not read ${file.name}` },
    )
    setPagePreview({ file, rows: res.rows ?? [], skipped: res.skipped ?? [] })
  }

  async function handleFile(file: File) {
    setParsing(true)
    try {
      if (template?.kind === 'page') {
        await previewPageTemplate(file)
        return
      }
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch<Parsed>(`/api/clients/${client.id}/articles/import/parse`, {
        method: 'POST',
        body: form,
        errorTitle: `Could not read ${file.name}`,
      })
      applyParsed(res)
    } catch {
      // apiFetch already toasted
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  /** A file or a sheet link was read: on to Match & review. */
  function applyParsed(res: Parsed) {
    if (!res.grid.length) {
      toast.error(`${res.filename} has no rows`)
      return
    }
    const hr = guessHeaderRow(res.grid, aliases)
    setParsed(res)
    setHeaderRow(hr)
    setMapping(autoMap(res.grid[hr] ?? [], aliases))
    setExtraMap(autoMapExtras(res.grid[hr] ?? []))
    setIncludeOverride({})
  }

  /** DR-018: read the pasted sheet; first connects Google (read-only Sheets) in a small window if needed. */
  async function readLink() {
    setLinkError(null)
    if (!link.trim()) return
    if (!google.connected || !google.canReadSheets) {
      const win = openGoogleConnectWindow()
      if (!win) {
        setLinkError('The browser blocked the Google window. Allow pop-ups for this site, then try again.')
        return
      }
      setParsing(true)
      const r = await waitForGoogleConnect(win)
      if (!r.ok) {
        setParsing(false)
        setLinkError(r.message ?? 'Google wasn’t connected.')
        return
      }
      setGoogle({ connected: true, email: r.email ?? google.email, canReadSheets: true })
    }
    setParsing(true)
    try {
      const res = await apiFetch<Parsed>(`/api/clients/${client.id}/articles/import/sheet-link`, {
        method: 'POST',
        body: { url: link.trim() },
        silent: true,
      })
      applyParsed(res)
    } catch (err) {
      if (err instanceof ApiFetchError && err.code === 'SHEETS_NOT_CONNECTED') {
        setGoogle((g) => ({ ...g, canReadSheets: false }))
        setLinkError('Connect Google to let Poe read your sheets.')
      } else {
        setLinkError(err instanceof Error ? err.message : 'Couldn’t read that sheet.')
      }
    } finally {
      setParsing(false)
    }
  }

  async function confirmPage() {
    if (!pagePreview || !template) return
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', pagePreview.file)
      const { added } = await apiFetch<{ added: number }>(`/api/clients/${client.id}/templates/${template.id}/import`, {
        method: 'POST',
        body: form,
        errorTitle: 'Import failed',
      })
      toast.success(`${added} ${added === 1 ? 'page' : 'pages'} added from ${pagePreview.file.name}`, template.name)
      router.push(`/c/${client.slug}`)
      router.refresh()
    } catch {
      setImporting(false)
    }
  }

  /** Per-row template inputs: the template's own columns, plus the sheet's word-count text for the prompt. */
  function rowInputs(r: ImportRow): Record<string, string> | undefined {
    if (!template) return undefined
    const out: Record<string, string> = {}
    for (const f of extraFields) {
      const v = cellAt(r, extraMap[f.key])
      if (v) out[f.key] = v
    }
    const wc = cellAt(r, mapping.wordcount).replace(/^=+/, '')
    if (wc && r.targetWordCount) out.wordCount = wc
    return out
  }

  async function confirm() {
    if (!parsed || !selected.length) return
    setImporting(true)
    try {
      const { count } = await apiFetch<{ batchId?: string; count: number }>(`/api/clients/${client.id}/articles/import`, {
        method: 'POST',
        errorTitle: 'Import failed',
        body: {
          filename: parsed.filename,
          templateId: template?.id,
          rows: selected.map((r) => ({
            sheetRow: r.sheetRow,
            title: r.title,
            brief: r.brief,
            keywords: r.keywords,
            targetWordCount: r.targetWordCount,
            inputs: rowInputs(r),
          })),
          skipped: rows
            .filter((r) => !included(r))
            .map((r) => ({ row: r.sheetRow, message: r.errors[0] ?? extraErrors(r)[0] ?? (inRange(r) ? 'Duplicate title (skipped)' : 'Outside the chosen rows') })),
        },
      })
      toast.success(`${count} ${count === 1 ? 'article' : 'articles'} added from ${parsed.filename}`, template ? template.name : undefined)
      router.push(`/c/${client.slug}`)
      router.refresh()
    } catch {
      setImporting(false)
    }
  }

  function reset() {
    setParsed(null)
    setPagePreview(null)
    setIncludeOverride({})
  }

  const selectCls =
    'w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-8 xl:p-10 max-w-[1200px] mx-auto">
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4 mb-8">
        <div>
          <Link href={`/c/${client.slug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> {client.name}
          </Link>
          <h1 className="text-3xl font-display text-heading">Import content calendar</h1>
          <p className="text-sm text-muted mt-1">
            {template ? (
              <>
                Into <span className="text-heading">{template.name}</span>: columns{' '}
                {template.inputs.map((f, i) => (
                  <span key={f.key}>
                    {i > 0 && ', '}
                    <span className="font-mono">{f.aliases?.[0] ?? f.label}</span>
                  </span>
                ))}
                . Rows are added to the end of the queue in sheet order, set to this template.
              </>
            ) : (
              <>
                Columns: <span className="font-mono">title</span>, <span className="font-mono">brief</span>,{' '}
                <span className="font-mono">keywords</span>, <span className="font-mono">wordcount</span>. Rows are added to the end of the queue in sheet order.
              </>
            )}
          </p>
        </div>
        {(parsed || pagePreview) && (
          <button type="button" onClick={reset} className="px-4 py-2 rounded-input text-sm border border-border text-body hover:text-heading hover:bg-surface-hover flex items-center gap-2 shrink-0">
            <RotateCcw className="w-4 h-4" /> Choose another file
          </button>
        )}
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <AnimatePresence mode="wait">
        {pagePreview && template ? (
          <motion.div key="page" variants={itemVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-display text-heading truncate">{pagePreview.file.name}</h2>
              <p className="text-xs text-muted">
                {template.name}: one page per community-page URL; keywords are the cells with a search volume in brackets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1 rounded-full bg-success/10 text-green-500 border border-success/20 font-mono tabular-nums">{pagePreview.rows.length} ready</span>
              {pagePreview.skipped.length > 0 && (
                <span className="px-3 py-1 rounded-full bg-danger/10 text-red-400 border border-danger/20 font-mono tabular-nums">{pagePreview.skipped.length} skipped</span>
              )}
            </div>
            <div className="glass-card p-0 overflow-hidden">
              <div className="max-h-[560px] overflow-y-auto custom-scrollbar divide-y divide-border">
                {pagePreview.rows.map((r) => (
                  <div key={r.row} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                    <span className="text-muted font-mono tabular-nums w-12">{r.row}</span>
                    <span className="text-heading">{r.title}</span>
                  </div>
                ))}
                {pagePreview.skipped.map((r) => (
                  <div key={`s${r.row}`} className="flex items-center gap-4 px-4 py-2.5 text-sm bg-danger/5">
                    <span className="text-muted font-mono tabular-nums w-12">{r.row}</span>
                    <span className="text-body">{r.title}</span>
                    <span className="text-xs text-red-400">{r.reason}</span>
                  </div>
                ))}
                {pagePreview.rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted">No community-page URLs found in this sheet.</div>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={reset} className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPage}
                disabled={!pagePreview.rows.length || importing}
                className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                Add {pagePreview.rows.length} {pagePreview.rows.length === 1 ? 'page' : 'pages'} to the queue
              </button>
            </div>
          </motion.div>
        ) : !parsed ? (
          <motion.div key="upload" variants={itemVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
            {templates && templates.some((t) => t.enabled) && (
              <div className="glass-card p-5 flex flex-col md:flex-row md:items-center gap-3">
                <label htmlFor="imp-template" className="text-sm font-medium text-heading flex items-center gap-2 shrink-0">
                  <LayoutTemplate className="w-4 h-4 text-accent" /> Template
                </label>
                <select id="imp-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`${selectCls} md:max-w-sm`}>
                  <option value="">Standard articles (no template)</option>
                  {templates
                    .filter((t) => t.enabled)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.kind === 'faq' ? 'FAQ' : t.kind === 'blog' ? 'Blog' : 'Page'}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted">
                  {template ? 'Rows arrive set to this template; Generate uses its prompt, link steps and checks.' : 'Each row becomes a standard article (research, then draft).'}
                </p>
              </div>
            )}
            {/* DR-018: a file, or a Google Sheet link read with your own Google access. */}
            <div className="flex items-center gap-3">
              <div role="tablist" aria-label="Import from" className="inline-flex p-1 rounded-input border border-border bg-surface">
                {(
                  [
                    ['file', 'Upload a file'],
                    ['link', 'Google Sheet link'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={source === value}
                    onClick={() => {
                      setSource(value)
                      setLinkError(null)
                    }}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      source === value ? 'bg-accent text-white' : 'text-body hover:text-heading hover:bg-surface-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {source === 'link' && google.connected && google.email && (
                <span className="text-xs text-muted truncate">Reads with your Google account ({google.email})</span>
              )}
            </div>

            {source === 'link' && template?.kind === 'page' ? (
              <div className="glass-card p-5 text-sm text-muted">
                {template.name} uses its own sheet layout. Upload the file for this template, or switch to Standard articles.
              </div>
            ) : source === 'link' ? (
              <form
                className="glass-card p-5 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void readLink()
                }}
              >
                <label htmlFor="imp-link" className="text-sm font-medium text-heading">
                  Google Sheet link
                </label>
                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    id="imp-link"
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value)
                      setLinkError(null)
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className={`${selectCls} flex-1 font-mono text-xs`}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={parsing || !link.trim()}
                    className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    {google.connected && google.canReadSheets ? 'Read sheet' : 'Connect Google and read'}
                  </button>
                </div>
                {linkError ? (
                  <p className="text-sm text-red-400" role="alert">
                    {linkError}
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    Any sheet you can open in Google works; no sharing needed. Copy the link while the right tab is open, or Poe reads the first tab.
                    {!(google.connected && google.canReadSheets) && ' The first time, Google asks you to let Poe read your sheets (read-only).'}
                  </p>
                )}
              </form>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => !parsing && inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFile(f)
                }}
                className="relative rounded-card p-[1px] overflow-hidden group cursor-pointer"
              >
                <div className={`absolute inset-0 dashed-border-animated transition-opacity ${dragOver ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`} />
                <div
                  className={`relative backdrop-blur-sm rounded-card p-14 flex flex-col items-center justify-center text-center m-[1px] transition-colors ${
                    dragOver ? 'bg-accent/5' : 'bg-background/80 hover:bg-surface-hover'
                  }`}
                >
                  <div className="w-14 h-14 bg-surface border border-border rounded-full flex items-center justify-center mb-4 group-hover:animate-bounce-subtle">
                    {parsing ? (
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-6 h-6 text-accent drop-shadow-[0_0_8px_rgba(232,69,10,0.5)]" />
                    )}
                  </div>
                  <h3 className="text-heading font-medium mb-1 text-lg">{parsing ? 'Reading sheet…' : 'Drop the content calendar here'}</h3>
                  <p className="text-sm text-muted">.xlsx, .xls or .csv · up to 5 MB and 1,000 rows · first sheet only</p>
                </div>
              </div>
            )}

            <SheetFormatCard format={template ? templateFormat(template) : calendarFormat()} clientId={client.id} clientSlug={client.slug} />

            <div>
              <h2 className="text-lg font-display text-heading mb-3">Recent imports</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No imports yet for {client.name}.</p>
              ) : (
                <div className="glass-card divide-y divide-border">
                  {recent.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <FileSpreadsheet className="w-4 h-4 text-muted shrink-0" />
                      <span className="text-heading truncate flex-1">{r.filename}</span>
                      <span className="text-muted font-mono tabular-nums">{nf.format(r.rowCount)} rows</span>
                      <span className="text-muted w-28 truncate">{r.userName ?? '—'}</span>
                      <span className="text-muted font-mono w-24 text-right">
                        {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="review" variants={itemVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-6">
            {/* Step 2: Match & review */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <h2 className="text-lg font-display text-heading truncate">{parsed.filename}</h2>
                  <p className="text-xs text-muted">
                    Sheet “{parsed.sheetName}”{parsed.truncated && ' · only the first 1,000 rows were read'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted shrink-0">
                  Header is on row
                  <select
                    value={headerRow}
                    onChange={(e) => {
                      const hr = Number(e.target.value)
                      setHeaderRow(hr)
                      setMapping(autoMap(parsed.grid[hr] ?? [], aliases))
                      setExtraMap(autoMapExtras(parsed.grid[hr] ?? []))
                    }}
                    className="px-2 py-1 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading font-mono"
                  >
                    {parsed.grid.slice(0, 10).map((_, i) => (
                      <option key={i} value={i}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {IMPORT_FIELDS.filter(usesField).map((f: ImportField) => (
                  <div key={f}>
                    <label className="flex items-center justify-between text-sm font-medium text-heading mb-1.5">
                      <span>
                        {FIELD_LABELS[f]}
                        {f === 'title' && <span className="text-accent"> *</span>}
                      </span>
                      {mapping[f] !== null && <Check className="w-4 h-4 text-green-500" />}
                    </label>
                    <select
                      value={mapping[f] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === '' ? null : Number(e.target.value) }))}
                      className={selectCls}
                    >
                      <option value="">— Not in this sheet —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {extraFields.map((f) => (
                  <div key={f.key}>
                    <label className="flex items-center justify-between text-sm font-medium text-heading mb-1.5">
                      <span>
                        {f.label}
                        {f.required && <span className="text-accent"> *</span>}
                      </span>
                      {extraMap[f.key] !== null && extraMap[f.key] !== undefined && <Check className="w-4 h-4 text-green-500" />}
                    </label>
                    <select
                      value={extraMap[f.key] ?? ''}
                      onChange={(e) => setExtraMap((m) => ({ ...m, [f.key]: e.target.value === '' ? null : Number(e.target.value) }))}
                      className={selectCls}
                    >
                      <option value="">— Not in this sheet —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {ignored.length > 0 && (
                <p className="text-xs text-muted mt-3">
                  Ignored columns: {ignored.map(({ h }) => h).join(', ')}
                </p>
              )}
            </div>

            {mapping.title === null ? (
              <div className="glass-card p-6 flex items-center gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-body">Choose which column holds the article title to preview the rows.</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="px-3 py-1 rounded-full bg-success/10 text-green-500 border border-success/20 font-mono tabular-nums">
                    {selected.length} ready
                  </span>
                  {errorCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-danger/10 text-red-400 border border-danger/20 font-mono tabular-nums">
                      {errorCount} with errors
                    </span>
                  )}
                  {dupCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-warning/10 text-orange-500 border border-warning/20 font-mono tabular-nums">
                      {dupCount} possible {dupCount === 1 ? 'duplicate' : 'duplicates'}
                    </span>
                  )}
                  <span className="flex-1" />
                  <label className="flex items-center gap-2 text-sm text-muted">
                    Only rows
                    <input
                      inputMode="numeric"
                      value={fromRow}
                      onChange={(e) => setFromRow(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="from"
                      aria-label="First sheet row to import"
                      className="w-20 px-2 py-1 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading font-mono text-sm"
                    />
                    –
                    <input
                      inputMode="numeric"
                      value={toRow}
                      onChange={(e) => setToRow(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="to"
                      aria-label="Last sheet row to import"
                      className="w-20 px-2 py-1 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading font-mono text-sm"
                    />
                  </label>
                </div>

                <div className="glass-card p-0 overflow-hidden">
                  <div className="overflow-x-auto max-h-[560px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-surface z-10">
                        <tr>
                          {['', 'Row', 'Title', 'Keywords', 'Words', 'Brief'].map((h) => (
                            <th key={h} className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((r) => {
                          const hasError = r.errors.length > 0 || extraErrors(r).length > 0
                          const on = included(r)
                          return (
                            <tr
                              key={r.sheetRow}
                              className={`${hasError ? 'bg-danger/5' : r.duplicate ? 'bg-warning/5' : ''} ${on ? '' : 'opacity-70'}`}
                            >
                              <td className="px-4 py-3 w-10">
                                <input
                                  type="checkbox"
                                  aria-label={`Include row ${r.sheetRow}`}
                                  checked={on}
                                  disabled={hasError || !inRange(r)}
                                  onChange={(e) => setIncludeOverride((o) => ({ ...o, [r.sheetRow]: e.target.checked }))}
                                  className="w-4 h-4 rounded border-border accent-[#E8450A] disabled:opacity-40"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-muted font-mono tabular-nums w-14">{r.sheetRow}</td>
                              <td className="px-4 py-3 text-sm min-w-[220px]">
                                <div className={r.title ? 'text-heading font-medium' : 'text-muted italic'}>{r.title || 'No title'}</div>
                                {extraFields.map((f) =>
                                  cellAt(r, extraMap[f.key]) ? (
                                    <div key={f.key} className="text-xs text-muted mt-0.5 truncate max-w-[360px]">
                                      {f.label}: {cellAt(r, extraMap[f.key])}
                                    </div>
                                  ) : null,
                                )}
                                {hasError && (
                                  <div className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {[...r.errors, ...extraErrors(r)].join(' · ')}
                                  </div>
                                )}
                                {!hasError && r.duplicate && (
                                  <div className="text-xs text-orange-500 mt-0.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Same title as an article already in the queue
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                  {r.keywords.slice(0, 3).map((k, i) => (
                                    <span
                                      key={k}
                                      className={`px-2 py-0.5 rounded-full text-xs border truncate max-w-[180px] ${
                                        i === 0 ? 'border-accent/40 text-accent bg-accent/10' : 'border-border text-body bg-surface'
                                      }`}
                                    >
                                      {k}
                                    </span>
                                  ))}
                                  {r.keywords.length > 3 && <span className="text-xs text-muted self-center">+{r.keywords.length - 3}</span>}
                                  {r.keywords.length === 0 && <span className="text-xs text-muted">—</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm font-mono tabular-nums text-body whitespace-nowrap">
                                {r.targetWordCount ? nf.format(r.targetWordCount) : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted max-w-[320px]">
                                <div className="line-clamp-2">{r.brief ?? '—'}</div>
                              </td>
                            </tr>
                          )
                        })}
                        {rows.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                              No rows below the header.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Step 3: Confirm */}
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={reset} className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={!selected.length || importing}
                    className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add {selected.length} {selected.length === 1 ? 'article' : 'articles'} to the queue
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
