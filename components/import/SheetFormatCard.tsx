'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Copy, Download, ExternalLink, Table2 } from 'lucide-react'
import { headerTsv, type SheetFormat } from '@/lib/import/sheet-format'
import { useToast } from '@/hooks/useToast'

// DR-015 option A: what the sheet must look like, next to every upload / sheet link. The columns, sample and
// header row all come from the same format the importer reads (lib/import/sheet-format.ts).

const OPEN_KEY = 'poe.sheetFormat.open'

export function SheetFormatCard({
  format,
  clientId,
  clientSlug,
  defaultOpen,
  standalone = false,
}: {
  format: SheetFormat
  clientId: string
  clientSlug: string
  /** Initial state when the person hasn't toggled it before. */
  defaultOpen?: boolean
  /** On the shareable format page: always open, no share link. */
  standalone?: boolean
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(standalone || (defaultOpen ?? true))

  // Remember whether the person keeps it open (collapsed after they've learned the format).
  useEffect(() => {
    if (standalone) return
    const saved = window.localStorage.getItem(OPEN_KEY)
    if (saved !== null) setOpen(saved === '1')
  }, [standalone])

  function toggle() {
    const next = !open
    setOpen(next)
    window.localStorage.setItem(OPEN_KEY, next ? '1' : '0')
  }

  async function copyHeaders() {
    try {
      await navigator.clipboard.writeText(headerTsv(format))
      toast.success('Headers copied', 'Paste into cell A1 of your sheet; each header lands in its own column.')
    } catch {
      toast.error('Couldn’t copy', 'Your browser blocked the clipboard. Download the sample instead.')
    }
  }

  const sampleHref = `/api/clients/${clientId}/sheet-format/sample?format=${encodeURIComponent(format.id)}`
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input text-xs font-medium border border-border text-heading hover:bg-surface-hover transition-colors'

  return (
    <section id={format.id} className="glass-card overflow-hidden scroll-mt-6">
      {standalone ? (
        <div className="px-5 pt-4 flex items-center gap-2">
          <Table2 className="w-4 h-4 text-accent" />
          <h2 className="text-lg font-display text-heading">{format.title}</h2>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-surface-hover transition-colors"
        >
          <Table2 className="w-4 h-4 text-accent shrink-0" />
          <span className="text-sm font-medium text-heading">Sheet format</span>
          <span className="text-xs text-muted truncate">· {format.title}</span>
          <ChevronDown className={`w-4 h-4 text-muted ml-auto shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      )}

      {open && (
        <div className={`px-5 pb-4 space-y-3 ${standalone ? 'pt-2' : 'border-t border-border pt-3'}`}>
          <p className="text-sm text-body">{format.intro}</p>
          <ul className="divide-y divide-border border border-border rounded-input">
            {format.columns.map((c, i) => (
              <li key={`${c.header}-${i}`} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-heading truncate" title={c.header}>
                    {format.headerRow ? c.header : `Cell: ${c.header}`}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      c.required ? 'bg-accent/10 text-accent' : 'bg-surface-hover text-muted'
                    }`}
                  >
                    {c.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {c.meaning}
                  {c.alsoAccepted.length > 0 && <span className="block text-muted/80">Also accepted: {c.alsoAccepted.join(', ')}</span>}
                </p>
              </li>
            ))}
          </ul>
          {format.notes.length > 0 && (
            <ul className="text-xs text-muted list-disc pl-4 space-y-0.5">
              {format.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <a href={sampleHref} className={btn}>
              <Download className="w-3.5 h-3.5" /> Download sample (.xlsx)
            </a>
            {format.headerRow && (
              <button type="button" onClick={copyHeaders} className={btn}>
                <Copy className="w-3.5 h-3.5" /> Copy headers
              </button>
            )}
            {!standalone && (
              <Link
                href={`/c/${clientSlug}/sheet-format#${format.id}`}
                target="_blank"
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
                title="A page with just this format, to send to whoever fills the sheet"
              >
                Share this format <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
