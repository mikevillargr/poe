import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as cheerio from 'cheerio'

// Extract clean content from HTML
function extractMainContent(html: string, url: string): { content: string; title: string } {
  const $ = cheerio.load(html)
  
  // Extract title
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                url.split('/').pop() || 
                'Untitled'
  
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, iframe, noscript').remove()
  $('.nav, .navigation, .menu, .sidebar, .footer, .header, .advertisement, .ad').remove()
  
  // Try to find main content area
  let mainContent = $('main').html() || 
                    $('article').html() || 
                    $('.content').html() ||
                    $('.post-content').html() ||
                    $('.entry-content').html() ||
                    $('body').html() || 
                    ''
  
  // Load the main content into cheerio for further processing
  const $main = cheerio.load(mainContent)
  
  // Convert to clean HTML with proper paragraph structure
  const paragraphs: string[] = []
  
  // Extract headings and paragraphs
  $main('h1, h2, h3, h4, h5, h6, p, li').each((_, elem) => {
    const text = $main(elem).text().trim()
    if (text && text.length > 0) {
      const tagName = elem.tagName.toLowerCase()
      if (tagName.startsWith('h')) {
        paragraphs.push(`<${tagName}>${text}</${tagName}>`)
      } else {
        paragraphs.push(`<p>${text}</p>`)
      }
    }
  })
  
  const content = paragraphs.join('\n')
  
  return { content, title }
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
