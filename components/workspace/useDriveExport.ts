'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { useToast, useToastStore } from '@/hooks/useToast'

// DR-014: Google Docs export with a once-per-person Drive connection. Exporting opens a tab on the click
// (browsers allow one new window per click) that turns into the new Doc once the server has created it.

export interface DriveState {
  connected: boolean
  email: string | null
}

const WAITING_TITLE = 'Waiting for Google…'

const PENDING_PAGE = `<!doctype html><meta charset="utf-8"><title>Creating your Google Doc…</title>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#4a4a4a;background:#fafaf8">
<p>Creating your Google Doc…</p></body>`

export function useDriveExport(opts: { exportUrl: string; initial: DriveState; getHtml: () => string }) {
  const { toast } = useToast()
  const [drive, setDrive] = useState<DriveState>(opts.initial)
  const [busy, setBusy] = useState(false)
  const getHtml = useRef(opts.getHtml)
  getHtml.current = opts.getHtml
  const exportRef = useRef<() => void>(() => {})

  // The connect window reports back with postMessage (same origin only).
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || (e.data as { source?: string })?.source !== 'poe-drive') return
      const data = e.data as { ok: boolean; email?: string; message?: string }
      const store = useToastStore.getState()
      store.toasts.filter((t) => t.title === WAITING_TITLE).forEach((t) => store.removeToast(t.id))
      if (data.ok) {
        setDrive({ connected: true, email: data.email ?? null })
        // A fresh click is needed to open the Doc's tab, hence the button.
        toast.success('Google Drive connected', data.email ? `As ${data.email}.` : undefined, {
          dismissAfter: 20000,
          action: { label: 'Export now', onClick: () => exportRef.current() },
        })
      } else {
        toast.error('Couldn’t connect Google Drive', data.message)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [toast])

  const connect = useCallback(() => {
    const w = 520
    const h = 640
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
    const win = window.open('/api/google/drive/connect', 'poe-drive-connect', `popup,width=${w},height=${h},left=${left},top=${top}`)
    if (!win) {
      toast.error('The browser blocked the Google window', 'Allow pop-ups for this site, then try again.')
      return
    }
    toast.info(WAITING_TITLE, 'Finish connecting Google Drive in the window that opened.')
  }, [toast])

  const exportDoc = useCallback(async () => {
    if (!drive.connected) {
      connect()
      return
    }
    // Open the tab now, while we still have the click; it becomes the Doc when the upload finishes.
    const tab = window.open('', '_blank')
    if (tab) {
      tab.document.write(PENDING_PAGE)
      tab.document.close()
    }
    setBusy(true)
    try {
      const { url } = await apiFetch<{ url: string }>(opts.exportUrl, { method: 'POST', body: { html: getHtml.current() }, silent: true })
      if (tab && !tab.closed) {
        tab.opener = null
        tab.location.replace(url)
      }
      toast.success('Saved to Google Docs', tab ? 'Opened in a new tab.' : 'The article is in your Google Drive.', {
        dismissAfter: 15000,
        action: { label: 'Open document', onClick: () => window.open(url, '_blank', 'noopener') },
      })
    } catch (err) {
      tab?.close()
      if (err instanceof ApiFetchError && err.code === 'DRIVE_NOT_CONNECTED') {
        setDrive({ connected: false, email: null })
        toast.error('Connect Google Drive again', 'Google no longer allows Poe to create files for you. Choose Export to Google Docs to reconnect.')
      } else {
        toast.error('Google Docs export failed', err instanceof Error ? err.message : 'Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }, [drive.connected, connect, opts.exportUrl, toast])
  exportRef.current = () => void exportDoc()

  const disconnect = useCallback(async () => {
    try {
      await apiFetch('/api/google/drive', { method: 'DELETE', errorTitle: 'Couldn’t disconnect Google Drive' })
      setDrive({ connected: false, email: null })
      toast.success('Google Drive disconnected')
    } catch {
      // toasted
    }
  }, [toast])

  return { drive, busy, exportDoc, disconnect }
}
