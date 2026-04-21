import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Create client with explicit base URL to ignore env vars
    const anthropic = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com',
      dangerouslyAllowBrowser: true,
    })

    // Make a minimal API call to validate the key
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'hi' }],
    })

    if (response.content && response.content.length > 0) {
      return NextResponse.json({
        ok: true,
        message: 'API key is valid',
        model: response.model
      })
    }

    return NextResponse.json(
      { error: 'API key validation failed - no content returned' },
      { status: 401 }
    )
  } catch (error: any) {
    console.error('API key test error:', error)

    // Handle Anthropic API errors
    if (error?.status) {
      const status = error.status
      const errorText = error.error?.message || error.message || ''

      console.error('Anthropic API error:', { status, errorText })

      if (status === 401 || status === 403) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your Anthropic API key and try again.' },
          { status: 401 }
        )
      }

      if (status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 }
        )
      }

      if (status === 400) {
        return NextResponse.json(
          { error: 'Invalid request. Please check your API key format.' },
          { status: 400 }
        )
      }

      if (status >= 500) {
        return NextResponse.json(
          { error: 'Anthropic API is experiencing issues. Please try again later.' },
          { status: 502 }
        )
      }
    }

    // Handle network/connection errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Could not connect to Anthropic. Please check your internet connection.' },
        { status: 500 }
      )
    }

    // Generic error with more details for debugging
    const errorMessage = error?.message || String(error)
    console.error('Unhandled API test error:', errorMessage)

    return NextResponse.json(
      {
        error: 'Unable to validate API key',
        details: 'Please check your internet connection and API key format'
      },
      { status: 500 }
    )
  }
}
