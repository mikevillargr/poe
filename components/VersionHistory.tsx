import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Star, RotateCcw, Plus, FileText } from 'lucide-react'
import { useVersionStore, DocumentVersion } from '@/stores/useVersionStore'
import { formatDistanceToNow } from 'date-fns'

interface VersionHistoryProps {
  onClose: () => void
  onRestore: (version: DocumentVersion) => void
}

export function VersionHistory({ onClose, onRestore }: VersionHistoryProps) {
  const versions = useVersionStore((state) => state.versions)
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newVersionLabel, setNewVersionLabel] = useState('')

  const sortedVersions = [...versions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const handleRestore = (version: DocumentVersion) => {
    if (confirm(`Restore to version "${version.label || formatDistanceToNow(new Date(version.timestamp), { addSuffix: true })}"?`)) {
      onRestore(version)
      onClose()
    }
  }

  const handleCreateSnapshot = () => {
    if (!newVersionLabel.trim()) return
    
    // This will be called from the parent component with current editor content
    // For now, just close the modal
    setShowCreateModal(false)
    setNewVersionLabel('')
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
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 300,
            damping: 30,
          },
        }}
        exit={{
          opacity: 0,
          scale: 0.95,
          y: 20,
        }}
        className="relative glass-card w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] bg-surface"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-display text-heading flex items-center gap-2">
              <Clock className="w-6 h-6 text-accent" />
              Document History
            </h2>
            <p className="text-sm text-muted mt-1">
              {versions.length} version{versions.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Snapshot
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {sortedVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted mb-4" />
              <p className="text-heading font-medium mb-1">No versions yet</p>
              <p className="text-sm text-muted">
                Versions are automatically saved as you work
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedVersions.map((version, index) => (
                <motion.div
                  key={version.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`glass-card p-4 cursor-pointer transition-all ${
                    selectedVersion === version.id
                      ? 'ring-2 ring-accent ring-offset-2 ring-offset-background'
                      : 'hover:bg-surface-hover'
                  }`}
                  onClick={() => setSelectedVersion(version.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {!version.isAutoSave && (
                          <Star className="w-4 h-4 text-accent fill-accent" />
                        )}
                        <span className="text-sm font-medium text-heading">
                          {version.label || (
                            index === 0 ? 'Current version' : 'Auto-save'
                          )}
                        </span>
                        {version.isAutoSave && (
                          <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-surface border border-border">
                            auto
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(version.timestamp), { addSuffix: true })}
                        </span>
                        <span>{version.wordCount} words</span>
                        <span>{version.characterCount} chars</span>
                      </div>
                    </div>
                    
                    {index !== 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestore(version)
                        }}
                        className="ml-4 p-2 text-muted hover:text-accent hover:bg-surface-hover rounded transition-colors"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Create Snapshot Modal */}
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
              className="relative glass-card p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-display text-heading mb-4">Create Snapshot</h3>
              <input
                type="text"
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="e.g., Before AI edits, Final draft..."
                className="w-full bg-surface border border-border rounded-input px-3 py-2 text-sm text-body focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSnapshot()
                  if (e.key === 'Escape') setShowCreateModal(false)
                }}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSnapshot}
                  disabled={!newVersionLabel.trim()}
                  className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
