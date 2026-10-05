'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, X, Loader2 } from 'lucide-react'
import { slugify } from '@/lib/clients/schemas'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: (client: { id: string; name: string; slug: string }, copiedGuidelines: number) => void
}

// DR-001: name + auto-derived slug + optional website; notes the Universal template copy.
export function AddClientModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [website, setWebsite] = useState('')
  const [templateCount, setTemplateCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setName('')
    setSlug('')
    setSlugEdited(false)
    setWebsite('')
    setErrors({})
    setTimeout(() => nameRef.current?.focus(), 50)
    fetch('/api/universal-guidelines/count')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setTemplateCount(d?.count ?? null))
      .catch(() => setTemplateCount(null))
  }, [isOpen])

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name))
  }, [name, slugEdited])

  const valid = name.trim().length > 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setErrors({})
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug, website: website.trim() || undefined }),
      })
      const body = await res.json()
      if (!res.ok) {
        const fieldErrors = body?.details?.fieldErrors as Record<string, string[]> | undefined
        if (fieldErrors) setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0]])))
        else if (body?.code === 'CONFLICT') setErrors({ slug: body.error })
        else setErrors({ form: body?.error ?? 'Could not create the client.' })
        return
      }
      onCreated(body.client, body.copiedGuidelines)
    } catch {
      setErrors({ form: 'Could not reach the server. Try again.' })
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative glass-card w-full max-w-[480px] shadow-2xl flex flex-col bg-surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-client-title"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          >
            <div className="p-6 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-accent" />
                <h2 id="add-client-title" className="text-xl font-display text-heading">
                  Add client
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="client-name" className="block text-sm font-medium text-heading mb-1.5">
                  Client name
                </label>
                <input
                  id="client-name"
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className={inputCls}
                  maxLength={100}
                />
                {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="client-slug" className="block text-sm font-medium text-heading mb-1.5">
                  Slug
                </label>
                <div className="flex items-stretch">
                  <span className="px-3 flex items-center text-sm text-muted font-mono bg-surface-hover border border-r-0 border-[var(--color-input-border)] rounded-l-input">
                    /c/
                  </span>
                  <input
                    id="client-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true)
                      setSlug(e.target.value.toLowerCase())
                    }}
                    className={`${inputCls} rounded-l-none font-mono`}
                    maxLength={48}
                  />
                </div>
                {errors.slug && <p className="mt-1 text-xs text-red-400">{errors.slug}</p>}
              </div>

              <div>
                <label htmlFor="client-website" className="block text-sm font-medium text-heading mb-1.5">
                  Website <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="client-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className={inputCls}
                  inputMode="url"
                />
                {errors.website && <p className="mt-1 text-xs text-red-400">{errors.website}</p>}
              </div>

              <p className="text-sm text-muted">
                Starts with a copy of the Universal guidelines
                {templateCount !== null && (
                  <>
                    {' '}
                    (<span className="font-mono tabular-nums">{templateCount}</span>{' '}
                    {templateCount === 1 ? 'rule' : 'rules'})
                  </>
                )}
                .
              </p>
              {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}
            </div>

            <div className="p-6 border-t border-border bg-surface flex items-center justify-end gap-3 rounded-b-card">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || submitting}
                className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create client
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  )
}
