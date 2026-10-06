'use client'

// DOCX export for an article. Google Docs export runs on the server (DR-014, …/export/google-doc).
import { saveAs } from 'file-saver'
// @ts-expect-error - html-docx-js ships no types
import htmlDocx from 'html-docx-js/dist/html-docx'
import { buildExportDocument } from '@/lib/export/document'

export { buildExportDocument }

function safeFilename(title: string) {
  return (title || 'article').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 120) || 'article'
}

export function exportDocx(title: string, bodyHtml: string) {
  const blob: Blob = htmlDocx.asBlob(buildExportDocument(title, bodyHtml))
  saveAs(blob, `${safeFilename(title)}.docx`)
}
