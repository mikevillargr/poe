'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { AuthCard, GoogleIcon } from '@/components/auth/AuthCard'

const ERRORS: Record<string, string> = {
  AccessDenied: 'Poe is only available to @growth-rocket.com Google accounts.',
  Configuration: 'Sign-in is not configured correctly. Contact Mike.',
}

export function LoginForm({ callbackUrl, error }: { callbackUrl: string; error?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const message = error ? ERRORS[error] ?? 'Sign-in failed. Please try again.' : null

  return (
    <AuthCard
      title="Welcome to Poe"
      subtitle="Sign in to continue"
      footer={<p>Use your @growth-rocket.com Google account.</p>}
    >
      <div className="space-y-6">
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="p-3 bg-danger/10 border border-danger/20 rounded-input text-danger text-sm"
          >
            {message}
          </motion.div>
        )}

        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            setIsLoading(true)
            signIn('google', { redirectTo: callbackUrl })
          }}
          className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-input transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <span className="bg-white rounded-full p-1 flex">
            <GoogleIcon className="w-4 h-4" />
          </span>
          {isLoading ? 'Redirecting to Google…' : 'Continue with Google'}
        </button>
      </div>
    </AuthCard>
  )
}
