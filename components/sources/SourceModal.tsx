'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// The spring modal used across Poe (New Article, Add client), as a shell for the Sources dialogs.
export function SourceModal({
  open,
  title,
  icon: Icon,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean
  title: string
  icon: LucideIcon
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'var(--color-modal-backdrop)' }}
            onClick={onClose}
          />
          <motion.div
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative glass-card w-full ${wide ? 'max-w-[720px]' : 'max-w-[560px]'} max-h-[90vh] shadow-2xl flex flex-col bg-surface`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="p-6 border-b border-border flex items-start justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="w-5 h-5 text-accent shrink-0" />
                <h2 className="text-xl font-display text-heading truncate">{title}</h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">{children}</div>
            {footer && <div className="p-6 border-t border-border bg-surface flex items-center justify-end gap-3 rounded-b-card shrink-0">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export const fieldCls =
  'w-full px-3 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
export const labelCls = 'block text-sm font-medium text-heading mb-1.5'
export const primaryBtn =
  'bg-accent hover:bg-accent/90 text-white px-5 py-2 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
export const ghostBtn = 'px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors'
