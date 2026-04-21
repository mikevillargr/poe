import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const ingestRequestSchema = z.object({
  content: z.string().min(1),
  filename: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, filename } = ingestRequestSchema.parse(body)

    // TODO: Implement AI-powered guideline ingestion
    // For now, return a stub response
    return NextResponse.json({
      ok: true,
      message: 'Guideline ingestion endpoint - Not yet implemented',
      heuristics: [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }
}
