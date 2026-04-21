'use client'

import React from 'react'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'

export default function SettingsPage() {
  return (
    <PageErrorBoundary>
      <div className="p-10 max-w-4xl mx-auto">
        <h1 className="text-3xl font-display text-heading mb-6">Settings</h1>
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted text-lg">Settings configuration coming soon.</p>
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  )
}
