'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Star, RotateCcw, Plus, FileText, Loader2, Sparkles, Undo2, Upload, Wand2, MessageSquareText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import type { ArticleVersionDTO } from '@/lib/pipeline/schemas'

// Article version history (owned by WS workspace). Same modal look as the Analyze-era history, now
// backed by article_versions: the host loads the list and performs create/restore through the API.

const KIND_META: Record<ArticleVersionDTO['kind'], { label: string; icon: typeof Star }> = {
  generated: { label: 'generated', icon: Sparkles },
  manual: { label: 'saved', icon: Star },
  suggestion_applied: { label: 'suggestion', icon: Wand2 },
  restore: { label: 'restore', icon: Undo2 },
  imported: { label: 'imported', icon: Upload },
  revised: { label: 'revised', icon: MessageSquareText },
}

const nf = new Intl.NumberFormat('en-US')

interface VersionHistoryProps {
  versions: ArticleVersionDTO[]
  loading?: boolean
  onClose: () => void
  /** Restores version N into the draft (the server snapshots the current draft first). */
  onRestore: (version: ArticleVersionDTO) => Promise<void> | void
  /** Saves the current draft as a labelled version. */
  onCreate?: (label: string) => Promise<void> | void
}

export function VersionHistory({ versions, loading, onClose, onRestore, onCreate }: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newVersionLabel, setNewVersionLabel] = useState('')
  const [confirming, setConfirming] = useState<ArticleVersionDTO | null>(null)
  const [busy, setBusy] = useState(false)

  const sortedVersions = [...versions].sort((a, b) => b.versionNo - a.versionNo)

  const handleCreateSnapshot = async () => {
    if (!onCreate || busy) return
    setBusy(true)
    try {
      await onCreate(newVersionLabel.trim())
      setShowCreateModal(false)
      setNewVersionLabel('')
    } catch {
      // The host toasts the failure; keep the modal open.
    } finally {
      setBusy(false)
    }
  }

  const confirmRestore = async () => {
    const v = confirming
    setConfirming(null)
    if (!v) return
    setBusy(true)
    try {
      await onRestore(v)
      onClose()
    } catch {
      // toasted by the host
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'var(--color-modal-backdrop)' }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative glass-card w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        onKeyDown={(e) => e.key === 'Escape' && !showCreateModal && !confirming && onClose()}
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 id="version-history-title" className="text-2xl font-display text-heading flex items-center gap-2">
              <Clock className="w-6 h-6 text-accent" />
              Version History
            </h2>
            <p className="text-sm text-muted mt-1">
              <span className="font-mono tabular-nums">{versions.length}</span> version{versions.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onCreate && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                Save version
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading && !versions.length ? (
            <div className="flex items-center justify-center py-12 text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : sortedVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted mb-4" />
              <p className="text-heading font-medium mb-1">No versions yet</p>
              <p className="text-sm text-muted">
                A version is saved on every generation, restore, and whenever you click Save version.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedVersions.map((version, index) => {
                const meta = KIND_META[version.kind]
                const Icon = meta.icon
                return (
                  <motion.div
                    key={version.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 10) * 0.04 }}
                    className={`glass-card p-4 cursor-pointer transition-all ${
                      selectedVersion === version.id
                        ? 'ring-2 ring-accent ring-offset-2 ring-offset-background'
                        : 'hover:bg-surface-hover'
                    }`}
                    onClick={() => setSelectedVersion(version.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono tabular-nums text-xs text-muted">v{version.versionNo}</span>
                          <Icon className={`w-4 h-4 ${version.kind === 'manual' ? 'text-accent fill-accent' : 'text-accent'}`} />
                          <span className="text-sm font-medium text-heading truncate">
                            {version.label || (index === 0 ? 'Latest version' : 'Version')}
                          </span>
                          <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface border border-border">
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                          </span>
                          {version.wordCount !== null && (
                            <span className="font-mono tabular-nums">{nf.format(version.wordCount)} words</span>
                          )}
                          {version.createdByName && <span className="truncate">{version.createdByName}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirming(version)
                        }}
                        disabled={busy}
                        className="ml-4 p-2 text-muted hover:text-accent hover:bg-surface-hover rounded transition-colors disabled:opacity-50"
                        title="Restore this version"
                        aria-label={`Restore version ${version.versionNo}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Save Version Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative glass-card p-6 w-full max-w-md bg-surface"
            >
              <h3 className="text-lg font-display text-heading mb-4">Save version</h3>
              <input
                type="text"
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="Label (optional), e.g. Before client edits"
                maxLength={120}
                className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-3 py-2 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSnapshot()
                  if (e.key === 'Escape') setShowCreateModal(false)
                }}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateSnapshot}
                  disabled={busy}
                  className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!confirming}
        title={`Restore v${confirming?.versionNo ?? ''}?`}
        message="The current draft is saved as a version first, so nothing is lost. Then this version becomes the draft."
        confirmLabel="Restore version"
        confirmVariant="warning"
        onConfirm={confirmRestore}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
