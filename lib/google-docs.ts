/**
 * Google Docs URL utilities
 */

/**
 * Check if a URL is a Google Docs URL
 */
export function isGoogleDocsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === 'docs.google.com' && urlObj.pathname.includes('/document/')
  } catch {
    return false
  }
}

/**
 * Extract document ID from Google Docs URL
 * Example: https://docs.google.com/document/d/DOCUMENT_ID/edit -> DOCUMENT_ID
 */
export function extractGoogleDocsId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const match = urlObj.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Convert Google Docs URL to export URL (plain text)
 * This allows fetching the document content without authentication for public docs
 */
export function getGoogleDocsExportUrl(url: string, format: 'txt' | 'html' | 'docx' = 'txt'): string | null {
  const docId = extractGoogleDocsId(url)
  if (!docId) return null

  const formatMap = {
    txt: 'text/plain',
    html: 'text/html',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }

  return `https://docs.google.com/document/d/${docId}/export?format=${format}`
}

/**
 * Fetch Google Docs content as plain text
 * Note: Only works for publicly accessible documents
 */
export async function fetchGoogleDocsContent(url: string): Promise<string> {
  const exportUrl = getGoogleDocsExportUrl(url, 'txt')
  
  if (!exportUrl) {
    throw new Error('Invalid Google Docs URL')
  }

  try {
    const response = await fetch(exportUrl)
    
    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        throw new Error('Document is not publicly accessible. Please make sure sharing is enabled.')
      }
      throw new Error(`Failed to fetch document: ${response.statusText}`)
    }

    const text = await response.text()
    return text
  } catch (error: any) {
    if (error.message.includes('publicly accessible')) {
      throw error
    }
    throw new Error('Failed to fetch Google Docs content. Make sure the document is publicly accessible.')
  }
}

/**
 * Validate and normalize a URL (supports regular URLs and Google Docs)
 */
export function normalizeUrl(input: string): { url: string; type: 'url' | 'gdoc' } {
  // Add https:// if no protocol
  let url = input.trim()
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url
  }

  const isGDoc = isGoogleDocsUrl(url)
  
  return {
    url,
    type: isGDoc ? 'gdoc' : 'url',
  }
}
