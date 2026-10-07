'use client'

import { useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { listPlaceholders } from '@/lib/templates/placeholders'
import { TEMPLATE_HOOKS } from '@/lib/templates/hooks/registry'
import type { CheckConfig, SelectorStep, TemplateConfig, TemplateInputField, ValueSource } from '@/lib/templates/types'
import { CommaInput, Field, LinesInput, NumberInput, RangeInput, Toggle, inputCls, monoCls } from './fields'

// The template editor's form, one collapsible card per part of the config (DR-010). Every control edits
// the in-memory config; nothing is saved until Save (which writes a revision).

type Patch = (p: Partial<TemplateConfig>) => void

export function Section({ title, hint, children, defaultOpen = true }: { title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="glass-card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-hover transition-colors text-left">
        <div className="min-w-0">
          <h2 className="text-base font-display text-heading">{title}</h2>
          {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted ml-auto shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="border-t border-border p-5 space-y-4">{children}</div>}
    </section>
  )
}

/** Chips for the {{PLACEHOLDERS}} a prompt uses (red when nothing provides them). */
function PlaceholderChips({ text, unresolved }: { text: string; unresolved: Set<string> }) {
  const used = listPlaceholders(text)
  if (!used.length) return <p className="text-[11px] text-muted">No placeholders.</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {used.map((p) => (
        <span
          key={p}
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${unresolved.has(p) ? 'border-danger/40 text-red-400 bg-danger/10' : 'border-border text-muted bg-surface'}`}
        >
          {`{{${p}}}`}
        </span>
      ))}
    </div>
  )
}

export function BasicsSection({ config, patch }: { config: TemplateConfig; patch: Patch }) {
  return (
    <Section title="Basics">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Kind">
          <select value={config.kind} onChange={(e) => patch({ kind: e.target.value as TemplateConfig['kind'] })} className={inputCls}>
            <option value="blog">Blog</option>
            <option value="faq">FAQ</option>
            <option value="page">Page</option>
          </select>
        </Field>
        <Field label="Default word count" hint="Used when a row has none, e.g. 1500-2500.">
          <input value={config.defaultWordCount ?? ''} onChange={(e) => patch({ defaultWordCount: e.target.value || undefined })} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Writer max tokens">
          <NumberInput value={config.writerMaxTokens} onChange={(n) => patch({ writerMaxTokens: n ?? 2000 })} />
        </Field>
      </div>
      {/* DR-017: research is chosen per topic (Home queue); when a topic has it, its brief is appended to this prompt. */}
      <p className="text-xs text-muted">Research is chosen per topic on the Home queue. When a topic is researched, its brief is added to this prompt.</p>
    </Section>
  )
}

export function PromptSection({ config, patch, unresolved }: { config: TemplateConfig; patch: Patch; unresolved: Set<string> }) {
  const lines = config.writerPrompt.split('\n').length
  return (
    <Section title="Writer prompt" hint="Sent to the generation model as one message. {{PLACEHOLDERS}} are filled in before sending.">
      <textarea
        value={config.writerPrompt}
        onChange={(e) => patch({ writerPrompt: e.target.value })}
        rows={Math.min(40, Math.max(18, lines + 2))}
        spellCheck={false}
        className={`${monoCls} resize-y`}
      />
      <div className="flex items-center justify-between gap-3">
        <PlaceholderChips text={config.writerPrompt} unresolved={unresolved} />
        <span className="text-[11px] text-muted font-mono tabular-nums shrink-0">{lines} lines</span>
      </div>
    </Section>
  )
}

export function LinkStepsSection({ config, patch, unresolved }: { config: TemplateConfig; patch: Patch; unresolved: Set<string> }) {
  const set = (i: number, p: Partial<SelectorStep>) => patch({ selectors: config.selectors.map((s, j) => (j === i ? { ...s, ...p } : s)) })
  return (
    <Section
      title={`Link steps (${config.selectors.length})`}
      hint="Calls to the utility model that pick internal links from the client’s link lists before writing. Links that aren’t in the lists are dropped."
      defaultOpen={config.selectors.length > 0}
    >
      {config.selectors.map((s, i) => (
        <div key={i} className="rounded-input border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_160px_120px_28px] gap-3 items-end">
            <Field label="Step name">
              <input value={s.id} onChange={(e) => set(i, { id: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Fills placeholder">
              <input value={s.output} onChange={(e) => set(i, { output: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Answer format">
              <select value={s.format} onChange={(e) => set(i, { format: e.target.value as SelectorStep['format'] })} className={inputCls}>
                <option value="urls">URL list</option>
                <option value="sections">Articles + products</option>
                <option value="single-url">One URL</option>
              </select>
            </Field>
            <Field label="Max tokens">
              <NumberInput value={s.maxTokens} onChange={(n) => set(i, { maxTokens: n ?? 300 })} />
            </Field>
            <button type="button" onClick={() => patch({ selectors: config.selectors.filter((_, j) => j !== i) })} aria-label="Remove step" className="text-muted hover:text-danger pb-2">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Field label="Candidate lists (placeholders, comma-separated)" hint="The step is skipped when these are all empty.">
            <CommaInput value={s.candidates} onChange={(candidates) => set(i, { candidates: candidates.map((c) => c.toUpperCase()) })} mono />
          </Field>
          <Field label="Prompt">
            <textarea value={s.prompt} onChange={(e) => set(i, { prompt: e.target.value })} rows={8} spellCheck={false} className={`${monoCls} resize-y`} />
          </Field>
          <PlaceholderChips text={s.prompt} unresolved={unresolved} />
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          patch({
            selectors: [
              ...config.selectors,
              { id: `links${config.selectors.length ? config.selectors.length + 1 : ''}`, prompt: '', maxTokens: 300, output: 'SELECTED_URLS', format: 'urls', candidates: [] },
            ],
          })
        }
        className="text-sm text-muted hover:text-accent inline-flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add link step
      </button>
    </Section>
  )
}

export function OutputSection({ config, patch }: { config: TemplateConfig; patch: Patch }) {
  return (
    <Section title="Output" hint="How the model’s answer is split into sections and put together." defaultOpen={false}>
      <Field label="Section markers, in order" hint="Plain-text labels the prompt asks for, e.g. ARTICLE_TITLE, META_TITLE, MAIN_CONTENT. Empty for FAQs.">
        <CommaInput value={config.markers} onChange={(markers) => patch({ markers: markers.map((m) => m.toUpperCase().replace(/[^A-Z0-9_]/g, '')) })} mono />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Layout">
          <select value={config.assembly} onChange={(e) => patch({ assembly: e.target.value as TemplateConfig['assembly'] })} className={inputCls}>
            <option value="raw">As written (FAQ)</option>
            <option value="meta-blog">Blog: title, meta, body, conclusion</option>
            <option value="tws-blog">Blog + Key Takeaways + FAQ</option>
            <option value="nch-blog">Blog + summary, takeaways, verdict, FAQ, tips</option>
            <option value="tribe-page">Community page (starts at ## Summary)</option>
          </select>
        </Field>
        <Field label="Title placeholder" hint="Used as the title when the model gives none (default: the article title).">
          <input value={config.titlePlaceholder ?? ''} onChange={(e) => patch({ titlePlaceholder: e.target.value.toUpperCase() || undefined })} className={`${inputCls} font-mono`} />
        </Field>
      </div>
      <Toggle checked={config.blogCleanup} onChange={(blogCleanup) => patch({ blogCleanup })} label="Blog cleanup (no bold in tables, no blank line between headings)" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="CTA links" hint="Always allowed, not counted as internal links. One per line.">
          <LinesInput value={config.ctaUrls} onChange={(ctaUrls) => patch({ ctaUrls })} rows={2} />
        </Field>
        <Field label="Lead-in phrases banned before links" hint="Default: check out, click here, learn more about, read our guide on.">
          <LinesInput value={config.leadIns} onChange={(leadIns) => patch({ leadIns })} rows={2} />
        </Field>
      </div>
    </Section>
  )
}

export function ChecksSection({ config, patch }: { config: TemplateConfig; patch: Patch }) {
  const c = config.checks
  const set = (p: Partial<CheckConfig>) => patch({ checks: { ...c, ...p } })
  return (
    <Section title="Checks" hint="Run on every draft. If any fail, the draft is rewritten once with the failures listed; if it still fails it’s marked Needs review." defaultOpen={false}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="H2 sections (in the main content)">
          <RangeInput value={c.h2} onChange={(h2) => set({ h2 })} />
        </Field>
        <Field label="H3 headings (in the main content)">
          <RangeInput value={c.h3} onChange={(h3) => set({ h3 })} />
        </Field>
        <Field label="Internal links (CTA links not counted)">
          <RangeInput value={c.links?.min !== undefined || c.links?.max !== undefined ? { min: c.links?.min ?? 0, max: c.links?.max ?? 0 } : undefined} onChange={(r) => set({ links: r ? { ...c.links, ...r } : undefined })} />
        </Field>
        <Field label="Word count tolerance" hint="For prompts that say “about”: 10 = ±10%.">
          <NumberInput value={c.wordCountTolerance !== undefined ? Math.round(c.wordCountTolerance * 100) : undefined} onChange={(n) => set({ wordCountTolerance: n === undefined ? undefined : Math.min(50, n) / 100 })} />
        </Field>
        <Field label="Meta title max characters">
          <NumberInput value={c.metaTitleMax} onChange={(metaTitleMax) => set({ metaTitleMax })} />
        </Field>
        <Field label="Meta description max characters">
          <NumberInput value={c.metaDescriptionMax} onChange={(metaDescriptionMax) => set({ metaDescriptionMax })} />
        </Field>
        <Field label="Conclusion heading words">
          <RangeInput value={c.conclusionHeaderWords} onChange={(conclusionHeaderWords) => set({ conclusionHeaderWords })} />
        </Field>
        <Field label="Question headings">
          <div className="grid grid-cols-[90px_1fr_1fr] gap-2">
            <select
              value={c.questions?.level ?? ''}
              onChange={(e) => set({ questions: e.target.value ? { min: c.questions?.min ?? 0, max: c.questions?.max ?? 0, level: Number(e.target.value) as 2 | 3, section: c.questions?.section } : undefined })}
              className={inputCls}
            >
              <option value="">Off</option>
              <option value="2">H2</option>
              <option value="3">H3</option>
            </select>
            <input
              value={c.questions?.section ?? ''}
              placeholder="Section (whole doc)"
              disabled={!c.questions}
              onChange={(e) => c.questions && set({ questions: { ...c.questions, section: e.target.value.toUpperCase() || undefined } })}
              className={`${inputCls} font-mono`}
            />
            <RangeInput value={c.questions ? { min: c.questions.min, max: c.questions.max } : undefined} onChange={(r) => c.questions && r && set({ questions: { ...c.questions, ...r } })} />
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle checked={!!c.onlySuppliedUrls} onChange={(v) => set({ onlySuppliedUrls: v || undefined })} label="Only link to supplied URLs" />
        <Toggle checked={!!c.noEmDash} onChange={(v) => set({ noEmDash: v || undefined })} label="No em dashes" />
        <Toggle checked={!!c.h2Questions} onChange={(v) => set({ h2Questions: v || undefined })} label="Every H2 is a question" />
      </div>
      <Field label="Banned phrases" hint="One per line; matched as whole words, any case.">
        <LinesInput value={c.bannedPhrases} onChange={(bannedPhrases) => set({ bannedPhrases })} rows={3} />
      </Field>
      <Field label="List lengths" hint="Bullet or numbered items inside a section, e.g. KEY_TAKEAWAYS 4–5.">
        <div className="space-y-2">
          {(c.lists ?? []).map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_28px] gap-2 items-center">
              <input value={l.section} onChange={(e) => set({ lists: c.lists!.map((x, j) => (j === i ? { ...x, section: e.target.value.toUpperCase() } : x)) })} placeholder="Section" className={`${inputCls} font-mono`} />
              <input value={l.label} onChange={(e) => set({ lists: c.lists!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" className={inputCls} />
              <RangeInput value={{ min: l.min, max: l.max }} onChange={(r) => r && set({ lists: c.lists!.map((x, j) => (j === i ? { ...x, ...r } : x)) })} />
              <button type="button" aria-label="Remove" onClick={() => set({ lists: c.lists!.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set({ lists: [...(c.lists ?? []), { section: '', label: '', min: 3, max: 5 }] })} className="text-xs text-muted hover:text-accent inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add list check
          </button>
        </div>
      </Field>
      <Field label="Words only allowed near certain names" hint="e.g. “Swiss” only in a sentence that names Tissot, Alpina, Frederique Constant or Sandoz.">
        <div className="space-y-2">
          {(c.proximity ?? []).map((r, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_1fr_28px] gap-2 items-center">
              <input value={r.label} onChange={(e) => set({ proximity: c.proximity!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" className={inputCls} />
              <CommaInput value={r.terms} onChange={(terms) => set({ proximity: c.proximity!.map((x, j) => (j === i ? { ...x, terms } : x)) })} placeholder="Words" />
              <CommaInput value={r.allowedWith} onChange={(allowedWith) => set({ proximity: c.proximity!.map((x, j) => (j === i ? { ...x, allowedWith } : x)) })} placeholder="Allowed with" />
              <button type="button" aria-label="Remove" onClick={() => set({ proximity: c.proximity!.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set({ proximity: [...(c.proximity ?? []), { label: '', terms: [], allowedWith: [] }] })} className="text-xs text-muted hover:text-accent inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add rule
          </button>
        </div>
      </Field>
    </Section>
  )
}

export function HooksSection({ config, patch, inventories }: { config: TemplateConfig; patch: Patch; inventories: { slug: string; name: string }[] }) {
  const has = (id: string) => config.hooks.find((h) => h.id === id)
  const toggle = (id: string, on: boolean) =>
    patch({ hooks: on ? [...config.hooks, { id, ...(id.includes('links') || id.includes('directory') ? { options: { inventory: inventories[0]?.slug ?? '' } } : {}) }] : config.hooks.filter((h) => h.id !== id) })
  const setOpt = (id: string, key: string, v: string) => patch({ hooks: config.hooks.map((h) => (h.id === id ? { ...h, options: { ...h.options, [key]: v } } : h)) })
  return (
    <Section title={`Hooks (${config.hooks.length})`} hint="Built-in steps that run before link selection. New hooks are added by a developer." defaultOpen={config.hooks.length > 0}>
      {Object.entries(TEMPLATE_HOOKS).map(([id, h]) => {
        const on = has(id)
        return (
          <div key={id} className={`rounded-input border p-3 ${on ? 'border-accent/40 bg-accent/5' : 'border-border'}`}>
            <Toggle checked={!!on} onChange={(v) => toggle(id, v)} label={h.label} />
            <p className="text-xs text-muted mt-1 ml-11">{h.description}</p>
            {on && (id === 'ut-tribe-links' || id === 'fifa-links' || id === 'fifa-city-directory') && (
              <div className="ml-11 mt-2 max-w-xs">
                <select value={on.options?.inventory ?? ''} onChange={(e) => setOpt(id, 'inventory', e.target.value)} className={inputCls} aria-label="Link list">
                  <option value="">Choose a link list</option>
                  {inventories.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {on && id === 'product-page' && (
              <div className="ml-11 mt-2 max-w-xs">
                <input value={on.options?.urlInput ?? 'itemUrl'} onChange={(e) => setOpt(id, 'urlInput', e.target.value)} placeholder="Row input with the URL" className={`${inputCls} font-mono`} aria-label="Row input with the product URL" />
              </div>
            )}
          </div>
        )
      })}
    </Section>
  )
}

const SOURCE_LABEL: Record<ValueSource['from'], string> = {
  article: 'Article field',
  keywords: 'Keywords',
  input: 'Row input',
  wordCount: 'Word count',
  currentYear: 'Current year',
  inventory: 'Link list',
}

export function ValuesSection({ config, patch, inventories, unresolved }: { config: TemplateConfig; patch: Patch; inventories: { slug: string; name: string }[]; unresolved: Set<string> }) {
  const entries = Object.entries(config.values)
  const setSource = (name: string, src: ValueSource) => patch({ values: { ...config.values, [name]: src } })
  const rename = (from: string, to: string) => {
    const next: Record<string, ValueSource> = {}
    for (const [k, v] of entries) next[k === from ? to : k] = v
    patch({ values: next })
  }
  return (
    <Section title="Placeholder sources" hint="Where each {{PLACEHOLDER}} gets its value. Hooks and link steps fill the rest." defaultOpen={unresolved.size > 0}>
      {unresolved.size > 0 && (
        <p className="text-xs text-red-400">
          No source yet for {[...unresolved].map((u) => `{{${u}}}`).join(', ')}.{' '}
          <button type="button" className="underline" onClick={() => patch({ values: { ...config.values, ...Object.fromEntries([...unresolved].map((u) => [u, { from: 'article', field: 'title' } as ValueSource])) } })}>
            Add rows for them
          </button>
        </p>
      )}
      {entries.map(([name, src]) => (
        <div key={name} className="grid grid-cols-1 md:grid-cols-[180px_160px_1fr_28px] gap-2 items-center">
          <input defaultValue={name} onBlur={(e) => e.target.value !== name && rename(name, e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} className={`${inputCls} font-mono`} />
          <select
            value={src.from}
            onChange={(e) => {
              const from = e.target.value as ValueSource['from']
              setSource(
                name,
                from === 'article'
                  ? { from, field: 'title' }
                  : from === 'input'
                    ? { from, key: '' }
                    : from === 'inventory'
                      ? { from, inventory: inventories[0]?.slug ?? '', format: '{title}-{url}' }
                      : from === 'keywords'
                        ? { from }
                        : { from },
              )
            }}
            className={inputCls}
          >
            {(Object.keys(SOURCE_LABEL) as ValueSource['from'][]).map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABEL[k]}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            {src.from === 'article' && (
              <select value={src.field} onChange={(e) => setSource(name, { from: 'article', field: e.target.value as 'title' | 'brief' | 'primaryKeyword' })} className={inputCls}>
                <option value="title">Title</option>
                <option value="brief">Brief</option>
                <option value="primaryKeyword">Primary keyword</option>
              </select>
            )}
            {src.from === 'input' && <input value={src.key} onChange={(e) => setSource(name, { ...src, key: e.target.value })} placeholder="Input key, e.g. itemUrl" className={`${inputCls} font-mono`} />}
            {src.from === 'keywords' && <input value={src.empty ?? ''} onChange={(e) => setSource(name, { from: 'keywords', empty: e.target.value || undefined })} placeholder="When empty, e.g. (none)" className={inputCls} />}
            {src.from === 'inventory' && (
              <>
                <select value={src.inventory} onChange={(e) => setSource(name, { ...src, inventory: e.target.value })} className={inputCls}>
                  {inventories.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <input value={src.format} onChange={(e) => setSource(name, { ...src, format: e.target.value })} title="Line format: {title}, {url}, {attr.city}" className={`${inputCls} font-mono`} />
              </>
            )}
          </div>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => patch({ values: Object.fromEntries(entries.filter(([k]) => k !== name)) })}
            className="text-muted hover:text-danger"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => patch({ values: { ...config.values, NEW_PLACEHOLDER: { from: 'article', field: 'title' } } })} className="text-xs text-muted hover:text-accent inline-flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add source
      </button>
    </Section>
  )
}

export function InputsSection({ config, patch }: { config: TemplateConfig; patch: Patch }) {
  const set = (i: number, p: Partial<TemplateInputField>) => patch({ inputs: config.inputs.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  return (
    <Section title={`Row inputs (${config.inputs.length})`} hint="The columns a row carries, and the sheet header names that map to each (used by Import and Sheet sync)." defaultOpen={false}>
      {config.inputs.map((f, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[140px_160px_1fr_110px_28px] gap-2 items-center">
          <input value={f.key} onChange={(e) => set(i, { key: e.target.value })} placeholder="key" className={`${inputCls} font-mono`} />
          <input value={f.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Label" className={inputCls} />
          <CommaInput value={f.aliases ?? []} onChange={(aliases) => set(i, { aliases })} placeholder="Header names" />
          <Toggle checked={!!f.required} onChange={(required) => set(i, { required: required || undefined })} label="Required" />
          <button type="button" aria-label="Remove input" onClick={() => patch({ inputs: config.inputs.filter((_, j) => j !== i) })} className="text-muted hover:text-danger">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <p className="text-[11px] text-muted">Keys title, brief, keywords and wordcount fill the article itself; any other key is stored with the row (e.g. itemUrl).</p>
      <button type="button" onClick={() => patch({ inputs: [...config.inputs, { key: '', label: '' }] })} className="text-xs text-muted hover:text-accent inline-flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add input
      </button>
    </Section>
  )
}
