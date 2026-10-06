'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { Plus, LayoutTemplate, Copy, Trash2, FilePlus2, Files, Building2, Loader2, Pencil } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import type { TemplateOption } from '@/components/workspace/TemplatePicker'
import { SourceModal, fieldCls, ghostBtn, labelCls, primaryBtn } from '@/components/sources/SourceModal'
import { FactsEditor } from './FactsEditor'

// DR-010 option A: a client's templates (create from the Standard preset, duplicate, copy from another
// client; open the editor; delete) and the client facts their hooks read.

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}
const KIND: Record<TemplateOption['kind'], string> = { faq: 'FAQ', blog: 'Blog', page: 'Page' }

type Start = 'standard' | 'duplicate' | 'copy'

function NewTemplateModal({
  client,
  open,
  templates,
  initialSource,
  onClose,
}: {
  client: { id: string; slug: string }
  open: boolean
  templates: TemplateOption[]
  initialSource?: TemplateOption | null
  onClose: () => void
}) {
  const router = useRouter()
  const [start, setStart] = useState<Start>('standard')
  const [name, setName] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [otherClient, setOtherClient] = useState('')
  const [otherTemplates, setOtherTemplates] = useState<TemplateOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setStart(initialSource ? 'duplicate' : 'standard')
    setSourceId(initialSource?.id ?? '')
    setName(initialSource ? `${initialSource.name} (copy)` : '')
    setOtherClient('')
    setOtherTemplates([])
  }, [open, initialSource])

  useEffect(() => {
    if (!open || start !== 'copy' || clients.length) return
    apiFetch<{ clients: { id: string; name: string }[] }>('/api/clients', { errorTitle: 'Couldn’t load clients' })
      .then((d) => setClients(d.clients.filter((c) => c.id !== client.id)))
      .catch(() => {})
  }, [open, start, clients.length, client.id])

  useEffect(() => {
    if (!otherClient) return setOtherTemplates([])
    apiFetch<{ templates: TemplateOption[] }>(`/api/clients/${otherClient}/templates`, { errorTitle: 'Couldn’t load templates' })
      .then((d) => setOtherTemplates(d.templates))
      .catch(() => setOtherTemplates([]))
  }, [otherClient])

  async function create() {
    setBusy(true)
    setError(null)
    const from =
      start === 'standard'
        ? { kind: 'standard' }
        : start === 'duplicate'
          ? { kind: 'template', templateId: sourceId }
          : { kind: 'template', templateId: sourceId, clientId: otherClient }
    try {
      const { id } = await apiFetch<{ id: string }>(`/api/clients/${client.id}/templates`, { method: 'POST', silent: true, body: { name: name.trim(), from } })
      router.push(`/c/${client.slug}/templates/${id}`)
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : 'Couldn’t create the template.')
      setBusy(false)
    }
  }

  const options: { key: Start; title: string; hint: string; Icon: typeof FilePlus2; disabled?: boolean }[] = [
    { key: 'standard', title: 'Standard article', hint: 'Poe’s SEO article with the client’s guidelines', Icon: FilePlus2 },
    { key: 'duplicate', title: 'Duplicate', hint: 'Start from one of this client’s templates', Icon: Files, disabled: !templates.length },
    { key: 'copy', title: 'Copy from another client', hint: 'Bring a template over and adapt it', Icon: Building2 },
  ]
  const valid = name.trim() && (start === 'standard' || (sourceId && (start === 'duplicate' || otherClient)))

  return (
    <SourceModal
      open={open}
      title="New template"
      icon={LayoutTemplate}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancel
          </button>
          <button type="button" onClick={create} disabled={!valid || busy} className={primaryBtn}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Create and edit
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={o.disabled}
            onClick={() => {
              setStart(o.key)
              setSourceId('')
            }}
            className={`text-left rounded-card border p-4 transition-colors disabled:opacity-40 ${
              start === o.key ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface-hover'
            }`}
          >
            <o.Icon className={`w-5 h-5 mb-2 ${start === o.key ? 'text-accent' : 'text-muted'}`} />
            <div className="text-sm font-medium text-heading">{o.title}</div>
            <div className="text-xs text-muted mt-0.5">{o.hint}</div>
          </button>
        ))}
      </div>
      {start === 'duplicate' && (
        <div>
          <label htmlFor="nt-source" className={labelCls}>
            Template
          </label>
          <select
            id="nt-source"
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value)
              const t = templates.find((x) => x.id === e.target.value)
              if (t && !name.trim()) setName(`${t.name} (copy)`)
            }}
            className={fieldCls}
          >
            <option value="">Choose a template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {start === 'copy' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nt-client" className={labelCls}>
              Client
            </label>
            <select id="nt-client" value={otherClient} onChange={(e) => setOtherClient(e.target.value)} className={fieldCls}>
              <option value="">Choose a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="nt-other" className={labelCls}>
              Template
            </label>
            <select
              id="nt-other"
              value={sourceId}
              disabled={!otherClient}
              onChange={(e) => {
                setSourceId(e.target.value)
                const t = otherTemplates.find((x) => x.id === e.target.value)
                if (t && !name.trim()) setName(t.name)
              }}
              className={fieldCls}
            >
              <option value="">{otherClient ? 'Choose a template' : 'Choose a client first'}</option>
              {otherTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="nt-name" className={labelCls}>
          Name
        </label>
        <input id="nt-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Product FAQ" className={fieldCls} />
      </div>
      {start !== 'standard' && <p className="text-xs text-muted">The copy is independent: editing it never changes the original.</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </SourceModal>
  )
}

export function TemplatesView({ client }: { client: { id: string; name: string; slug: string } }) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'templates' | 'facts'>('templates')
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [duplicateOf, setDuplicateOf] = useState<TemplateOption | null>(null)
  const [deleting, setDeleting] = useState<TemplateOption | null>(null)

  const load = useCallback(() => {
    apiFetch<{ templates: TemplateOption[] }>(`/api/clients/${client.id}/templates`, { errorTitle: 'Couldn’t load templates' })
      .then((d) => setTemplates(d.templates))
      .catch(() => setTemplates([]))
  }, [client.id])
  useEffect(() => load(), [load])

  async function remove() {
    const t = deleting
    setDeleting(null)
    if (!t) return
    try {
      await apiFetch(`/api/clients/${client.id}/templates/${t.id}`, { method: 'DELETE', errorTitle: 'Couldn’t delete the template' })
      toast.success('Template deleted', t.name)
      load()
    } catch {
      // toasted (409 explains to disable instead)
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-8 xl:p-10 max-w-[1200px] mx-auto">
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display text-heading">Templates</h1>
          <p className="text-sm text-muted mt-1">Presets for {client.name}’s content: prompt, internal-link steps, checks. Every save is kept in its history.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDuplicateOf(null)
            setCreating(true)
          }}
          className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all hover:shadow-glow-accent-strong shrink-0"
        >
          <Plus className="w-4 h-4" /> New template
        </button>
      </motion.div>

      <motion.div variants={itemVariants} role="tablist" className="border-b border-border mb-6 flex gap-1">
        {(['templates', 'facts'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'text-heading' : 'text-muted hover:text-heading'}`}
          >
            {t === 'templates' ? 'Templates' : 'Client facts'}
            {tab === t && <motion.div layoutId="tpl-tab" className="absolute left-2 right-2 -bottom-px h-0.5 bg-accent rounded-full" />}
          </button>
        ))}
      </motion.div>

      {tab === 'facts' ? (
        <FactsEditor clientId={client.id} templates={templates ?? []} />
      ) : templates === null ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : templates.length === 0 ? (
        <div className="glass-card p-10 text-center space-y-3">
          <LayoutTemplate className="w-8 h-8 text-accent mx-auto" />
          <h3 className="text-heading font-medium">No templates yet</h3>
          <p className="text-sm text-muted">Start from the Standard article preset, or copy a template from another client.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <motion.div key={t.id} variants={itemVariants} className={`glass-card p-5 flex flex-col gap-3 ${t.enabled ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/c/${client.slug}/templates/${t.id}`} className="text-lg font-display text-heading hover:text-accent transition-colors">
                    {t.name}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[11px] border border-border text-muted">{KIND[t.kind]}</span>
                    {!t.enabled && <span className="px-1.5 py-0.5 rounded text-[11px] border border-warning/40 text-orange-400 bg-warning/10">Disabled</span>}
                    {t.researchEnabled && <span className="px-1.5 py-0.5 rounded text-[11px] border border-border text-muted">Research on</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/c/${client.slug}/templates/${t.id}`} className="p-1.5 rounded text-muted hover:text-accent hover:bg-surface" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={() => {
                      setDuplicateOf(t)
                      setCreating(true)
                    }}
                    className="p-1.5 rounded text-muted hover:text-accent hover:bg-surface"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button type="button" title="Delete" onClick={() => setDeleting(t)} className="p-1.5 rounded text-muted hover:text-danger hover:bg-surface">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  Revision <span className="font-mono">{t.revisionNo}</span>
                  {t.updatedAt ? ` · edited ${formatDistanceToNowStrict(new Date(t.updatedAt), { addSuffix: true })}` : ''}
                  {t.updatedBy ? ` by ${t.updatedBy}` : ''}
                </span>
                <span>
                  <span className="font-mono tabular-nums">{t.articles ?? 0}</span> {t.articles === 1 ? 'article' : 'articles'}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <NewTemplateModal client={client} open={creating} templates={templates ?? []} initialSource={duplicateOf} onClose={() => setCreating(false)} />
      <ConfirmModal
        isOpen={!!deleting}
        title="Delete template"
        message={
          deleting?.articles
            ? `“${deleting.name}” is used by ${deleting.articles} articles, so it can’t be deleted. Disable it in the editor instead.`
            : `“${deleting?.name ?? ''}” will be removed. Its history is kept.`
        }
        confirmLabel="Delete template"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </motion.div>
  )
}
