import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const batchRequestSchema = z.object({
  items: z.array(
    z.object({
      type: z.enum(['url', 'docx', 'csv_row']),
      ref: z.string(),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = batchRequestSchema.parse(body)

    // TODO: Implement batch processing
    // For now, return a stub response
    return NextResponse.json({
      ok: true,
      message: 'Batch processing endpoint - Not yet implemented',
      batchJobId: 'stub-job-id',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }
}
