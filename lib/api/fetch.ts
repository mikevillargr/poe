'use client'

import { useToastStore } from '@/hooks/useToast'

// Client-side API helper. Every failure fires an error toast (CLAUDE.md: never fail silently)
// unless `silent` is set, then throws ApiFetchError so callers can also show inline errors.

export class ApiFetchError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { fieldErrors?: Record<string, string[]>; [k: string]: unknown },
  ) {
    super(message)
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON-serialized automatically; FormData is sent as-is. */
  body?: unknown
  /** Title for the error toast, e.g. "Couldn’t save guideline". */
  errorTitle?: string
  /** Don't toast (the caller renders the error inline). */
  silent?: boolean
}

export async function apiFetch<T>(url: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { body, errorTitle, silent, headers, ...init } = opts
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: isForm || body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    })
  } catch {
    const err = new ApiFetchError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
    if (!silent) notify(errorTitle, err)
    throw err
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
  }
  if (res.status === 403) {
    const peek = await res.clone().json().catch(() => null)
    if (peek?.code === 'ACCOUNT_PENDING' || peek?.code === 'ACCOUNT_DISABLED') window.location.href = '/pending'
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new ApiFetchError(
      res.status,
      data?.code ?? `HTTP_${res.status}`,
      data?.error ?? `Request failed (${res.status}).`,
      data?.details,
    )
    if (!silent) notify(errorTitle, err)
    throw err
  }
  return data as T
}

function notify(title: string | undefined, err: ApiFetchError) {
  useToastStore.getState().addToast({ severity: 'error', title: title ?? 'Something went wrong', message: err.message })
}
