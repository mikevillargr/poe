'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, History, Loader2, Save } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { unresolvedPlaceholders } from '@/lib/templates/schema'
import type { TemplateConfig } from '@/lib/templates/types'
import { SourceModal, fieldCls, ghostBtn, labelCls, primaryBtn } from '@/components/sources/SourceModal'
import { BasicsSection, ChecksSection, HooksSection, InputsSection, LinkStepsSection, OutputSection, PromptSection, ValuesSection } from './EditorSections'
import { DryRunPanel, PlaceholdersPanel } from './EditorRail'
import { HistoryModal, type RevisionRow } from './HistoryModal'
import { Toggle } from './fields'

// DR-010 option A template editor: the config as collapsible sections on the left, placeholder sources and
// dry runs in a sticky rail on the right. Save asks for an optional change note and writes a revision.

interface Detail {
  template: { id: string; slug: string; name: string; kind: TemplateConfig['kind']; enabled: boolean; revisionNo: number; config: TemplateConfig }
  revisions: RevisionRow[]
  articles: number
}

export function TemplateEditor({ client, templateId }: { client: { id: string; name: string; slug: string }; templateId: string }) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [config, setConfig] = useState<TemplateConfig | null>(null)
  const [inventories, setInventories] = useState<{ slug: string; name: string }[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await apiFetch<Detail>(`/api/clients/${client.id}/templates/${templateId}`, { errorTitle: 'Couldn’t load the template' })
    setDetail(d)
    setName(d.template.name)
    setEnabled(d.template.enabled)
    setConfig(d.template.config)
  }, [client.id, templateId])

  useEffect(() => {
    load().catch(() => {})
    apiFetch<{ inventories: { slug: string; name: string }[] }>(`/api/clients/${client.id}/inventories`, { silent: true })
      .then((d) => setInventories(d.inventories))
      .catch(() => {})
  }, [load, client.id])

  const dirty = !!detail && !!config && (name !== detail.template.name || enabled !== detail.template.enabled || JSON.stringify(config) !== JSON.stringify(detail.template.config))
  const unresolved = useMemo(() => new Set(config ? unresolvedPlaceholders(config) : []), [config])

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const patch = (p: Partial<TemplateConfig>) => setConfig((c) => (c ? { ...c, ...p } : c))

  async function save() {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      const { revisionNo } = await apiFetch<{ revisionNo: number }>(`/api/clients/${client.id}/templates/${templateId}`, {
        method: 'PUT',
        silent: true,
        body: { name: name.trim(), enabled, config, note: note.trim() || null },
      })
      toast.success('Template saved', `Revision ${revisionNo}`)
      setSaveOpen(false)
      setNote('')
      await load()
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : 'Couldn’t save the template.')
    } finally {
      setSaving(false)
    }
  }

  if (!detail || !config) {
    return (
      <div className="p-10 flex items-center gap-2 text-sm text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading template…
      </div>
    )
  }

  return (
    <div className="p-8 xl:p-10 max-w-[1440px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <Link href={`/c/${client.slug}/templates`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Templates
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Template name"
            maxLength={80}
            className="block w-full max-w-xl text-3xl font-display text-heading bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted">
            <span>
              Revision <span className="font-mono">{detail.template.revisionNo}</span>
            </span>
            <span>
              <span className="font-mono tabular-nums">{detail.articles}</span> {detail.articles === 1 ? 'article uses' : 'articles use'} it
            </span>
            <Toggle checked={enabled} onChange={setEnabled} label={enabled ? 'Enabled' : 'Disabled (hidden from pickers)'} />
            {dirty && <span className="text-orange-400">Unsaved changes</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 border border-border text-body hover:text-heading hover:bg-surface-hover transition-colors"
          >
            <History className="w-4 h-4" /> History
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            disabled={!dirty || unresolved.size > 0 || !name.trim()}
            title={unresolved.size ? 'Some placeholders have no source' : undefined}
            className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all hover:shadow-glow-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <BasicsSection config={config} patch={patch} />
          <PromptSection config={config} patch={patch} unresolved={unresolved} />
          <LinkStepsSection config={config} patch={patch} unresolved={unresolved} />
          <ValuesSection config={config} patch={patch} inventories={inventories} unresolved={unresolved} />
          <HooksSection config={config} patch={patch} inventories={inventories} />
          <ChecksSection config={config} patch={patch} />
          <OutputSection config={config} patch={patch} />
          <InputsSection config={config} patch={patch} />
        </div>
        <aside className="space-y-4 xl:sticky xl:top-6">
          <PlaceholdersPanel config={config} inventories={inventories} unresolved={unresolved} />
          <DryRunPanel clientId={client.id} templateId={templateId} config={config} disabled={unresolved.size > 0} />
        </aside>
      </div>

      <SourceModal
        open={saveOpen}
        title="Save template"
        icon={Save}
        onClose={() => setSaveOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setSaveOpen(false)} className={ghostBtn}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save as revision {detail.template.revisionNo + 1}
            </button>
          </>
        }
      >
        <div>
          <label htmlFor="tpl-note" className={labelCls}>
            What changed? <span className="text-muted font-normal">(optional, shown in History)</span>
          </label>
          <input id="tpl-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Tightened the FAQ answer length" className={fieldCls} />
        </div>
        <p className="text-xs text-muted">The next generation of every article using this template uses the new revision. Existing drafts don’t change.</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </SourceModal>

      <HistoryModal
        clientId={client.id}
        templateId={templateId}
        open={historyOpen}
        revisions={detail.revisions}
        current={{ name: detail.template.name, enabled: detail.template.enabled, config: detail.template.config }}
        onClose={() => setHistoryOpen(false)}
        onRestored={() => {
          setHistoryOpen(false)
          toast.success('Revision restored', 'Saved as a new revision.')
          load().catch(() => {})
        }}
      />
    </div>
  )
}
