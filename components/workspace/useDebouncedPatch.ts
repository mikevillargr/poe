'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/fetch'

/**
 * Debounced PATCH for autosaving fields. `schedule({ field: value })` merges into the pending
 * patch and sends it after `delay` ms; `flush()` sends now (call it before generate/research so
 * the server sees the latest edits). Failures toast via apiFetch and reject `flush()`.
 */
export function useDebouncedPatch<T extends object, R>(opts: {
  url: string
  delay?: number
  errorTitle: string
  onSaved?: (result: R) => void
}) {
  const { url, delay = 800, errorTitle } = opts
  const pending = useRef<Partial<T> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = useRef<Promise<void> | null>(null)
  const onSavedRef = useRef(opts.onSaved)
  onSavedRef.current = opts.onSaved
  const [saving, setSaving] = useState(false)

  const send = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (inflight.current) await inflight.current.catch(() => {})
    const body = pending.current
    pending.current = null
    if (!body) return
    setSaving(true)
    const p = apiFetch<R>(url, { method: 'PATCH', body, errorTitle })
      .then((r) => onSavedRef.current?.(r))
      .finally(() => {
        inflight.current = null
        setSaving(false)
      })
    inflight.current = p
    return p
  }, [url, errorTitle])

  const schedule = useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...(pending.current ?? {}), ...patch }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void send().catch(() => {}), delay)
    },
    [delay, send],
  )

  const flush = useCallback(async () => {
    if (pending.current) await send()
    else if (inflight.current) await inflight.current
  }, [send])

  // Best effort on unmount / navigation: send what's pending.
  useEffect(
    () => () => {
      if (pending.current) void send().catch(() => {})
    },
    [send],
  )

  return { schedule, flush, saving }
}
