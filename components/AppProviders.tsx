'use client'

import React from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastContainer } from '@/hooks/useToast'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ToastContainer />
    </ThemeProvider>
  )
}
