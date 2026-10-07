import { z } from 'zod'
import { withRoute } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { ApiError } from '@/lib/api/errors'
import { driveStatus, createGoogleSheet } from '@/lib/google/drive'
import { eachLimit, googleDocFor, loadExportArticles, poeLink } from '@/lib/exports/bulk'
import { exportFilename, toCsv, toXlsx } from '@/lib/exports/table'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const bodySchema = z
  .object({
    articleIds: z.array(z.string().uuid()).min(1).max(200),
    poeLinks: z.boolean(),
    docs: z.boolean(),
    /** Make each Google Doc viewable by anyone with the link. */
    linkSharing: z.boolean().default(true),
    format: z.enum(['sheet', 'xlsx', 'csv']),
  })
  .refine((b) => b.poeLinks || b.docs, { message: 'Choose Poe links, Google Docs, or both', path: ['poeLinks'] })

export type ExportEvent =
  | { type: 'start'; total: number }
  | { type: 'item'; articleId: string; title: string; state: 'done' | 'reused' | 'skipped' | 'failed'; message?: string }
  | { type: 'done'; sheetUrl?: string; filename?: string; mime?: string; base64?: string }
  | { type: 'error'; message: string; code?: string }

// POST { articleIds, poeLinks, docs, linkSharing?, format } → NDJSON stream of ExportEvent (DR-021).
// Google Docs are made three at a time with the person's own Drive connection, reusing a Doc while the draft
// is unchanged. The result is a Google Sheet (link) or an XLSX/CSV file (base64).
export const POST = withRoute<{ clientId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const b = bodySchema.parse(await req.json())
  if ((b.docs || b.format === 'sheet') && !(await driveStatus(user.id)).connected) {
    throw new ApiError(409, 'DRIVE_NOT_CONNECTED', 'Connect Google to export Google Docs or a Google Sheet.')
  }
  const origin = (process.env.AUTH_URL || req.nextUrl.origin).replace(/\/+$/, '')
  const { clientName, items } = await loadExportArticles(client.id, b.articleIds)

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ExportEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + '\n'))
      try {
        send({ type: 'start', total: items.length })
        await eachLimit(items, 3, async (a) => {
          try {
            if (b.poeLinks) a.row.poeLink = await poeLink(client.id, a.id, user.id, origin)
            let state: 'done' | 'reused' | 'skipped' = 'done'
            let message: string | undefined
            if (b.docs) {
              const doc = await googleDocFor(client.id, a, user.id, { linkSharing: b.linkSharing })
              if (doc) {
                a.row.docLink = doc.url
                if (doc.reused) state = 'reused'
                if (doc.shared === false) message = 'Link sharing was blocked by Google; only you can open this Doc.'
              } else {
                state = b.poeLinks ? 'done' : 'skipped'
                message = 'No draft yet, so no Google Doc.'
              }
            }
            send({ type: 'item', articleId: a.id, title: a.title, state, message })
          } catch (err) {
            send({ type: 'item', articleId: a.id, title: a.title, state: 'failed', message: err instanceof Error ? err.message : 'Failed' })
          }
        })
        const cols = { poeLinks: b.poeLinks, docs: b.docs }
        const rows = items.map((a) => a.row)
        if (b.format === 'sheet') {
          const sheetUrl = await createGoogleSheet(user.id, `${clientName} articles · ${new Date().toISOString().slice(0, 10)}`, toCsv(rows, cols))
          send({ type: 'done', sheetUrl })
        } else if (b.format === 'xlsx') {
          send({
            type: 'done',
            filename: exportFilename(clientName, 'xlsx'),
            mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            base64: toXlsx(rows, cols).toString('base64'),
          })
        } else {
          send({ type: 'done', filename: exportFilename(clientName, 'csv'), mime: 'text/csv', base64: Buffer.from('﻿' + toCsv(rows, cols)).toString('base64') })
        }
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined
        send({ type: 'error', message: err instanceof Error ? err.message : 'Export failed', code })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } })
})
