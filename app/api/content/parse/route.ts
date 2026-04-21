import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'

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

      // Parse DOCX using mammoth
      const result = await mammoth.extractRawText({ buffer })
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
      })
    }

    // Handle JSON request (URL or other sources)
    const body = await request.json()
    const { url } = body

    if (url) {
      // Simple URL content fetch
      const response = await fetch(url)
      const html = await response.text()
      
      // Basic HTML to text conversion (strip tags)
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

      return NextResponse.json({
        content: text,
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
