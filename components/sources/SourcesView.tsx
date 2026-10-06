'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { Plus, Copy, ExternalLink, RefreshCw, Upload, Eye, Pencil, Trash2, Link2, CheckCircle2, Info, Sheet as SheetIcon } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import { useClientTemplates } from '@/components/workspace/TemplatePicker'
import { UploadLinksModal, ViewLinksModal, type Inventory } from './LinkListDialogs'
import { SheetSourceModal, SyncSheetModal, type SheetSource } from './SheetDialogs'

// DR-011 option A: a client's Sources: link lists (templates pick internal links from them) and Google
// Sheets (topic rows into a template's queue, or links into a list). Upload is the primary path; a sheet
// syncs live once Google Sheets is connected in Settings.

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}
const nf = new Intl.NumberFormat('en-US')
const KIND_LABEL: Record<Inventory['kind'], string> = { articles: 'Articles', products: 'Products', pages: 'Pages', videos: 'Videos', directory: 'Directory' }
const th = 'px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border'
const actionBtn = 'p-1.5 rounded text-muted hover:text-accent hover:bg-surface transition-colors disabled:opacity-40 disabled:hover:text-muted'

const ago = (iso: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : '—')

export function SourcesView({ client, isSuperAdmin }: { client: { id: string; name: string; slug: string }; isSuperAdmin: boolean }) {
  const { toast } = useToast()
  const templates = useClientTemplates(client.id)
  const [inventories, setInventories] = useState<Inventory[] | null>(null)
  const [sources, setSources] = useState<SheetSource[] | null>(null)
  const [google, setGoogle] = useState<{ configured: boolean; clientEmail: string | null }>({ configured: false, clientEmail: null })
  const [showSeeded, setShowSeeded] = useState(false)
  const [uploading, setUploading] = useState<Inventory | null>(null)
  const [viewing, setViewing] = useState<Inventory | null>(null)
  const [editing, setEditing] = useState<SheetSource | null>(null)
  const [adding, setAdding] = useState(false)
  const [syncing, setSyncing] = useState<SheetSource | null>(null)
  const [removing, setRemoving] = useState<SheetSource | null>(null)

  const load = useCallback(async () => {
    try {
      const [inv, src] = await Promise.all([
        apiFetch<{ inventories: Inventory[] }>(`/api/clients/${client.id}/inventories`, { errorTitle: 'Couldn’t load link lists' }),
        apiFetch<{ sources: SheetSource[]; google: { configured: boolean; clientEmail: string | null } }>(`/api/clients/${client.id}/sheet-sources`, {
          errorTitle: 'Couldn’t load sheets',
        }),
      ])
      setInventories(inv.inventories)
      setSources(src.sources)
      setGoogle(src.google)
    } catch {
      setInventories((v) => v ?? [])
      setSources((v) => v ?? [])
    }
  }, [client.id])
  useEffect(() => {
    void load()
  }, [load])

  // Sources seeded from the n8n register stay hidden until they've synced once (or on request).
  const seededHidden = (sources ?? []).filter((s) => s.seeded && !s.lastSyncedAt)
  const visibleSources = (sources ?? []).filter((s) => showSeeded || !(s.seeded && !s.lastSyncedAt))
  const sheetFor = useMemo(() => new Map((sources ?? []).filter((s) => s.inventorySlug).map((s) => [s.inventorySlug!, s])), [sources])

  async function remove() {
    const target = removing
    setRemoving(null)
    if (!target) return
    try {
      await apiFetch(`/api/clients/${client.id}/sheet-sources/${target.id}`, { method: 'DELETE', errorTitle: 'Couldn’t remove the sheet' })
      toast.success('Sheet removed', target.name)
      void load()
    } catch {
      // toasted
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-8 xl:p-10 max-w-[1200px] mx-auto">
      {/* Dialogs sit outside the spaced stack so space-y margins don't offset their fixed overlays. */}
      <div className="space-y-8">
        <motion.div variants={itemVariants} className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display text-heading">Sources</h1>
            <p className="text-sm text-muted mt-1">Where {client.name}’s internal links and topic sheets come from.</p>
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 border border-accent/40 text-accent hover:bg-accent/10 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add sheet
          </button>
        </motion.div>

        {/* Google connection */}
        <motion.div variants={itemVariants} className="glass-card px-5 py-3.5 flex items-center gap-3 text-sm">
          {google.configured ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-body">
                Google Sheets connected as <span className="font-mono text-heading">{google.clientEmail}</span>. Share a sheet with this email as a Viewer to sync it.
              </span>
              <button
                type="button"
                onClick={() => google.clientEmail && navigator.clipboard.writeText(google.clientEmail).then(() => toast.success('Email copied'))}
                className="ml-auto shrink-0 text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-input border border-border text-heading hover:bg-surface-hover"
              >
                <Copy className="w-3 h-3" /> Copy email
              </button>
            </>
          ) : (
            <>
              <Info className="w-4 h-4 text-muted shrink-0" />
              <span className="text-muted">
                Google Sheets isn’t connected, so sheets can’t sync yet. Uploading files works without it.{' '}
                {isSuperAdmin ? (
                  <Link href="/settings#google-sheets" className="text-accent hover:underline">
                    Connect it in Settings
                  </Link>
                ) : (
                  'Ask an admin to connect it in Settings.'
                )}
              </span>
            </>
          )}
        </motion.div>

        {/* Link lists */}
        <motion.section variants={itemVariants}>
          <h2 className="text-xl font-display text-heading mb-1">Link lists</h2>
          <p className="text-sm text-muted mb-4">Templates pick internal links only from these lists, so keep them current.</p>
          <div className="glass-card p-0 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className={th}>List</th>
                  <th className={`${th} text-right`}>Links</th>
                  <th className={th}>Source</th>
                  <th className={th}>Updated</th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(inventories ?? []).map((inv) => {
                  const sheet = sheetFor.get(inv.slug)
                  return (
                    <tr key={inv.slug} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-medium text-heading">{inv.name}</div>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[11px] border border-border text-muted">{KIND_LABEL[inv.kind]}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-mono tabular-nums text-heading">{nf.format(inv.items)}</td>
                      <td className="px-4 py-3.5 text-sm text-body">
                        {inv.source === 'sheet' && sheet ? (
                          <span className="inline-flex items-center gap-1">
                            <SheetIcon className="w-3.5 h-3.5 text-green-500" /> {sheet.name}
                          </span>
                        ) : inv.items ? (
                          'Upload'
                        ) : (
                          <span className="text-muted">Empty</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-muted font-mono">{ago(inv.lastSyncedAt)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className={actionBtn} title="View links" onClick={() => setViewing(inv)}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button type="button" className={actionBtn} title="Upload a file" onClick={() => setUploading(inv)}>
                            <Upload className="w-4 h-4" />
                          </button>
                          {sheet && (
                            <button
                              type="button"
                              className={actionBtn}
                              title={google.configured ? 'Sync from its sheet' : 'Connect Google Sheets to sync'}
                              disabled={!google.configured}
                              onClick={() => setSyncing(sheet)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {inventories?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      This client has no link lists. They come with templates that pick internal links.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Google Sheets */}
        <motion.section variants={itemVariants}>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-display text-heading mb-1">Google Sheets</h2>
              <p className="text-sm text-muted">Topic sheets add rows to a template’s queue; link sheets refresh a list. Sync runs only when you click it.</p>
            </div>
            {seededHidden.length > 0 && (
              <button type="button" onClick={() => setShowSeeded((v) => !v)} className="text-xs text-muted hover:text-heading shrink-0">
                {showSeeded ? 'Hide' : 'Show'} {seededHidden.length} sheets from the n8n setup
              </button>
            )}
          </div>
          {visibleSources.length === 0 ? (
            <div className="glass-card p-8 text-center space-y-2">
              <Link2 className="w-6 h-6 text-accent mx-auto" />
              <p className="text-sm text-heading">No sheets yet</p>
              <p className="text-sm text-muted">Add a Google Sheet when a client sends one. Or import topics from a file on the Import page.</p>
            </div>
          ) : (
            <div className="glass-card p-0 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Sheet</th>
                    <th className={th}>Feeds</th>
                    <th className={th}>Last sync</th>
                    <th className={`${th} text-right`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleSources.map((s) => {
                    const r = s.lastSyncResult
                    return (
                      <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                        <td className="px-4 py-3.5">
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${s.spreadsheetId}/edit`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-heading hover:text-accent inline-flex items-center gap-1.5"
                          >
                            <SheetIcon className="w-4 h-4 text-green-500" /> {s.name} <ExternalLink className="w-3 h-3 text-muted" />
                          </a>
                          <div className="text-xs text-muted mt-0.5">Tab “{s.tab}”</div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-body">
                          {s.target === 'topics' ? `→ ${s.templateName ?? 'template'} (topics)` : `→ ${s.inventoryName ?? 'link list'}`}
                        </td>
                        <td className="px-4 py-3.5 text-sm">
                          {r ? (
                            <div>
                              <span className="text-muted font-mono">{ago(r.at)}</span>
                              <span className="ml-2 px-2 py-0.5 rounded-full text-xs border border-success/30 text-green-400 bg-success/10 font-mono">
                                {s.target === 'topics' ? `+${r.added}` : `${nf.format(r.added)} links`}
                              </span>
                              {r.skipped > 0 && <span className="ml-1 text-xs text-muted">{r.skipped} skipped</span>}
                            </div>
                          ) : (
                            <span className="text-muted">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSyncing(s)}
                              disabled={!google.configured}
                              title={google.configured ? 'Sync now' : 'Connect Google Sheets to sync'}
                              className="px-3 py-1.5 rounded-input text-xs font-medium border border-border text-heading hover:bg-surface inline-flex items-center gap-1.5 disabled:opacity-40"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Sync now
                            </button>
                            <button type="button" className={actionBtn} title="Edit" onClick={() => setEditing(s)}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" className={`${actionBtn} hover:text-danger`} title="Remove" onClick={() => setRemoving(s)}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      </div>

      <UploadLinksModal
        clientId={client.id}
        clientSlug={client.slug}
        inventory={uploading}
        onClose={() => setUploading(null)}
        onDone={() => {
          setUploading(null)
          void load()
        }}
      />
      <ViewLinksModal clientId={client.id} inventory={viewing} onClose={() => setViewing(null)} />
      <SheetSourceModal
        clientId={client.id}
        clientSlug={client.slug}
        open={adding || !!editing}
        editing={editing}
        templates={(templates ?? []).filter((t) => t.enabled)}
        inventories={inventories ?? []}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        onSaved={() => {
          setAdding(false)
          setEditing(null)
          void load()
        }}
      />
      <SyncSheetModal
        clientId={client.id}
        source={syncing}
        serviceEmail={google.clientEmail}
        onClose={() => setSyncing(null)}
        onDone={() => {
          setSyncing(null)
          void load()
        }}
      />
      <ConfirmModal
        isOpen={!!removing}
        title="Remove sheet"
        message={`“${removing?.name ?? ''}” will no longer sync. Articles and links it already brought in stay.`}
        confirmLabel="Remove sheet"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </motion.div>
  )
}
