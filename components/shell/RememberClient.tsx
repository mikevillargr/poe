'use client'

import { useEffect } from 'react'
import { LAST_CLIENT_COOKIE } from '@/lib/nav'

// Remembers the last-visited client so `/` can return to it. Not used for authorization.
export function RememberClient({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `${LAST_CLIENT_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`
  }, [slug])
  return null
}
