'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileUp, Link2, ClipboardPaste, Loader2, X } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import {
  CATEGORY_SHORT_LABELS,
  GUIDELINE_CATEGORIES,
  type ExtractedRule,
  type GuidelineCategory,
  type GuidelineDTO,
} from '@/lib/guidelines'

type Step = 'source' | 'extracting' | 'review'

interface Proposal {
  include: boolean
  category: GuidelineCategory
  title: string
  rule: string
  weight: number
}

const inputCls =
  'w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// DR-006 ingestion: source (DOCX / URL / paste) → extract → review-before-save. Nothing is
// written until the user confirms; created rules land as source: 'ingested'.
export function ImportFromDocumentModal({
  isOpen,
  clientId,
  onClose,
  onImported,
}: {
  isOpen: boolean
  clientId: string
  onClose: () => void
  onImported: (created: GuidelineDTO[]) => void
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('source')
  const [dragOver, setDragOver] = useState(false)
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setStep('source')
    setDragOver(false)
    setUrl('')
    setPasted('')
    setProposals([])
    setAdding(false)
  }, [isOpen])

  // Shared path for all three sources: parse → plain text (50–50,000 chars) → extract → review.
  // Any failure returns to step 1 so the user can try a different source (apiFetch toasts).
  async function extractFrom(resolveText: () => Promise<{ text: string; sourceRef?: string }>) {
    setStep('extracting')
    try {
      const { text, sourceRef } = await resolveText()
      const trimmed = text.trim().slice(0, 50000)
      if (trimmed.length < 50) {
        toast.error('Not enough text to extract rules from', 'Provide at least 50 characters of guideline text.')
        setStep('source')
        return
      }
      const { proposals: found } = await apiFetch<{ proposals: ExtractedRule[] }>(
        `/api/clients/${clientId}/guidelines/extract`,
        { method: 'POST', errorTitle: 'Could not extract guidelines', body: { text: trimmed, sourceRef } },
      )
      if (!found.length) {
        toast.warning('No rules found', 'The extractor could not find any guidelines in that text.')
        setStep('source')
        return
      }
      setProposals(
        found.map((p) => ({ include: true, category: p.category, title: p.title ?? '', rule: p.rule, weight: p.weight })),
      )
      setStep('review')
    } catch {
      setStep('source')
    }
  }

  function handleFile(file: File) {
    extractFrom(async () => {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch<{ content: string; filename?: string }>('/api/content/parse', {
        method: 'POST',
        body: form,
        errorTitle: `Could not read ${file.name}`,
      })
      return { text: htmlToText(res.content), sourceRef: res.filename ?? file.name }
    })
  }

  function handleUrl() {
    const u = url.trim()
    if (!u) return
    extractFrom(async () => {
      const res = await apiFetch<{ content: string }>('/api/content/parse', {
        method: 'POST',
        errorTitle: 'Could not fetch that URL',
        body: { url: u },
      })
      return { text: htmlToText(res.content), sourceRef: u }
    })
  }

  function handlePaste() {
    const text = pasted.trim()
    if (text.length < 50) return
    extractFrom(async () => ({ text }))
  }

  async function addIncluded() {
    const included = proposals.filter((p) => p.include && p.rule.trim())
    if (!included.length || adding) return
    setAdding(true)
    try {
      const created = await Promise.all(
        included.map((p) =>
          apiFetch<{ guideline: GuidelineDTO }>(`/api/clients/${clientId}/guidelines`, {
            method: 'POST',
            errorTitle: 'Could not add a guideline',
            body: { category: p.category, title: p.title.trim() || null, rule: p.rule.trim(), weight: p.weight, source: 'ingested' },
          }).then((r) => r.guideline),
        ),
      )
      toast.success(`${created.length} ${created.length === 1 ? 'guideline' : 'guidelines'} added`)
      onImported(created)
      onClose()
    } catch {
      setAdding(false)
    }
  }

  const includedCount = proposals.filter((p) => p.include && p.rule.trim()).length
  const titles: Record<Step, string> = {
    source: 'Import from document',
    extracting: 'Extracting rules…',
    review: 'Review extracted rules',
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'var(--color-modal-backdrop)' }}
            onClick={step === 'extracting' ? undefined : onClose}
          />
          <motion.div
            onKeyDown={(e) => e.key === 'Escape' && step !== 'extracting' && onClose()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative glass-card w-full max-w-[640px] shadow-2xl flex flex-col bg-surface max-h-[85vh]"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6 border-b border-border flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3">
                <FileUp className="w-5 h-5 text-accent" />
                <h2 className="text-xl font-display text-heading">{titles[step]}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={step === 'extracting'}
                aria-label="Close"
                className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {step === 'source' && (
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx,.doc"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                    e.target.value = ''
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) handleFile(f)
                  }}
                  className="relative rounded-card p-[1px] overflow-hidden group cursor-pointer"
                >
                  <div className={`absolute inset-0 dashed-border-animated transition-opacity ${dragOver ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`} />
                  <div
                    className={`relative backdrop-blur-sm rounded-card p-8 flex flex-col items-center justify-center text-center m-[1px] transition-colors ${
                      dragOver ? 'bg-accent/5' : 'bg-background/80 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center mb-3 group-hover:animate-bounce-subtle">
                      <FileUp className="w-5 h-5 text-accent drop-shadow-[0_0_8px_rgba(232,69,10,0.5)]" />
                    </div>
                    <h3 className="text-heading font-medium mb-1">Upload a .docx file</h3>
                    <p className="text-sm text-muted">A style guide, brief or brand book. The text is extracted here.</p>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-heading mb-1.5">
                    <Link2 className="w-4 h-4 text-muted" /> From a URL or Google Doc
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
                      className={inputCls}
                      placeholder="https://…"
                    />
                    <button
                      type="button"
                      onClick={handleUrl}
                      disabled={!url.trim()}
                      className="px-4 py-2 rounded-input text-sm font-medium border border-border text-body hover:text-heading hover:bg-surface-hover transition-colors disabled:opacity-50 shrink-0"
                    >
                      Fetch
                    </button>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-heading mb-1.5">
                    <ClipboardPaste className="w-4 h-4 text-muted" /> Paste text
                  </label>
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={5}
                    className={`${inputCls} resize-y`}
                    placeholder="Paste the guideline text here (at least 50 characters)…"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={handlePaste}
                      disabled={pasted.trim().length < 50}
                      className="bg-accent hover:bg-accent/90 text-white px-5 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Extract rules
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'extracting' && (
              <div className="p-14 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
                <p className="text-heading font-medium">Extracting rules…</p>
                <p className="text-sm text-muted mt-1">Reading the document and turning it into categorized guidelines.</p>
              </div>
            )}

            {step === 'review' && (
              <>
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                  <p className="text-sm text-muted">
                    <span className="text-heading font-medium font-mono tabular-nums">{proposals.length}</span>{' '}
                    {proposals.length === 1 ? 'rule' : 'rules'} found. Edit anything before adding — nothing is saved yet.
                  </p>
                  <ul className="space-y-3">
                    {proposals.map((p, i) => (
                      <li key={i} className={`glass-card p-4 space-y-2.5 ${p.include ? '' : 'opacity-50'}`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            aria-label={`Include rule ${i + 1}`}
                            checked={p.include}
                            onChange={(e) => setProposals((list) => list.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                            className="w-4 h-4 rounded border-border accent-[#E8450A] shrink-0"
                          />
                          <input
                            value={p.title}
                            onChange={(e) => setProposals((list) => list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                            maxLength={120}
                            className={inputCls}
                            placeholder="Title (optional)"
                          />
                          <select
                            value={p.category}
                            onChange={(e) =>
                              setProposals((list) => list.map((x, j) => (j === i ? { ...x, category: e.target.value as GuidelineCategory } : x)))
                            }
                            className={`${inputCls} w-36 shrink-0`}
                          >
                            {GUIDELINE_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {CATEGORY_SHORT_LABELS[c]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={p.rule}
                          onChange={(e) => setProposals((list) => list.map((x, j) => (j === i ? { ...x, rule: e.target.value } : x)))}
                          rows={2}
                          maxLength={2000}
                          className={`${inputCls} resize-y`}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6 border-t border-border bg-surface flex items-center justify-end gap-3 rounded-b-card shrink-0">
                  <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addIncluded}
                    disabled={!includedCount || adding}
                    className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add {includedCount} {includedCount === 1 ? 'guideline' : 'guidelines'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
