'use client'

import { useCallback, useRef, useState } from 'react'
import { readSSE } from './readSSE'
import type { AIStreamEvent, Citation } from '../types'

export type AIStreamStatus = 'idle' | 'streaming' | 'done' | 'error' | 'aborted'

/**
 * POSTs to a streaming route and accumulates text/citations/searches.
 *   const { start, abort, text, status } = useAIStream()
 *   start(`/api/clients/${id}/articles/${aid}/generate`, { ... })
 */
export function useAIStream(opts: { onEvent?: (ev: AIStreamEvent) => void } = {}) {
  const [status, setStatus] = useState<AIStreamStatus>('idle')
  const [text, setText] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [searches, setSearches] = useState<string[]>([])
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [step, setStep] = useState<{ step: string; label: string } | null>(null)
  const controller = useRef<AbortController | null>(null)

  const start = useCallback(
    async (url: string, body: unknown) => {
      controller.current?.abort()
      const ac = new AbortController()
      controller.current = ac
      setStatus('streaming')
      setText('')
      setCitations([])
      setSearches([])
      setError(null)
      setStep(null)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body ?? {}),
          signal: ac.signal,
        })
        for await (const ev of readSSE(res)) {
          opts.onEvent?.(ev)
          if (ev.type === 'delta') setText((t) => t + ev.text)
          else if (ev.type === 'citation') setCitations((c) => [...c, ev.citation])
          else if (ev.type === 'search') setSearches((s) => [...s, ev.query])
          else if (ev.type === 'step') setStep({ step: ev.step, label: ev.label })
          else if (ev.type === 'reset') setText('') // a multi-step run is retrying: drop the first attempt
          else if (ev.type === 'error') {
            setError({ code: ev.code, message: ev.message })
            setStatus('error')
            return
          }
        }
        setStatus('done')
      } catch (err) {
        if (ac.signal.aborted) setStatus('aborted')
        else {
          setError({ code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Request failed' })
          setStatus('error')
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const abort = useCallback(() => controller.current?.abort(), [])

  return { start, abort, status, text, citations, searches, error, step }
}
