import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const parseRequestSchema = z.object({
  type: z.enum(['url', 'docx', 'gdoc']),
  source: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, source } = parseRequestSchema.parse(body)

    // TODO: Implement content parsing (URL fetch, DOCX parsing, Google Docs)
    // For now, return a stub response
    return NextResponse.json({
      ok: true,
      message: 'Content parsing endpoint - Not yet implemented',
      content: '',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }
}
