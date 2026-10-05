'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FilePlus2, X, Loader2 } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { splitKeywords, type ArticleSummary } from '@/lib/articles/schemas'

// DR-003 "New Article": single manual add to the end of the queue.
export function NewArticleModal({
  isOpen,
  clientId,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  clientId: string
  onClose: () => void
  onCreated: (a: ArticleSummary) => void
}) {
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [keywords, setKeywords] = useState('')
  const [words, setWords] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const titleRef = useRef<HTMLInputElement>(null)
  const chips = useMemo(() => splitKeywords(keywords), [keywords])

  useEffect(() => {
    if (!isOpen) return
    setTitle('')
    setBrief('')
    setKeywords('')
    setWords('')
    setErrors({})
    setTimeout(() => titleRef.current?.focus(), 50)
  }, [isOpen])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setErrors({})
    try {
      const { article } = await apiFetch<{ article: ArticleSummary }>(`/api/clients/${clientId}/articles`, {
        method: 'POST',
        silent: true,
        body: {
          title: title.trim(),
          brief: brief.trim() || null,
          keywords: chips,
          targetWordCount: words ? Number(words) : null,
        },
      })
      onCreated(article)
    } catch (err) {
      if (err instanceof ApiFetchError && err.details?.fieldErrors) {
        setErrors(Object.fromEntries(Object.entries(err.details.fieldErrors).map(([k, v]) => [k, v[0]])))
      } else setErrors({ form: err instanceof Error ? err.message : 'Could not add the article.' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'

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
            onClick={onClose}
          />
          <motion.form
            onSubmit={submit}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative glass-card w-full max-w-[560px] shadow-2xl flex flex-col bg-surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-article-title"
          >
            <div className="p-6 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3">
                <FilePlus2 className="w-5 h-5 text-accent" />
                <h2 id="new-article-title" className="text-xl font-display text-heading">
                  New article
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="na-title" className="block text-sm font-medium text-heading mb-1.5">
                  Title
                </label>
                <input id="na-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className={inputCls} placeholder="e.g. How to Form an LLC in Nevada" />
                {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
              </div>
              <div>
                <label htmlFor="na-brief" className="block text-sm font-medium text-heading mb-1.5">
                  Brief <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea id="na-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} className={`${inputCls} resize-y`} placeholder="What the article should cover, for whom, and any angle the client approved." />
              </div>
              <div>
                <label htmlFor="na-keywords" className="block text-sm font-medium text-heading mb-1.5">
                  SEO keywords
                </label>
                <input id="na-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} placeholder="Comma-separated. The first one is the primary keyword." />
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {chips.map((k, i) => (
                      <span key={k} className={`px-2 py-0.5 rounded-full text-xs border ${i === 0 ? 'border-accent/40 text-accent bg-accent/10' : 'border-border text-body bg-surface'}`}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                {errors.keywords && <p className="mt-1 text-xs text-red-400">{errors.keywords}</p>}
              </div>
              <div>
                <label htmlFor="na-words" className="block text-sm font-medium text-heading mb-1.5">
                  Target word count
                </label>
                <input id="na-words" type="number" min={50} max={20000} step={50} value={words} onChange={(e) => setWords(e.target.value)} className={`${inputCls} font-mono tabular-nums max-w-[180px]`} placeholder="1500" />
                {errors.targetWordCount && <p className="mt-1 text-xs text-red-400">{errors.targetWordCount}</p>}
              </div>
              {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}
            </div>

            <div className="p-6 border-t border-border bg-surface flex items-center justify-end gap-3 rounded-b-card">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || submitting}
                className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Add to queue
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  )
}
