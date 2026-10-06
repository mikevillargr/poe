// The standalone HTML document used for DOCX and Google Docs exports (pure, shared by client and server).

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A standalone HTML document with the export styles the Analyze editor used. */
export function buildExportDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Document')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
    p { margin: 0 0 1em 0; line-height: 1.6; }
    h1 { margin: 1.5em 0 0.5em 0; line-height: 1.2; }
    h2 { margin: 1.3em 0 0.5em 0; line-height: 1.3; }
    h3 { margin: 1.2em 0 0.5em 0; line-height: 1.4; }
    ul, ol { margin: 0.5em 0 1em 0; padding-left: 2em; }
    li { margin: 0.3em 0; line-height: 1.6; }
    /* Tables, styled like the n8n-era Google Docs formatter: bold grey header, light borders, padded cells. */
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #cccccc; padding: 8px 12px; vertical-align: top; }
    th { background: #f0f0f0; font-weight: bold; text-align: center; }
    th p, td p { margin: 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}
