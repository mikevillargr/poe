'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, Loader2, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { diffLines, changedSettings } from '@/lib/templates/diff'
import type { TemplateConfig } from '@/lib/templates/types'
import { SourceModal, ghostBtn, primaryBtn } from '@/components/sources/SourceModal'

// DR-010 History (Linear-style): revisions with who/when/note; selecting one shows what changed between it
// and the current revision (prompt lines highlighted, settings listed). Restore saves it as a new revision.

export interface RevisionRow {
  revisionNo: number
  note: string | null
  editedAt: string
  editedBy: string
}

interface Snapshot {
  name: string
  enabled: boolean
  config: TemplateConfig
}

function PromptDiff({ title, before, after }: { title: string; before: string; after: string }) {
  const lines = useMemo(() => diffLines(before, after), [before, after])
  if (before === after) return null
  // Show changed lines with two lines of context.
  const keep = new Set<number>()
  lines.forEach((l, i) => {
    if (l.type !== 'same') for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 2); k++) keep.add(k)
  })
  return (
    <div>
      <div className="text-xs font-medium text-heading mb-1">{title}</div>
      <pre className="text-[11px] font-mono leading-relaxed border border-border rounded-input bg-background max-h-[360px] overflow-auto custom-scrollbar">
        {lines.map((l, i) =>
          keep.has(i) ? (
            <div
              key={i}
              className={`px-3 whitespace-pre-wrap break-words ${
                l.type === 'add' ? 'bg-success/15 text-green-500' : l.type === 'remove' ? 'bg-danger/15 text-red-400 line-through' : 'text-muted'
              }`}
            >
              {l.type === 'add' ? '+ ' : l.type === 'remove' ? '− ' : '  '}
              {l.text || ' '}
            </div>
          ) : i > 0 && keep.has(i - 1) ? (
            <div key={i} className="px-3 text-muted/60">
              …
            </div>
          ) : null,
        )}
      </pre>
    </div>
  )
}

export function HistoryModal({
  clientId,
  templateId,
  open,
  revisions,
  current,
  onClose,
  onRestored,
}: {
  clientId: string
  templateId: string
  open: boolean
  revisions: RevisionRow[]
  current: Snapshot
  onClose: () => void
  onRestored: () => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const latest = revisions[0]?.revisionNo

  useEffect(() => {
    if (!open) return
    setSelected(revisions[1]?.revisionNo ?? revisions[0]?.revisionNo ?? null)
  }, [open, revisions])

  useEffect(() => {
    if (!open || selected === null) return
    setLoading(true)
    apiFetch<{ snapshot: Snapshot }>(`/api/clients/${clientId}/templates/${templateId}/revisions/${selected}`, { errorTitle: 'Couldn’t load that revision' })
      .then((d) => setSnap(d.snapshot))
      .catch(() => setSnap(null))
      .finally(() => setLoading(false))
  }, [open, selected, clientId, templateId])

  async function restore() {
    if (selected === null) return
    setRestoring(true)
    try {
      await apiFetch(`/api/clients/${clientId}/templates/${templateId}/restore`, { method: 'POST', body: { revisionNo: selected }, errorTitle: 'Restore failed' })
      onRestored()
    } catch {
      // toasted
    } finally {
      setRestoring(false)
    }
  }

  const settings = snap ? changedSettings({ ...snap.config, name: snap.name, enabled: snap.enabled }, { ...current.config, name: current.name, enabled: current.enabled }) : []

  return (
    <SourceModal
      open={open}
      title="History"
      icon={History}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Close
          </button>
          <button type="button" onClick={restore} disabled={selected === null || selected === latest || restoring} className={primaryBtn}>
            {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Restore revision {selected ?? ''}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-[220px_1fr] gap-4 min-h-[360px]">
        <ul className="space-y-1 border-r border-border pr-3 max-h-[480px] overflow-y-auto custom-scrollbar">
          {revisions.map((r) => (
            <li key={r.revisionNo}>
              <button
                type="button"
                onClick={() => setSelected(r.revisionNo)}
                className={`w-full text-left rounded-input px-3 py-2 transition-colors ${selected === r.revisionNo ? 'bg-accent/10 border border-accent/30' : 'hover:bg-surface-hover border border-transparent'}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-heading">Revision {r.revisionNo}</span>
                  {r.revisionNo === latest && <span className="text-[10px] px-1.5 rounded bg-accent/15 text-accent">Current</span>}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {new Date(r.editedAt).toLocaleString()} · {r.editedBy}
                </div>
                {r.note && <div className="text-[11px] text-body mt-0.5 line-clamp-2">{r.note}</div>}
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-4 min-w-0">
          {selected === latest ? (
            <p className="text-sm text-muted">This is the current revision. Pick an earlier one to see what changed since.</p>
          ) : loading || !snap ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <p className="text-xs text-muted">Changes from revision {selected} to the current one ({latest}):</p>
              <PromptDiff title="Writer prompt" before={snap.config.writerPrompt} after={current.config.writerPrompt} />
              {current.config.selectors.map((s, i) => (
                <PromptDiff key={i} title={`Link step “${s.id}” prompt`} before={snap.config.selectors[i]?.prompt ?? ''} after={s.prompt} />
              ))}
              {settings.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-heading mb-1">Settings</div>
                  <ul className="text-[11px] font-mono text-body space-y-0.5">
                    {settings.slice(0, 40).map((l) => (
                      <li key={l} className="break-all">
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {snap.config.writerPrompt === current.config.writerPrompt && !settings.length && (
                <p className="text-sm text-muted">No differences.</p>
              )}
            </>
          )}
        </div>
      </div>
    </SourceModal>
  )
}
