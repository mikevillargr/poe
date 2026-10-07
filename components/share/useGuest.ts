'use client'

import { useCallback, useEffect, useState } from 'react'

// DR-021: who a guest is on shared links: the name (and optional email) they gave, plus a random key that
// lets them edit or delete their own comments. Kept in this browser only.

export interface Guest {
  name: string
  email: string
  key: string
}

const STORE = 'poe-guest'

function newKey() {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function useGuest() {
  const [guest, setGuest] = useState<Guest>({ name: '', email: '', key: '' })
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Guest> | null
      const g = { name: saved?.name ?? '', email: saved?.email ?? '', key: saved?.key && /^[A-Za-z0-9_-]{16,64}$/.test(saved.key) ? saved.key : newKey() }
      setGuest(g)
      localStorage.setItem(STORE, JSON.stringify(g))
    } catch {
      setGuest({ name: '', email: '', key: newKey() })
    }
  }, [])
  const update = useCallback((patch: Partial<Pick<Guest, 'name' | 'email'>>) => {
    setGuest((g) => {
      const next = { ...g, ...patch }
      try {
        localStorage.setItem(STORE, JSON.stringify(next))
      } catch {
        // private mode: remembered for this visit only
      }
      return next
    })
  }, [])
  return { guest, update }
}

/** fetch for public share endpoints, with the guest key header; throws Error(message) on failure. */
export async function guestFetch<T>(url: string, key: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-poe-guest': key } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const d = (data as { error?: string; details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } } | null) ?? {}
    const field = Object.values(d.details?.fieldErrors ?? {}).flat()[0] ?? d.details?.formErrors?.[0]
    throw new Error(field ?? d.error ?? `Something went wrong (${res.status}).`)
  }
  return data as T
}
