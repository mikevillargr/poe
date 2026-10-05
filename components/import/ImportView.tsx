'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowLeft, Check, Download, FileSpreadsheet, Loader2, RotateCcw, AlertTriangle, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import {
  FIELD_LABELS,
  IMPORT_FIELDS,
  autoMap,
  buildRows,
  guessHeaderRow,
  type ColumnMapping,
  type ImportField,
  type ImportRow,
} from '@/lib/import/mapping'
import type { RecentImport } from '@/lib/import/repo'

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

// DR-004 option A: Upload → Match & review → Confirm.
export function ImportView({
  client,
  existingTitles,
  recent,
}: {
  client: { id: string; name: string; slug: string }
  existingTitles: string[]
  recent: RecentImport[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({ title: null, brief: null, keywords: null, wordcount: null })
  const [includeOverride, setIncludeOverride] = useState<Record<number, boolean>>({})
  const [importing, setImporting] = useState(false)

  const headers = parsed?.grid[headerRow] ?? []
  const rows: ImportRow[] = useMemo(
    () => (parsed && mapping.title !== null ? buildRows(parsed.grid, headerRow, mapping, existingTitles) : []),
    [parsed, headerRow, mapping, existingTitles],
  )
  const included = (r: ImportRow) => r.errors.length === 0 && (includeOverride[r.sheetRow] ?? !r.duplicate)
  const selected = rows.filter(included)
  const errorCount = rows.filter((r) => r.errors.length).length
  const dupCount = rows.filter((r) => r.duplicate && !r.errors.length).length
  const ignored = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => h && !Object.values(mapping).includes(i))

  async function handleFile(file: File) {
    setParsing(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch<Parsed>(`/api/clients/${client.id}/articles/import/parse`, {
        method: 'POST',
        body: form,
        errorTitle: `Could not read ${file.name}`,
      })
      if (!res.grid.length) {
        toast.error(`${file.name} has no rows`)
        return
      }
      const hr = guessHeaderRow(res.grid)
      setParsed(res)
      setHeaderRow(hr)
      setMapping(autoMap(res.grid[hr] ?? []))
      setIncludeOverride({})
    } catch {
      // apiFetch already toasted
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function confirm() {
    if (!parsed || !selected.length) return
    setImporting(true)
    try {
      const { count } = await apiFetch<{ batchId: string; count: number }>(`/api/clients/${client.id}/articles/import`, {
        method: 'POST',
        errorTitle: 'Import failed',
        body: {
          filename: parsed.filename,
          rows: selected.map((r) => ({
            sheetRow: r.sheetRow,
            title: r.title,
            brief: r.brief,
            keywords: r.keywords,
            targetWordCount: r.targetWordCount,
          })),
          skipped: rows
            .filter((r) => !included(r))
            .map((r) => ({ row: r.sheetRow, message: r.errors[0] ?? 'Duplicate title (skipped)' })),
        },
      })
      toast.success(`${count} ${count === 1 ? 'article' : 'articles'} added from ${parsed.filename}`)
      router.push(`/c/${client.slug}`)
      router.refresh()
    } catch {
      setImporting(false)
    }
  }

  function reset() {
    setParsed(null)
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
            Columns: <span className="font-mono">title</span>, <span className="font-mono">brief</span>,{' '}
            <span className="font-mono">keywords</span>, <span className="font-mono">wordcount</span>. Rows are added to the end of the queue in sheet order.
          </p>
        </div>
        {parsed && (
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
        {!parsed ? (
          <motion.div key="upload" variants={itemVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="space-y-8">
            {/* Step 1: Upload */}
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

            <div className="flex items-center justify-between">
              <a
                href={`/api/clients/${client.id}/articles/import/template`}
                className="inline-flex items-center gap-2 text-sm text-body hover:text-accent transition-colors"
              >
                <Download className="w-4 h-4" /> Download template
              </a>
            </div>

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
                      setMapping(autoMap(parsed.grid[hr] ?? []))
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
                {IMPORT_FIELDS.map((f: ImportField) => (
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
                          const hasError = r.errors.length > 0
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
                                  disabled={hasError}
                                  onChange={(e) => setIncludeOverride((o) => ({ ...o, [r.sheetRow]: e.target.checked }))}
                                  className="w-4 h-4 rounded border-border accent-[#E8450A] disabled:opacity-40"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-muted font-mono tabular-nums w-14">{r.sheetRow}</td>
                              <td className="px-4 py-3 text-sm min-w-[220px]">
                                <div className={r.title ? 'text-heading font-medium' : 'text-muted italic'}>{r.title || 'No title'}</div>
                                {hasError && (
                                  <div className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {r.errors.join(' · ')}
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
