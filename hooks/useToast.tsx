'use client'

import { create } from 'zustand'
import { motion, AnimatePresence } from 'framer-motion'
import React from 'react'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  severity: ToastSeverity
  title: string
  message?: string
  autoDismiss?: boolean
  dismissAfter?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9)
    set((state) => ({
      toasts: [{ ...toast, id }, ...state.toasts].slice(0, 5),
    }))

    if (toast.autoDismiss !== false) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, toast.dismissAfter || 4000)
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

export function useToast() {
  const { addToast, removeToast } = useToastStore()

  return {
    toast: {
      success: (title: string, message?: string) =>
        addToast({ severity: 'success', title, message }),
      error: (title: string, message?: string) =>
        addToast({ severity: 'error', title, message, autoDismiss: false }),
      warning: (title: string, message?: string) =>
        addToast({ severity: 'warning', title, message, dismissAfter: 8000 }),
      info: (title: string, message?: string) =>
        addToast({ severity: 'info', title, message }),
    },
  }
}

// Toast Component
export function Toast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [progress, setProgress] = React.useState(100)

  const iconMap: Record<ToastSeverity, React.ReactNode> = {
    info: React.createElement(Info, { className: 'w-4 h-4' }),
    success: React.createElement(CheckCircle2, { className: 'w-4 h-4' }),
    warning: React.createElement(AlertTriangle, { className: 'w-4 h-4' }),
    error: React.createElement(AlertCircle, { className: 'w-4 h-4' }),
  }

  const borderMap: Record<ToastSeverity, string> = {
    info: 'border-accent',
    success: 'border-success',
    warning: 'border-warning',
    error: 'border-danger',
  }

  const colorMap: Record<ToastSeverity, string> = {
    info: 'text-accent',
    success: 'text-green-400',
    warning: 'text-orange-400',
    error: 'text-red-400',
  }

  React.useEffect(() => {
    if (toast.autoDismiss === false) return

    const duration = toast.dismissAfter || 4000
    const interval = 50
    const step = 100 / (duration / interval)

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer)
          return 0
        }
        return prev - step
      })
    }, interval)

    return () => clearInterval(timer)
  }, [toast.autoDismiss, toast.dismissAfter])

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="glass-card p-4 relative overflow-hidden"
      style={{ width: '320px' }}
    >
      {/* Colored left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${borderMap[toast.severity]}`} />

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted hover:text-heading transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Content */}
      <div className="flex items-start gap-3 pr-6">
        <div className={`${colorMap[toast.severity]} mt-0.5`}>
          {iconMap[toast.severity]}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-heading">{toast.title}</h4>
          {toast.message && (
            <p className="text-xs text-muted mt-1">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-xs font-medium text-accent hover:text-accent/80 mt-2 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {toast.autoDismiss !== false && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
          <motion.div
            className={`h-full ${borderMap[toast.severity]}`}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.05, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  )
}

// Toast Container
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-h-[400px] overflow-hidden">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}
