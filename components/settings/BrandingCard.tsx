'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Feather, Loader2, Palette, Trash2, Upload } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { DEFAULT_BRANDING, type Branding } from '@/lib/branding-defaults'
import { BrandMark } from '@/components/share/BrandMark'

// DR-021: the agency branding on shared article pages: logo, name, website and the "About Poe" text,
// with a live preview of the page's brand bar.

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}

const input =
  'w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-3 py-2 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'

export function BrandingCard() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState<Branding | null>(null)
  const [form, setForm] = useState({ agencyName: '', website: '', about: '' })
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null)

  function load(b: Branding) {
    setSaved(b)
    setForm({ agencyName: b.agencyName, website: b.website, about: b.about })
  }

  useEffect(() => {
    apiFetch<Branding>('/api/admin/branding', { errorTitle: 'Couldn’t load branding' })
      .then(load)
      .catch(() => load(DEFAULT_BRANDING))
  }, [])

  const dirty = !!saved && (form.agencyName !== saved.agencyName || form.website !== saved.website || form.about !== saved.about)

  async function save() {
    setBusy('save')
    try {
      load(await apiFetch<Branding>('/api/admin/branding', { method: 'PUT', body: form, silent: true }))
      toast.success('Branding saved', 'Shared article pages use it right away.')
    } catch (err) {
      toast.error('Couldn’t save branding', err instanceof ApiFetchError ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function upload(file: File) {
    setBusy('logo')
    try {
      const body = new FormData()
      body.set('file', file)
      const b = await apiFetch<Branding>('/api/admin/branding/logo', { method: 'POST', body, silent: true })
      setSaved((s) => (s ? { ...s, logoUrl: b.logoUrl } : b))
      toast.success('Logo updated')
    } catch (err) {
      toast.error('Couldn’t upload the logo', err instanceof ApiFetchError ? err.message : undefined)
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removeLogo() {
    setBusy('logo')
    try {
      const b = await apiFetch<Branding>('/api/admin/branding/logo', { method: 'DELETE', errorTitle: 'Couldn’t remove the logo' })
      setSaved((s) => (s ? { ...s, logoUrl: b.logoUrl } : b))
    } catch {
      // toasted
    } finally {
      setBusy(null)
    }
  }

  const preview: Branding = { ...(saved ?? DEFAULT_BRANDING), agencyName: form.agencyName || DEFAULT_BRANDING.agencyName }

  return (
    <motion.div variants={itemVariants} id="branding" className="glass-card mb-6 scroll-mt-6">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <Palette className="w-5 h-5 text-accent" />
        <div>
          <h2 className="text-xl font-display text-heading">Branding</h2>
          <p className="text-sm text-muted">Shown on shared article previews sent to clients and stakeholders.</p>
        </div>
      </div>
      {!saved ? (
        <div className="p-6 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="p-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div>
              <span className="block text-sm font-medium text-heading mb-1.5">Logo</span>
              <div className="flex items-center gap-3">
                <div className="h-12 min-w-[120px] px-3 rounded-input border border-dashed border-border flex items-center justify-center bg-surface">
                  {saved.logoUrl ? <BrandMark branding={saved} className="h-8" /> : <span className="text-xs text-muted">No logo yet</span>}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy === 'logo'}
                  className="border border-border rounded-input px-3 py-2 text-sm text-heading hover:bg-surface-hover inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy === 'logo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {saved.logoUrl ? 'Replace' : 'Upload'}
                </button>
                {saved.logoUrl && (
                  <button type="button" onClick={() => void removeLogo()} disabled={busy === 'logo'} className="p-2 text-muted hover:text-red-400" aria-label="Remove logo">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted mt-1.5">PNG, SVG, JPG or WebP, up to 512 KB. A wide logo on a transparent background works best.</p>
            </div>
            <label className="block">
              <span className="block text-sm font-medium text-heading mb-1.5">Agency name</span>
              <input className={input} value={form.agencyName} maxLength={80} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-heading mb-1.5">Website</span>
              <input className={input} value={form.website} placeholder="https://" maxLength={300} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-heading mb-1.5">About Poe</span>
              <textarea className={`${input} min-h-[120px] resize-y`} value={form.about} maxLength={1200} onChange={(e) => setForm({ ...form, about: e.target.value })} />
              <span className="block text-xs text-muted mt-1">A short explainer at the bottom of every shared page.</span>
            </label>
            <div className="flex justify-end gap-2">
              {dirty && (
                <button type="button" onClick={() => load(saved)} className="px-4 py-2 text-sm text-muted hover:text-heading">
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || busy === 'save'}
                className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" />} Save branding
              </button>
            </div>
          </div>

          <div aria-label="Preview" className="rounded-lg border border-border overflow-hidden bg-background self-start">
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted border-b border-border bg-surface">Preview</p>
            <div className="h-12 px-3 flex items-center gap-3 border-b border-border bg-surface">
              <BrandMark branding={preview} className="h-6" />
              <span className="w-px h-5 bg-border" />
              <span className="text-xs text-muted truncate">
                Prepared for <span className="text-heading">Client</span>
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <Feather className="w-4 h-4 text-accent" />
                <span className="font-display text-sm text-heading">About Poe</span>
              </div>
              <p className="mt-1.5 text-xs text-body leading-relaxed line-clamp-6">{form.about || DEFAULT_BRANDING.about}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
