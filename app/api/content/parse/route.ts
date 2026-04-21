import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

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
      
      // Use Readability to extract main content
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()

      if (!article || !article.textContent) {
        throw new Error('Could not extract readable content from URL')
      }

      // Convert to HTML for editor
      const content = article.content || article.textContent

      return NextResponse.json({
        content,
        title: article.title || url.split('/').pop() || 'Untitled',
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
