'use client'

// Small form fields for the template editor (DR-010), in Poe's input style.

export const inputCls =
  'w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
export const monoCls = `${inputCls} font-mono text-[13px] leading-relaxed`
export const labelCls = 'block text-xs font-medium text-muted mb-1'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-body cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-[var(--color-gauge-bg)] border border-border'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  )
}

/** Optional number: blank = undefined. */
export function NumberInput({ value, onChange, placeholder, min }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string; min?: number }) {
  return (
    <input
      inputMode="numeric"
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d]/g, '')
        onChange(v === '' ? undefined : Math.max(min ?? 0, Number(v)))
      }}
      className={`${inputCls} font-mono tabular-nums`}
    />
  )
}

/** min–max pair; both blank = undefined. */
export function RangeInput({ value, onChange }: { value?: { min: number; max: number }; onChange: (v: { min: number; max: number } | undefined) => void }) {
  const set = (k: 'min' | 'max', n: number | undefined) => {
    const next = { min: value?.min ?? 0, max: value?.max ?? 0, [k]: n ?? 0 }
    onChange(n === undefined && (k === 'min' ? value?.max === undefined : value?.min === undefined) ? undefined : next)
  }
  return (
    <div className="flex items-center gap-2">
      <NumberInput value={value?.min} onChange={(n) => set('min', n)} placeholder="min" />
      <span className="text-muted">–</span>
      <NumberInput value={value?.max} onChange={(n) => set('max', n)} placeholder="max" />
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className="text-xs text-muted hover:text-heading shrink-0">
          Off
        </button>
      )}
    </div>
  )
}

/** One item per line. */
export function LinesInput({ value, onChange, rows = 3, placeholder }: { value?: string[]; onChange: (v: string[] | undefined) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={(value ?? []).join('\n')}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => {
        const lines = e.target.value.split('\n')
        onChange(lines.length === 1 && !lines[0] ? undefined : lines)
      }}
      onBlur={(e) => {
        const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean)
        onChange(lines.length ? lines : undefined)
      }}
      className={`${inputCls} resize-y`}
    />
  )
}

/** Comma-separated list. */
export function CommaInput({ value, onChange, placeholder, mono }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      defaultValue={value.join(', ')}
      key={value.join(',')}
      placeholder={placeholder}
      onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
      className={mono ? monoCls : inputCls}
    />
  )
}
