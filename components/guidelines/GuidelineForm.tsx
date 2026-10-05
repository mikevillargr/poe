'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  CATEGORY_SHORT_LABELS,
  GUIDELINE_CATEGORIES,
  type GuidelineCategory,
  type GuidelineDTO,
} from '@/lib/guidelines'

export interface GuidelineFormValues {
  category: GuidelineCategory
  title: string
  rule: string
  weight: number
}

const inputCls =
  'w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'

// DR-006: inline add/edit form (no modal). Weight is de-emphasized as "Priority (1–10)".
export function GuidelineForm({
  initial,
  defaultCategory,
  saving,
  onSave,
  onCancel,
}: {
  initial?: GuidelineDTO
  defaultCategory: GuidelineCategory
  saving: boolean
  onSave: (values: GuidelineFormValues) => void
  onCancel: () => void
}) {
  const [category, setCategory] = useState<GuidelineCategory>(
    (initial?.category as GuidelineCategory) ?? defaultCategory,
  )
  const [title, setTitle] = useState(initial?.title ?? '')
  const [rule, setRule] = useState(initial?.rule ?? '')
  const [weight, setWeight] = useState(initial?.weight ?? 5)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!rule.trim() || saving) return
    onSave({ category, title, rule, weight: Math.min(10, Math.max(1, Math.round(weight) || 5)) })
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px_130px] gap-3">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Title <span className="font-normal">(optional)</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className={inputCls}
            placeholder="e.g. Primary keyword placement"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as GuidelineCategory)} className={inputCls}>
            {GUIDELINE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_SHORT_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Priority (1–10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className={`${inputCls} font-mono tabular-nums`}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Rule <span className="text-accent">*</span>
        </label>
        <textarea
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          rows={3}
          maxLength={2000}
          autoFocus
          className={`${inputCls} resize-y`}
          placeholder="The rule, in plain language, exactly as generation should follow it."
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={!rule.trim() || saving}
          className="bg-accent hover:bg-accent/90 text-white px-5 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {initial ? 'Save' : 'Add guideline'}
        </button>
      </div>
    </form>
  )
}
