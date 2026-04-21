import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // TODO: Fetch guideline by ID
  return NextResponse.json({
    ok: true,
    message: 'Get guideline endpoint - Not yet implemented',
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()

    // TODO: Update guideline
    return NextResponse.json({
      ok: true,
      message: 'Update guideline endpoint - Not yet implemented',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_REQUEST' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // TODO: Delete guideline
  return NextResponse.json({
    ok: true,
    message: 'Delete guideline endpoint - Not yet implemented',
  })
}
