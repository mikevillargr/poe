import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleDocsContent, isGoogleDocsUrl } from '@/lib/google-docs'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    if (!isGoogleDocsUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid Google Docs URL' },
        { status: 400 }
      )
    }

    const content = await fetchGoogleDocsContent(url)

    return NextResponse.json({
      content,
      source: 'gdoc',
      sourceRef: url,
    })
  } catch (error: any) {
    console.error('Google Docs fetch error:', error)
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Google Docs content' },
      { status: 500 }
    )
  }
}
