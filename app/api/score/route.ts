import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const scoreRequestSchema = z.object({
  content: z.string().min(1),
  source: z.enum(['url', 'docx', 'gdoc', 'paste', 'csv_batch']),
  sourceRef: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, source, sourceRef } = scoreRequestSchema.parse(body)

    // TODO: Implement streaming SSE scoring with Anthropic Claude
    // For now, return a stub response
    return NextResponse.json({
      ok: true,
      message: 'Scoring endpoint - Not yet implemented',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }
}
