'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'

// DR-012: pick or change an article's content template (no import needed), and edit the template's
// own row inputs (e.g. Item URL for a product FAQ, Page URL for a tribe page). Saved straight away.

export interface TemplateOption {
  id: string
  slug: string
  name: string
  kind: 'faq' | 'blog' | 'page'
  enabled: boolean
  revisionNo: number
  inputs: { key: string; label: string; required?: boolean; aliases?: string[] }[]
  researchEnabled?: boolean
  hooks?: string[]
  updatedAt?: string | null
  updatedBy?: string | null
  articles?: number
}

const ARTICLE_FIELDS = new Set(['title', 'brief', 'keywords', 'wordcount'])
const KIND_LABEL: Record<TemplateOption['kind'], string> = { faq: 'FAQ', blog: 'Blog', page: 'Page' }

const inputCls =
  'w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all disabled:opacity-60'
const labelCls = 'block text-[10px] font-medium text-muted uppercase tracking-wider mb-2'

/** Fetches the client's templates once per client. */
export function useClientTemplates(clientId: string) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null)
  useEffect(() => {
    let live = true
    if (!clientId) {
      setTemplates([])
      return
    }
    apiFetch<{ templates: TemplateOption[] }>(`/api/clients/${clientId}/templates`, { errorTitle: 'Couldn’t load templates' })
      .then((d) => live && setTemplates(d.templates))
      .catch(() => live && setTemplates([]))
    return () => {
      live = false
    }
  }, [clientId])
  return templates
}

export function TemplatePicker({
  clientId,
  articleId,
  templateId,
  inputs,
  disabled,
  onSaved,
}: {
  clientId: string
  articleId: string
  templateId: string | null
  inputs: Record<string, string | number | null>
  disabled?: boolean
  onSaved: (next: { templateId: string | null; templateInputs: Record<string, string | number | null> }) => void
}) {
  const templates = useClientTemplates(clientId)
  const [values, setValues] = useState<Record<string, string>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const current = templates?.find((t) => t.id === templateId) ?? null
  const rowFields = current?.inputs.filter((f) => !ARTICLE_FIELDS.has(f.key)) ?? []

  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, templateId])

  async function save(nextTemplateId: string | null, nextInputs: Record<string, string | number | null>) {
    const { article } = await apiFetch<{ article: { templateId: string | null; templateInputs: Record<string, string | number | null> | null } }>(
      `/api/clients/${clientId}/articles/${articleId}/template`,
      { method: 'PUT', body: { templateId: nextTemplateId, inputs: nextInputs }, errorTitle: 'Couldn’t change the template' },
    )
    onSaved({ templateId: article.templateId, templateInputs: article.templateInputs ?? {} })
  }

  function choose(id: string) {
    const next = id || null
    // Keep the CTA index and any matching inputs when switching between templates.
    save(next, next ? { ...inputs } : {}).catch(() => {})
  }

  function editInput(key: string, value: string) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const merged: Record<string, string | number | null> = { ...inputs }
      for (const f of rowFields) merged[f.key] = next[f.key]?.trim() ? next[f.key].trim() : null
      save(templateId, merged).catch(() => {})
    }, 700)
  }

  const enabled = templates?.filter((t) => t.enabled || t.id === templateId) ?? []

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ws-template" className={labelCls}>
          <span className="inline-flex items-center gap-1.5">
            <LayoutTemplate className="w-3 h-3" /> Template
          </span>
        </label>
        <select
          id="ws-template"
          value={templateId ?? ''}
          disabled={disabled || templates === null}
          onChange={(e) => choose(e.target.value)}
          className={inputCls}
        >
          <option value="">Standard article (no template)</option>
          {enabled.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {KIND_LABEL[t.kind]}
              {t.enabled ? '' : ' (disabled)'}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">
          {current
            ? `Generate uses this template’s prompt, link steps and checks (revision ${current.revisionNo}).`
            : 'Research, then a draft written from the brief and the client’s guidelines.'}
        </p>
      </div>

      {rowFields.map((f) => (
        <div key={f.key}>
          <label htmlFor={`ws-input-${f.key}`} className={labelCls}>
            {f.label}
            {f.required ? <span className="text-accent"> *</span> : null}
          </label>
          <input
            id={`ws-input-${f.key}`}
            value={values[f.key] ?? ''}
            disabled={disabled}
            onChange={(e) => editInput(f.key, e.target.value)}
            placeholder={/url/i.test(f.key) ? 'https://…' : undefined}
            className={inputCls}
          />
          {f.required && !values[f.key]?.trim() && <p className="text-xs text-orange-400 mt-1">Needed before generating.</p>}
        </div>
      ))}
    </div>
  )
}
