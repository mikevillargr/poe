'use client'

import { SheetFormatCard } from '@/components/import/SheetFormatCard'
import { linkListFormat } from '@/lib/import/sheet-format'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileSpreadsheet, Upload, List, Loader2, ExternalLink, Search } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { SourceModal, fieldCls, ghostBtn, labelCls, primaryBtn } from './SourceModal'

export interface Inventory {
  slug: string
  name: string
  kind: 'articles' | 'products' | 'pages' | 'videos' | 'directory'
  source: 'upload' | 'sheet'
  lastSyncedAt: string | null
  items: number
}

interface Item {
  url: string
  title: string | null
  attrs: Record<string, string> | null
}

const nf = new Intl.NumberFormat('en-US')

/** DR-011: upload a CSV/XLSX that replaces a link list (dry run first, then an explicit replace). */
export function UploadLinksModal({
  clientId,
  clientSlug,
  inventory,
  onClose,
  onDone,
}: {
  clientId: string
  clientSlug: string
  inventory: Inventory | null
  onClose: () => void
  onDone: () => void
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [urlPrefix, setUrlPrefix] = useState('')
  const [preview, setPreview] = useState<{ items: number; sample: Item[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setFile(null)
    setPreview(null)
    setError(null)
    setUrlPrefix('')
  }, [inventory?.slug])

  async function send(f: File, dryRun: boolean) {
    if (!inventory) return
    const form = new FormData()
    form.append('file', f)
    if (urlPrefix.trim()) form.append('urlPrefix', urlPrefix.trim())
    if (dryRun) form.append('dryRun', 'true')
    return apiFetch<{ items: number; sample?: Item[] }>(`/api/clients/${clientId}/inventories/${inventory.slug}/upload`, {
      method: 'POST',
      body: form,
      silent: true,
    })
  }

  async function check(f: File) {
    setFile(f)
    setBusy(true)
    setError(null)
    setPreview(null)
    try {
      const r = await send(f, true)
      setPreview({ items: r!.items, sample: r!.sample ?? [] })
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  async function replace() {
    if (!file || !inventory) return
    setBusy(true)
    try {
      const r = await send(file, false)
      toast.success(`${inventory.name} updated`, `${nf.format(r!.items)} links from ${file.name}`)
      onDone()
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SourceModal
      open={!!inventory}
      title={`Upload ${inventory?.name ?? ''}`}
      icon={Upload}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={replace} disabled={!preview || busy} className={primaryBtn}>
            {busy && file && preview && <Loader2 className="w-4 h-4 animate-spin" />}
            {preview ? `Replace ${nf.format(inventory?.items ?? 0)} links with ${nf.format(preview.items)}` : 'Replace list'}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">
        A file with a column of URLs (and optionally titles). It replaces the whole list; templates pick internal links from it.
      </p>
      <SheetFormatCard format={linkListFormat()} clientId={clientId} clientSlug={clientSlug} />
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && check(e.target.files[0])}
      />
      <div>
        <label htmlFor="up-prefix" className={labelCls}>
          URL prefix <span className="text-muted font-normal">(only if the file has slugs instead of full URLs)</span>
        </label>
        <input
          id="up-prefix"
          value={urlPrefix}
          onChange={(e) => setUrlPrefix(e.target.value)}
          placeholder="https://thewatchstore.ph/products/"
          className={fieldCls}
        />
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-card border border-dashed border-border hover:border-accent/60 hover:bg-surface-hover transition-colors p-8 flex flex-col items-center gap-2 text-center"
      >
        {busy && !preview ? <Loader2 className="w-6 h-6 text-accent animate-spin" /> : <FileSpreadsheet className="w-6 h-6 text-accent" />}
        <span className="text-sm text-heading font-medium">{file ? file.name : 'Choose a .csv, .xlsx or .xls file'}</span>
        <span className="text-xs text-muted">up to 5 MB · first sheet only</span>
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {preview && (
        <div className="rounded-input border border-border bg-background p-3">
          <div className="text-sm text-heading mb-2">
            <span className="font-mono tabular-nums">{nf.format(preview.items)}</span> links found, for example:
          </div>
          <ul className="space-y-1">
            {preview.sample.slice(0, 5).map((i) => (
              <li key={i.url} className="text-xs text-body truncate">
                {i.title ? <span className="text-heading">{i.title}</span> : null} <span className="text-muted">{i.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SourceModal>
  )
}

/** DR-011: the links in one list, searchable. */
export function ViewLinksModal({ clientId, inventory, onClose }: { clientId: string; inventory: Inventory | null; onClose: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  useEffect(() => {
    if (!inventory) return
    setItems(null)
    setQ('')
    apiFetch<{ items: Item[]; total: number }>(`/api/clients/${clientId}/inventories/${inventory.slug}`, { errorTitle: 'Couldn’t load the links' })
      .then((d) => {
        setItems(d.items)
        setTotal(d.total)
      })
      .catch(() => setItems([]))
  }, [clientId, inventory])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (items ?? []).filter((i) => !s || i.url.toLowerCase().includes(s) || (i.title ?? '').toLowerCase().includes(s))
  }, [items, q])

  return (
    <SourceModal open={!!inventory} title={inventory?.name ?? ''} icon={List} onClose={onClose} wide>
      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search links" className={`${fieldCls} pl-9`} />
      </div>
      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">This list is empty. Upload a file or sync a sheet to fill it.</p>
      ) : (
        <>
          <p className="text-xs text-muted font-mono tabular-nums">
            {nf.format(shown.length)} of {nf.format(total)}
            {total > items.length ? ` (first ${nf.format(items.length)} shown)` : ''}
          </p>
          <ul className="divide-y divide-border border border-border rounded-input">
            {shown.map((i) => (
              <li key={i.url} className="px-3 py-2 text-sm flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {i.title && <div className="text-heading truncate">{i.title}</div>}
                  <a href={i.url} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-accent break-all inline-flex items-start gap-1">
                    {i.url} <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                  </a>
                </div>
                {i.attrs && (
                  <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                    {Object.entries(i.attrs).map(([k, v]) => (
                      <span key={k} className="px-1.5 py-0.5 rounded text-[11px] border border-border text-muted">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </SourceModal>
  )
}
