import { NextRequest, NextResponse } from 'next/server'
import { 
  createIngestJob, 
  getIngestJob, 
  updateIngestJob,
  getActiveIngestJob,
  IngestJob 
} from '@/lib/storage/ingest-jobs'

// GET - Check status of an ingest job or get active job
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('id')

  if (jobId) {
    const job = getIngestJob(jobId)
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }
    return NextResponse.json({ job })
  }

  // Return active job if no ID specified
  const activeJob = getActiveIngestJob()
  return NextResponse.json({ job: activeJob || null })
}

// POST - Create a new ingest job and start processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { inputMethod, fileName, url, content, apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 400 }
      )
    }

    // Create job
    const job = createIngestJob(inputMethod, fileName, url)

    // Start processing in background
    processIngestJob(job.id, content, apiKey).catch(error => {
      console.error('Ingest processing error:', error)
      updateIngestJob(job.id, {
        status: 'error',
        error: error.message || 'Processing failed',
      })
    })

    return NextResponse.json({ job })

  } catch (error: any) {
    console.error('Ingest job creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create ingest job' },
      { status: 500 }
    )
  }
}

// Background processing function
async function processIngestJob(jobId: string, content: string, apiKey: string) {
  // Update to extracting step
  updateIngestJob(jobId, { step: 'extracting' })

  try {
    // Call extraction API
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/guidelines/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, apiKey }),
    })

    if (!response.ok) {
      throw new Error('Extraction failed')
    }

    const data = await response.json()

    // Update job with results
    updateIngestJob(jobId, {
      status: 'complete',
      step: 'complete',
      extractedHeuristics: data.heuristics || [],
      discoveredDimensions: data.dimensions || [],
      completedAt: new Date().toISOString(),
    })

  } catch (error: any) {
    updateIngestJob(jobId, {
      status: 'error',
      error: error.message || 'Extraction failed',
    })
    throw error
  }
}
