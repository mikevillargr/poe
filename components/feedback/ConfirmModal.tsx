'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  confirmVariant: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const variants = {
    danger: {
      bg: 'bg-danger hover:bg-danger/90',
      text: 'text-white',
    },
    warning: {
      bg: 'bg-warning hover:bg-warning/90',
      text: 'text-white',
    },
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'var(--color-modal-backdrop)' }}
            onClick={onCancel}
          />

          {/* Modal */}
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
            className="relative glass-card w-full max-w-[480px] shadow-2xl flex flex-col bg-surface"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`${confirmVariant === 'danger' ? 'text-danger' : 'text-warning'}`}>
                  {confirmVariant === 'danger' ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <h2 className="text-xl font-display text-heading">{title}</h2>
              </div>
              <button
                onClick={onCancel}
                className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-muted">{message}</p>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border bg-surface flex items-center justify-end gap-3 rounded-b-card">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`${variants[confirmVariant].bg} ${variants[confirmVariant].text} px-6 py-2 rounded-input text-sm font-medium transition-all`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
