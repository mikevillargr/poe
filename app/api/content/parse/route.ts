import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

// Simple HTML content extraction using regex (works on Node 18)
function extractMainContent(html: string, url: string): { content: string; title: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = (titleMatch?.[1] || h1Match?.[1] || url.split('/').pop() || 'Untitled').trim()
  
  // Remove unwanted sections
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  
  // Try to extract main content area
  const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                    cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                    cleanHtml.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                    cleanHtml.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  
  const contentHtml = mainMatch?.[1] || cleanHtml
  
  // Extract headings and paragraphs
  const paragraphs: string[] = []
  
  // Extract H1-H6
  const headingRegex = /<(h[1-6])[^>]*>([^<]+)<\/\1>/gi
  let match
  while ((match = headingRegex.exec(contentHtml)) !== null) {
    const tag = match[1].toLowerCase()
    const text = match[2].trim()
    if (text) {
      paragraphs.push(`<${tag}>${text}</${tag}>`)
    }
  }
  
  // Extract paragraphs
  const pRegex = /<p[^>]*>([^<]+)<\/p>/gi
  while ((match = pRegex.exec(contentHtml)) !== null) {
    const text = match[1].trim()
    if (text && text.length > 20) { // Filter out short/empty paragraphs
      paragraphs.push(`<p>${text}</p>`)
    }
  }
  
  // Extract list items
  const liRegex = /<li[^>]*>([^<]+)<\/li>/gi
  while ((match = liRegex.exec(contentHtml)) !== null) {
    const text = match[1].trim()
    if (text) {
      paragraphs.push(`<p>${text}</p>`)
    }
  }
  
  const content = paragraphs.join('\n')
  
  return { content: content || contentHtml, title }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Handle file upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      // Check file type
      if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
        return NextResponse.json(
          { error: 'Only DOCX files are supported' },
          { status: 400 }
        )
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Parse DOCX using mammoth - get HTML for better formatting
      const result = await mammoth.convertToHtml({ buffer })
      const content = result.value

      if (!content || content.trim().length === 0) {
        return NextResponse.json(
          { error: 'Could not extract text from document' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        content,
        source: 'docx',
        filename: file.name,
        title: file.name.replace(/\.(docx?|DOCX?)$/, ''),
      })
    }

    // Handle JSON request (URL or other sources)
    const body = await request.json()
    const { url } = body

    if (url) {
      // Fetch URL content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentBot/1.0)',
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
      }

      const html = await response.text()
      
      // Extract main content using cheerio
      const { content, title } = extractMainContent(html, url)

      if (!content || content.trim().length === 0) {
        throw new Error('Could not extract readable content from URL')
      }

      return NextResponse.json({
        content,
        title,
        source: 'url',
        sourceRef: url,
      })
    }

    return NextResponse.json(
      { error: 'Invalid request - provide file or URL' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Content parse error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse content' },
      { status: 500 }
    )
  }
}
