'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Sheet, Copy, Loader2, Upload, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'

// DR-011 Settings card: Poe's Google service account ("robot") for reading Sheets. The key file is
// validated and stored encrypted; only the robot's email is ever shown.

interface Status {
  configured: boolean
  clientEmail: string | null
  source: 'db' | 'env' | null
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}

export function GoogleSheetsCard() {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [paste, setPaste] = useState('')
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    apiFetch<Status>('/api/admin/google', { errorTitle: 'Couldn’t load Google Sheets status' })
      .then(setStatus)
      .catch(() => setStatus({ configured: false, clientEmail: null, source: null }))
  }, [])

  async function save(json: string) {
    setBusy('save')
    setTest(null)
    try {
      const s = await apiFetch<Status>('/api/admin/google', { method: 'PUT', body: { serviceAccountJson: json }, silent: true })
      setStatus(s)
      setPaste('')
      toast.success('Google Sheets connected', s.clientEmail ?? undefined)
    } catch (err) {
      toast.error('Couldn’t save the key', err instanceof ApiFetchError ? err.message : undefined)
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function runTest() {
    setBusy('test')
    try {
      setTest(await apiFetch<{ ok: boolean; message: string }>('/api/admin/google/test', { method: 'POST', body: {}, errorTitle: 'Test failed' }))
    } catch {
      // toasted
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setRemoving(false)
    setBusy('remove')
    try {
      const s = await apiFetch<Status>('/api/admin/google', { method: 'DELETE', errorTitle: 'Couldn’t remove the key' })
      setStatus(s)
      setTest(null)
      toast.info('Google Sheets key removed', s.configured ? 'Now using the server environment key.' : undefined)
    } catch {
      // toasted
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div variants={itemVariants} id="google-sheets" className="glass-card mb-6 scroll-mt-6">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <Sheet className="w-5 h-5 text-accent" />
        <h2 className="text-xl font-display text-heading">Google Sheets</h2>
      </div>
      <div className="p-6 space-y-4">
        {!status ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : status.configured ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
                <span className="text-muted">· {status.source === 'env' ? 'from the server environment' : 'saved in Poe'}</span>
              </div>
              <div className="text-sm font-mono text-heading mt-1 truncate">{status.clientEmail}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => status.clientEmail && navigator.clipboard.writeText(status.clientEmail).then(() => toast.success('Email copied'))}
                className="px-3 py-1.5 rounded-input text-xs border border-border text-heading hover:bg-surface-hover inline-flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy email
              </button>
              <button
                type="button"
                onClick={runTest}
                disabled={!!busy}
                className="px-3 py-1.5 rounded-input text-xs border border-border text-heading hover:bg-surface-hover inline-flex items-center gap-1 disabled:opacity-50"
              >
                {busy === 'test' && <Loader2 className="w-3 h-3 animate-spin" />} Test
              </button>
              {status.source === 'db' && (
                <button
                  type="button"
                  onClick={() => setRemoving(true)}
                  disabled={!!busy}
                  className="p-1.5 rounded text-muted hover:text-danger hover:bg-danger/10"
                  aria-label="Remove key"
                  title="Remove key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Not connected. Uploading files works without it; live sheet sync needs it.</p>
        )}

        {test && (
          <p className={`text-sm flex items-center gap-1.5 ${test.ok ? 'text-green-500' : 'text-red-400'}`}>
            {test.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {test.message}
          </p>
        )}

        <div className="rounded-input border border-border bg-background p-4 space-y-3">
          <div className="text-sm text-heading font-medium">{status?.configured ? 'Replace the key' : 'Connect'}</div>
          <ol className="text-xs text-muted space-y-1 list-decimal pl-4">
            <li>In Google Cloud, enable the Google Sheets API and create a service account (no roles needed).</li>
            <li>On the service account, Keys → Add key → JSON. A file downloads.</li>
            <li>Upload it here. Then share each sheet you want to sync with the account’s email as a Viewer.</li>
          </ol>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => e.target.files?.[0] && save(await e.target.files[0].text())} />
          <div className="flex flex-col md:flex-row gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="px-4 py-2 rounded-input text-sm border border-border text-heading hover:bg-surface-hover inline-flex items-center gap-2 disabled:opacity-50 shrink-0"
            >
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload key file
            </button>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={1}
              placeholder="…or paste the key file’s contents"
              className="flex-1 px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            />
            {paste.trim() && (
              <button
                type="button"
                onClick={() => save(paste)}
                disabled={!!busy}
                className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium disabled:opacity-50 shrink-0"
              >
                Save
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted">The key is stored encrypted and never shown again; only the account email is displayed.</p>
        </div>
      </div>
      <ConfirmModal
        isOpen={removing}
        title="Remove Google Sheets key"
        message="Poe will stop syncing sheets (unless the server environment has a key). Articles and links already imported stay."
        confirmLabel="Remove key"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setRemoving(false)}
      />
    </motion.div>
  )
}
