'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, X, Info } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import type { TemplateOption } from '@/components/workspace/TemplatePicker'
import { Field, LinesInput, inputCls } from './fields'

// DR-010 "Client facts": the lists template hooks read (tribe keywords, CTA styles, host cities, product
// page settings). Only the facts this client's templates use are shown.

interface Facts {
  utTribes: { id: string; keywords: string[] }[]
  utGeneralFallback: string[]
  utCtaStyles: string[]
  fifaCities: { name: string; aliases: string[] }[]
  productPageClasses: string[]
  productPageHosts: string[]
}

const USES: Record<keyof Facts, string[]> = {
  utTribes: ['ut-tribe-links', 'fifa-links', 'fifa-city-directory'],
  utGeneralFallback: ['ut-tribe-links'],
  utCtaStyles: ['ut-cta-style'],
  fifaCities: ['fifa-city-directory'],
  productPageClasses: ['product-page'],
  productPageHosts: ['product-page'],
}

function PairRows<T>({
  rows,
  onChange,
  left,
  right,
  blank,
}: {
  rows: T[]
  onChange: (rows: T[]) => void
  left: { label: string; get: (r: T) => string; set: (r: T, v: string) => T }
  right: { label: string; get: (r: T) => string; set: (r: T, v: string) => T }
  blank: T
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[180px_1fr_28px] gap-2 text-[11px] text-muted uppercase tracking-wider">
        <span>{left.label}</span>
        <span>{right.label}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[180px_1fr_28px] gap-2">
          <input value={left.get(r)} onChange={(e) => onChange(rows.map((x, j) => (j === i ? left.set(x, e.target.value) : x)))} className={inputCls} />
          <input value={right.get(r)} onChange={(e) => onChange(rows.map((x, j) => (j === i ? right.set(x, e.target.value) : x)))} className={inputCls} />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove row" className="text-muted hover:text-danger">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, blank])} className="text-xs text-muted hover:text-accent inline-flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add row
      </button>
    </div>
  )
}

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

export function FactsEditor({ clientId, templates }: { clientId: string; templates: TemplateOption[] }) {
  const { toast } = useToast()
  const [facts, setFacts] = useState<Facts | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const hooks = new Set(templates.flatMap((t) => t.hooks ?? []))
  const used = (k: keyof Facts) => USES[k].some((h) => hooks.has(h))

  useEffect(() => {
    apiFetch<{ facts: Facts }>(`/api/clients/${clientId}/facts`, { errorTitle: 'Couldn’t load client facts' })
      .then((d) => setFacts(d.facts))
      .catch(() => {})
  }, [clientId])

  function patch(p: Partial<Facts>) {
    setFacts((f) => (f ? { ...f, ...p } : f))
    setDirty(true)
  }

  async function save() {
    if (!facts) return
    setSaving(true)
    const out: Partial<Facts> = {}
    for (const k of Object.keys(USES) as (keyof Facts)[]) if (used(k)) (out as Record<string, unknown>)[k] = facts[k]
    out.utTribes = out.utTribes?.filter((t) => t.id.trim() && t.keywords.length)
    out.fifaCities = out.fifaCities?.filter((c) => c.name.trim() && c.aliases.length)
    try {
      const d = await apiFetch<{ facts: Facts }>(`/api/clients/${clientId}/facts`, { method: 'PUT', body: { facts: out }, errorTitle: 'Couldn’t save client facts' })
      setFacts(d.facts)
      setDirty(false)
      toast.success('Client facts saved')
    } catch {
      // toasted
    } finally {
      setSaving(false)
    }
  }

  if (!facts) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    )
  }
  const anyUsed = (Object.keys(USES) as (keyof Facts)[]).some(used)
  if (!anyUsed) {
    return (
      <div className="glass-card p-6 flex items-start gap-3 text-sm text-muted">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        This client’s templates don’t use any client facts. Facts appear here when a template uses a hook such as tribe detection, CTA rotation or reading a product page.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {used('utTribes') && (
        <div className="glass-card p-6 space-y-3">
          <div>
            <h3 className="text-base font-display text-heading">Tribes and their keywords</h3>
            <p className="text-xs text-muted">Checked in order; the first tribe whose keyword appears as a whole word wins (keep American last).</p>
          </div>
          <PairRows
            rows={facts.utTribes}
            onChange={(utTribes) => patch({ utTribes })}
            left={{ label: 'Tribe', get: (r) => r.id, set: (r, v) => ({ ...r, id: v }) }}
            right={{ label: 'Keywords (comma-separated)', get: (r) => r.keywords.join(', '), set: (r, v) => ({ ...r, keywords: splitList(v) }) }}
            blank={{ id: '', keywords: [] }}
          />
          {used('utGeneralFallback') && (
            <Field label="Tribes that fall back to general articles" hint="Tribes with no dedicated articles yet (comma-separated).">
              <input value={facts.utGeneralFallback.join(', ')} onChange={(e) => patch({ utGeneralFallback: splitList(e.target.value) })} className={inputCls} />
            </Field>
          )}
        </div>
      )}
      {used('utCtaStyles') && (
        <div className="glass-card p-6 space-y-3">
          <div>
            <h3 className="text-base font-display text-heading">CTA styles</h3>
            <p className="text-xs text-muted">Assigned in rotation, one per article in queue order. One style per line.</p>
          </div>
          <LinesInput value={facts.utCtaStyles} onChange={(v) => patch({ utCtaStyles: v ?? [] })} rows={6} />
        </div>
      )}
      {used('fifaCities') && (
        <div className="glass-card p-6 space-y-3">
          <div>
            <h3 className="text-base font-display text-heading">Host cities</h3>
            <p className="text-xs text-muted">Detected as whole words in the title and brief; the first match wins.</p>
          </div>
          <PairRows
            rows={facts.fifaCities}
            onChange={(fifaCities) => patch({ fifaCities })}
            left={{ label: 'City', get: (r) => r.name, set: (r, v) => ({ ...r, name: v }) }}
            right={{ label: 'Aliases (comma-separated)', get: (r) => r.aliases.join(', '), set: (r, v) => ({ ...r, aliases: splitList(v) }) }}
            blank={{ name: '', aliases: [] }}
          />
        </div>
      )}
      {used('productPageHosts') && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-base font-display text-heading">Product pages</h3>
          <Field label="Sites Poe may read product pages from" hint="One host per line, e.g. thewatchstore.ph. Empty = the client’s website.">
            <LinesInput value={facts.productPageHosts} onChange={(v) => patch({ productPageHosts: v ?? [] })} rows={2} />
          </Field>
          <Field label="Description block classes" hint="The CSS classes of the product description element (comma-separated).">
            <input value={facts.productPageClasses.join(', ')} onChange={(e) => patch({ productPageClasses: splitList(e.target.value) })} className={inputCls} />
          </Field>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="bg-accent hover:bg-accent/90 text-white px-5 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save client facts
        </button>
      </div>
    </div>
  )
}
