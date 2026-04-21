'use client'

import React from 'react'
import { AlertCircle, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  onDismiss?: () => void
}

export function ErrorBanner({ message, action, onDismiss }: ErrorBannerProps) {
  return (
    <div className="w-full bg-danger/10 border-b border-danger/30 text-red-400 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{message}</span>
        {action && (
          <>
            <span className="text-muted">·</span>
            {action.href ? (
              <a href={action.href} className="text-sm font-medium hover:underline">
                {action.label}
              </a>
            ) : (
              <button
                onClick={action.onClick}
                className="text-sm font-medium hover:underline"
              >
                {action.label}
              </button>
            )}
          </>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-muted hover:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
