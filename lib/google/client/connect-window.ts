'use client'

// DR-014/018: the small Google consent window (Drive export + read-only Sheets) and its result. The callback page
// posts { source: 'poe-drive', ok, email?, message? } back to the window that opened it.

export interface GoogleConnectResult {
  ok: boolean
  email?: string
  message?: string
}

/** Opens the consent window centred on this one; null when the browser blocked it. Call straight from a click. */
export function openGoogleConnectWindow(): Window | null {
  const w = 520
  const h = 640
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
  return window.open('/api/google/drive/connect', 'poe-drive-connect', `popup,width=${w},height=${h},left=${left},top=${top}`)
}

/** Resolves with the consent result, or `{ ok: false }` if the window is closed without finishing. */
export function waitForGoogleConnect(win: Window): Promise<GoogleConnectResult> {
  return new Promise((resolve) => {
    let settled = false
    const done = (r: GoogleConnectResult) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      clearInterval(poll)
      resolve(r)
    }
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || (e.data as { source?: string })?.source !== 'poe-drive') return
      const d = e.data as GoogleConnectResult
      done({ ok: !!d.ok, email: d.email, message: d.message })
    }
    window.addEventListener('message', onMessage)
    // Closed without a result (cancelled): give the message a moment to arrive first.
    const poll = setInterval(() => {
      if (!win.closed) return
      clearInterval(poll)
      setTimeout(() => done({ ok: false, message: 'The Google window was closed.' }), 600)
    }, 500)
  })
}
