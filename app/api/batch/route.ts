import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const batchRequestSchema = z.object({
  items: z.array(
    z.object({
      type: z.enum(['url', 'docx', 'csv_row']),
      ref: z.string(),
      title: z.string().optional(),
    })
  ),
  apiKey: z.string().min(1),
})

// In-memory batch job storage
const batchJobs = new Map<string, any>()

// Smart HTML content extraction
function extractTextFromHTML(html: string): string {
  // Remove script tags and their content
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
  
  // Remove style tags and their content
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, ' ')
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
  
  // Replace multiple whitespace with single space
  text = text.replace(/\s+/g, ' ')
  
  // Trim and return
  return text.trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, apiKey } = batchRequestSchema.parse(body)

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items to process' },
        { status: 400 }
      )
    }

    // Create batch job
    const batchJobId = `batch-${Date.now()}`
    const batchJob = {
      id: batchJobId,
      status: 'processing',
      total: items.length,
      completed: 0,
      failed: 0,
      results: [],
      createdAt: new Date().toISOString(),
    }

    batchJobs.set(batchJobId, batchJob)

    // Process items asynchronously
    processBatchItems(batchJobId, items, apiKey).catch(console.error)

    return NextResponse.json({
      success: true,
      batchJobId,
      total: items.length,
      message: 'Batch processing started',
    })

  } catch (error: any) {
    console.error('Batch error:', error)
    return NextResponse.json(
      { error: error.message || 'Invalid request' },
      { status: 400 }
    )
  }
}

// GET endpoint to check batch status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const batchJobId = searchParams.get('id')

  if (!batchJobId) {
    return NextResponse.json(
      { error: 'Batch job ID required' },
      { status: 400 }
    )
  }

  const batchJob = batchJobs.get(batchJobId)
  
  if (!batchJob) {
    return NextResponse.json(
      { error: 'Batch job not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(batchJob)
}

// Process batch items
async function processBatchItems(batchJobId: string, items: any[], apiKey: string) {
  const batchJob = batchJobs.get(batchJobId)
  if (!batchJob) return

  for (const item of items) {
    try {
      // Fetch and parse content using the same API as one-off URL fetch
      let content = ''
      let title = item.title || item.ref
      
      if (item.type === 'url') {
        try {
          const parseResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/content/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.ref }),
          })
          
          if (parseResponse.ok) {
            const parseData = await parseResponse.json()
            content = parseData.content || parseData.text || ''
            title = parseData.title || item.ref
            console.log(`Parsed ${content.length} characters from ${item.ref}, title: ${title}`)
          } else {
            throw new Error('Failed to parse URL')
          }
        } catch (parseError) {
          console.error('Parse error, falling back to direct fetch:', parseError)
          // Fallback to direct fetch if parse fails
          const response = await fetch(item.ref)
          const html = await response.text()
          content = extractTextFromHTML(html)
          
          // Try to extract title from HTML
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim()
            // Decode HTML entities in title
            title = title
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
          }
          console.log(`Fallback fetch: ${content.length} characters, title: ${title}`)
        }
      } else {
        // For other types, use ref as content for now
        content = item.ref
      }

      // Create document first with 'scoring' status
      let documentId: string | undefined
      try {
        const docResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            source: item.type,
            sourceRef: item.ref,
            status: 'scoring',
          }),
        })
        
        if (docResponse.ok) {
          const { document } = await docResponse.json()
          documentId = document.id
          console.log(`Created document ${documentId} for ${item.ref}, status: scoring`)
        }
      } catch (docError) {
        console.error('Failed to create document:', docError)
      }

      // Score the content
      const scoreResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          source: item.type,
          sourceRef: item.ref,
          documentId,
          apiKey,
        }),
      })

      let result
      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json()
        result = {
          id: documentId || `result-${Date.now()}-${batchJob.completed}`,
          documentId,
          title,
          type: item.type,
          ref: item.ref,
          status: 'complete',
          score: scoreData.overallScore,
          dimensionScores: scoreData.dimensionScores,
          suggestions: scoreData.suggestions,
        }
        batchJob.completed++
      } else {
        result = {
          id: documentId || `result-${Date.now()}-${batchJob.failed}`,
          documentId,
          title,
          type: item.type,
          ref: item.ref,
          status: 'error',
          error: 'Scoring failed',
        }
        batchJob.failed++
      }

      batchJob.results.push(result)
      
    } catch (error: any) {
      console.error('Item processing error:', error)
      batchJob.failed++
      batchJob.results.push({
        id: `result-${Date.now()}-${batchJob.failed}`,
        documentId: undefined,
        title: item.title || item.ref,
        type: item.type,
        ref: item.ref,
        status: 'error',
        error: error.message || 'Processing failed',
      })
    }
  }

  // Mark batch as complete
  batchJob.status = 'complete'
  batchJob.completedAt = new Date().toISOString()
}
