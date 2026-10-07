'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/fetch'

export interface RunEstimates {
  research: number | null
  generation: number | null
}

// DR-016: typical run times of the configured models, fetched once per page load and shared.
let cached: Promise<RunEstimates> | null = null

export function useRunEstimates(): RunEstimates {
  const [value, setValue] = useState<RunEstimates>({ research: null, generation: null })
  useEffect(() => {
    cached ??= apiFetch<RunEstimates>('/api/ai/estimates', { silent: true }).catch(() => {
      cached = null
      return { research: null, generation: null }
    })
    let alive = true
    cached.then((v) => alive && setValue(v))
    return () => {
      alive = false
    }
  }, [])
  return value
}
