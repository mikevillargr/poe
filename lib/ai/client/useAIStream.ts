'use client'

import { useCallback, useRef, useState } from 'react'
import { readSSE } from './readSSE'
import type { AIStreamEvent, Citation } from '../types'
import { initialActivity, reduceActivity, type ActivityState } from './activity'

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
  // DR-016: phase, feed (searches, sources, steps), thinking trail and timing for the live activity panel.
  const [activity, setActivity] = useState<ActivityState>(initialActivity)
  const controller = useRef<AbortController | null>(null)

  /**
   * POST starts a run and streams it; GET (`attach`) follows a run that is already going (replaying what it has
   * done so far). A GET answered with 204 means nothing is running here: the stream stays idle and returns false.
   */
  const consume = useCallback(
    async (url: string, init: { method: 'POST' | 'GET'; body?: unknown }): Promise<boolean> => {
      controller.current?.abort()
      const ac = new AbortController()
      controller.current = ac
      setStatus('streaming')
      setText('')
      setCitations([])
      setSearches([])
      setError(null)
      setStep(null)
      setActivity(initialActivity())
      try {
        const res = await fetch(url, {
          method: init.method,
          headers: { 'Content-Type': 'application/json' },
          ...(init.method === 'POST' ? { body: JSON.stringify(init.body ?? {}) } : {}),
          signal: ac.signal,
        })
        if (init.method === 'GET' && res.status === 204) {
          setStatus('idle')
          return false
        }
        for await (const ev of readSSE(res)) {
          opts.onEvent?.(ev)
          const now = Date.now()
          setActivity((a) => reduceActivity(a, ev, now))
          if (ev.type === 'delta') setText((t) => t + ev.text)
          else if (ev.type === 'citation') setCitations((c) => [...c, ev.citation])
          else if (ev.type === 'search') setSearches((s) => [...s, ev.query])
          else if (ev.type === 'step') setStep({ step: ev.step, label: ev.label })
          else if (ev.type === 'reset') setText('') // a multi-step run is retrying: drop the first attempt
          else if (ev.type === 'error') {
            setError({ code: ev.code, message: ev.message })
            setStatus('error')
            return true
          }
        }
        setStatus('done')
        return true
      } catch (err) {
        if (ac.signal.aborted) setStatus('aborted')
        else {
          setError({ code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Request failed' })
          setStatus('error')
        }
        return true
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const start = useCallback((url: string, body: unknown) => consume(url, { method: 'POST', body }), [consume])
  const attach = useCallback((url: string) => consume(url, { method: 'GET' }), [consume])
  const abort = useCallback(() => controller.current?.abort(), [])

  return { start, attach, abort, status, text, citations, searches, error, step, activity }
}
