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
    console.log('[ToastStore] Adding toast:', { id, ...toast })

    set((state) => {
      const newToasts = [{ ...toast, id }, ...state.toasts].slice(0, 5)
      console.log('[ToastStore] Current toasts:', newToasts)
      return { toasts: newToasts }
    })

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      console.log('[ToastStore] Auto-dismissing toast:', id)
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, 4000)
  },
  removeToast: (id) => {
    console.log('[ToastStore] Removing toast:', id)
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

export function useToast() {
  const { addToast, removeToast } = useToastStore()

  return {
    toast: {
      success: (title: string, message?: string) => {
        console.log('[useToast] Calling success toast:', title)
        addToast({ severity: 'success', title, message })
      },
      error: (title: string, message?: string) => {
        console.log('[useToast] Calling error toast:', title)
        addToast({ severity: 'error', title, message })
      },
      warning: (title: string, message?: string) => {
        console.log('[useToast] Calling warning toast:', title)
        addToast({ severity: 'warning', title, message })
      },
      info: (title: string, message?: string) => {
        console.log('[useToast] Calling info toast:', title)
        addToast({ severity: 'info', title, message })
      },
    },
  }
}

// Toast Component
export function Toast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const iconMap: Record<ToastSeverity, React.ReactNode> = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle2 className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
  }

  const borderMap: Record<ToastSeverity, string> = {
    info: 'bg-accent',
    success: 'bg-green-500',
    warning: 'bg-orange-500',
    error: 'bg-red-500',
  }

  const colorMap: Record<ToastSeverity, string> = {
    info: 'text-accent',
    success: 'text-green-500',
    warning: 'text-orange-500',
    error: 'text-red-500',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="glass-card px-6 py-4 shadow-xl relative overflow-hidden min-w-[320px]"
    >
      {/* Colored top bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${borderMap[toast.severity]}`} />

      {/* Content */}
      <div className="flex items-start gap-3">
        <div className={`${colorMap[toast.severity]} flex-shrink-0 mt-0.5`}>
          {iconMap[toast.severity]}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-heading">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm text-muted mt-1">{toast.message}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-muted hover:text-heading transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

// Toast Container - Fixed at top center
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  console.log('[ToastContainer] Rendering, toasts count:', toasts.length)

  if (toasts.length === 0) {
    console.log('[ToastContainer] No toasts to display')
    return null
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-3 w-fit max-w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onDismiss={() => removeToast(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
