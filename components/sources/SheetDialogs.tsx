'use client'

import { useEffect, useState } from 'react'
import { Sheet, RefreshCw, Loader2, Copy, AlertCircle } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import type { TemplateOption } from '@/components/workspace/TemplatePicker'
import { SourceModal, fieldCls, ghostBtn, labelCls, primaryBtn } from './SourceModal'
import type { Inventory } from './LinkListDialogs'

export interface SheetSource {
  id: string
  name: string
  spreadsheetId: string
  tab: string
  headerRow: number
  columnMap: Record<string, string>
  target: 'topics' | 'inventory'
  templateId: string | null
  templateName: string | null
  inventorySlug: string | null
  inventoryName: string | null
  seeded: boolean
  lastSyncedAt: string | null
  lastSyncResult: { at: string; added: number; skipped: number; errors: { row: number; message: string }[] } | null
}

const nf = new Intl.NumberFormat('en-US')

/** DR-011 "Add sheet" / edit: link + tab + what it feeds (+ optional link-list columns). */
export function SheetSourceModal({
  clientId,
  open,
  editing,
  templates,
  inventories,
  onClose,
  onSaved,
}: {
  clientId: string
  open: boolean
  editing: SheetSource | null
  templates: TemplateOption[]
  inventories: Inventory[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [sheet, setSheet] = useState('')
  const [tab, setTab] = useState('Sheet1')
  const [headerRow, setHeaderRow] = useState('1')
  const [target, setTarget] = useState<'topics' | 'inventory'>('topics')
  const [templateId, setTemplateId] = useState('')
  const [inventorySlug, setInventorySlug] = useState('')
  const [urlColumn, setUrlColumn] = useState('')
  const [titleColumn, setTitleColumn] = useState('')
  const [urlPrefix, setUrlPrefix] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setName(editing?.name ?? '')
    setSheet(editing ? `https://docs.google.com/spreadsheets/d/${editing.spreadsheetId}/edit` : '')
    setTab(editing?.tab ?? 'Sheet1')
    setHeaderRow(String(editing?.headerRow ?? 1))
    setTarget(editing?.target ?? 'topics')
    setTemplateId(editing?.templateId ?? '')
    setInventorySlug(editing?.inventorySlug ?? '')
    setUrlColumn(editing?.columnMap.url ?? '')
    setTitleColumn(editing?.columnMap.title ?? '')
    setUrlPrefix(editing?.columnMap.urlPrefix ?? '')
  }, [open, editing])

  async function save() {
    setSaving(true)
    setError(null)
    const columnMap: Record<string, string> = { ...(editing?.columnMap ?? {}) }
    for (const [k, v] of [
      ['url', urlColumn],
      ['title', titleColumn],
      ['urlPrefix', urlPrefix],
    ] as const) {
      if (v.trim()) columnMap[k] = v.trim()
      else delete columnMap[k]
    }
    try {
      await apiFetch(`/api/clients/${clientId}/sheet-sources${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        silent: true,
        body: {
          name: name.trim(),
          sheet: sheet.trim(),
          tab: tab.trim(),
          headerRow: Number(headerRow) || 1,
          target,
          templateId: target === 'topics' ? templateId || null : null,
          inventorySlug: target === 'inventory' ? inventorySlug || null : null,
          columnMap: target === 'inventory' ? columnMap : {},
        },
      })
      toast.success(editing ? 'Sheet updated' : 'Sheet added', name.trim())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : 'Couldn’t save the sheet.')
    } finally {
      setSaving(false)
    }
  }

  const valid = name.trim() && sheet.trim() && tab.trim() && (target === 'topics' ? templateId : inventorySlug)

  return (
    <SourceModal
      open={open}
      title={editing ? 'Edit sheet' : 'Add sheet'}
      icon={Sheet}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!valid || saving} className={primaryBtn}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Save' : 'Add sheet'}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="ss-name" className={labelCls}>
          Name
        </label>
        <input id="ss-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 content calendar" className={fieldCls} />
      </div>
      <div>
        <label htmlFor="ss-sheet" className={labelCls}>
          Google Sheet link
        </label>
        <input id="ss-sheet" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className={fieldCls} />
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <div>
          <label htmlFor="ss-tab" className={labelCls}>
            Tab
          </label>
          <input id="ss-tab" value={tab} onChange={(e) => setTab(e.target.value)} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="ss-header" className={labelCls}>
            Header row
          </label>
          <input id="ss-header" inputMode="numeric" value={headerRow} onChange={(e) => setHeaderRow(e.target.value.replace(/[^\d]/g, ''))} className={`${fieldCls} font-mono`} />
        </div>
      </div>
      <fieldset>
        <legend className={labelCls}>This sheet holds</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['topics', 'Topics to write', 'Rows become queued articles'],
              ['inventory', 'Links', 'Fills a link list for templates'],
            ] as const
          ).map(([value, title, hint]) => (
            <label
              key={value}
              className={`rounded-input border p-3 cursor-pointer transition-colors ${target === value ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface-hover'}`}
            >
              <input type="radio" name="ss-target" value={value} checked={target === value} onChange={() => setTarget(value)} className="sr-only" />
              <div className="text-sm font-medium text-heading">{title}</div>
              <div className="text-xs text-muted">{hint}</div>
            </label>
          ))}
        </div>
      </fieldset>
      {target === 'topics' ? (
        <div>
          <label htmlFor="ss-template" className={labelCls}>
            Template
          </label>
          <select id="ss-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={fieldCls}>
            <option value="">Choose a template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">Columns are matched by the template’s column names (e.g. Title, Prompt, SEO Keywords, Number of Words).</p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="ss-inventory" className={labelCls}>
              Link list
            </label>
            <select id="ss-inventory" value={inventorySlug} onChange={(e) => setInventorySlug(e.target.value)} className={fieldCls}>
              <option value="">Choose a link list</option>
              {inventories.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ss-url" className={labelCls}>
                URL column <span className="text-muted font-normal">(optional)</span>
              </label>
              <input id="ss-url" value={urlColumn} onChange={(e) => setUrlColumn(e.target.value)} placeholder="Found automatically" className={fieldCls} />
            </div>
            <div>
              <label htmlFor="ss-title" className={labelCls}>
                Title column <span className="text-muted font-normal">(optional)</span>
              </label>
              <input id="ss-title" value={titleColumn} onChange={(e) => setTitleColumn(e.target.value)} placeholder="Found automatically" className={fieldCls} />
            </div>
          </div>
          <div>
            <label htmlFor="ss-prefix" className={labelCls}>
              URL prefix <span className="text-muted font-normal">(only for slugs)</span>
            </label>
            <input id="ss-prefix" value={urlPrefix} onChange={(e) => setUrlPrefix(e.target.value)} placeholder="https://example.com/products/" className={fieldCls} />
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </SourceModal>
  )
}

interface TopicPreview {
  fromRow: number
  added: number
  rows: { row: number; title: string }[]
  skipped: { row: number; title: string; reason: string }[]
}
interface LinkPreview {
  items: number
  sample: { url: string; title: string | null }[]
}

/** DR-011 "Sync now": dry run first (rows that would be added / links found), then commit. */
export function SyncSheetModal({
  clientId,
  source,
  serviceEmail,
  onClose,
  onDone,
}: {
  clientId: string
  source: SheetSource | null
  serviceEmail: string | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const [fromRow, setFromRow] = useState('')
  const [needsFromRow, setNeedsFromRow] = useState(false)
  const [topics, setTopics] = useState<TopicPreview | null>(null)
  const [links, setLinks] = useState<LinkPreview | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(dryRun: boolean, row?: number) {
    if (!source) return
    setBusy(true)
    setError(null)
    try {
      const r = await apiFetch<Record<string, unknown>>(`/api/clients/${clientId}/sheet-sources/${source.id}/sync`, {
        method: 'POST',
        silent: true,
        body: { dryRun, ...(row ? { fromRow: row } : {}) },
      })
      if (!dryRun) {
        const n = Number(r.added ?? r.items ?? 0)
        toast.success(
          source.target === 'topics' ? `${n} ${n === 1 ? 'article' : 'articles'} added` : `${source.inventoryName ?? 'Link list'} updated`,
          source.target === 'topics' ? source.name : `${nf.format(n)} links`,
        )
        onDone()
        return
      }
      if (source.target === 'topics') setTopics(r as unknown as TopicPreview)
      else setLinks({ items: Number(r.items ?? 0), sample: (r.sample as LinkPreview['sample']) ?? [] })
    } catch (err) {
      const e = err instanceof ApiFetchError ? { code: err.code, message: err.message } : { code: 'ERROR', message: 'Sync failed.' }
      if (/First sync/.test(e.message)) setNeedsFromRow(true)
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    setTopics(null)
    setLinks(null)
    setError(null)
    setNeedsFromRow(false)
    setFromRow('')
    if (source) void run(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id])

  const row = fromRow ? Number(fromRow) : undefined
  const canCommit = source?.target === 'topics' ? !!topics && topics.added > 0 : !!links && links.items > 0

  return (
    <SourceModal
      open={!!source}
      title={`Sync ${source?.name ?? ''}`}
      icon={RefreshCw}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={() => run(false, topics?.fromRow ?? row)} disabled={!canCommit || busy} className={primaryBtn}>
            {busy && canCommit && <Loader2 className="w-4 h-4 animate-spin" />}
            {source?.target === 'topics'
              ? `Add ${topics?.added ?? 0} ${topics?.added === 1 ? 'article' : 'articles'}`
              : `Replace list with ${nf.format(links?.items ?? 0)} links`}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">
        Tab “{source?.tab}” →{' '}
        <span className="text-heading">{source?.target === 'topics' ? source?.templateName : source?.inventoryName}</span>
      </p>

      {needsFromRow && (
        <div className="rounded-input border border-accent/30 bg-accent/5 p-4 space-y-3">
          <p className="text-sm text-heading">First sync of this sheet: which row should Poe start from?</p>
          <p className="text-xs text-muted">Rows above it are skipped, so topics that were already written elsewhere don’t come back into the queue.</p>
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={fromRow}
              onChange={(e) => setFromRow(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 2"
              aria-label="Start from sheet row"
              className={`${fieldCls} w-32 font-mono`}
            />
            <button type="button" onClick={() => run(true, row)} disabled={!row || busy} className="px-4 py-2 rounded-input text-sm border border-border text-heading hover:bg-surface-hover disabled:opacity-50">
              Preview
            </button>
          </div>
        </div>
      )}

      {busy && !topics && !links && !error && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading the sheet…
        </div>
      )}

      {error && (
        <div className="rounded-input border border-danger/30 bg-danger/10 p-4 text-sm space-y-2">
          <div className="flex items-start gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error.message}
          </div>
          {error.code === 'SHEETS_FORBIDDEN' && serviceEmail && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(serviceEmail).then(() => toast.success('Email copied'))}
              className="text-xs inline-flex items-center gap-1 text-heading border border-border rounded-input px-2 py-1 hover:bg-surface-hover"
            >
              <Copy className="w-3 h-3" /> Copy {serviceEmail}
            </button>
          )}
        </div>
      )}

      {topics && (
        <div className="space-y-2">
          <p className="text-sm text-heading">
            <span className="font-mono tabular-nums">{topics.added}</span> {topics.added === 1 ? 'row' : 'rows'} from row{' '}
            <span className="font-mono">{topics.fromRow}</span> would be added
            {topics.skipped.length ? `, ${topics.skipped.length} skipped` : ''}.
          </p>
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar border border-border rounded-input divide-y divide-border">
            {topics.rows.map((r) => (
              <div key={r.row} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-mono tabular-nums text-muted w-10">{r.row}</span>
                <span className="text-heading">{r.title}</span>
              </div>
            ))}
            {topics.skipped.map((r) => (
              <div key={`s${r.row}`} className="flex items-center gap-3 px-3 py-2 text-sm bg-danger/5">
                <span className="font-mono tabular-nums text-muted w-10">{r.row}</span>
                <span className="text-body truncate">{r.title}</span>
                <span className="text-xs text-red-400 shrink-0">{r.reason}</span>
              </div>
            ))}
            {topics.rows.length === 0 && topics.skipped.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted">No new rows.</div>}
          </div>
        </div>
      )}

      {links && (
        <div className="rounded-input border border-border bg-background p-3">
          <div className="text-sm text-heading mb-2">
            <span className="font-mono tabular-nums">{nf.format(links.items)}</span> links found, for example:
          </div>
          <ul className="space-y-1">
            {links.sample.slice(0, 5).map((i) => (
              <li key={i.url} className="text-xs text-body truncate">
                {i.title ? <span className="text-heading">{i.title} </span> : null}
                <span className="text-muted">{i.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SourceModal>
  )
}
