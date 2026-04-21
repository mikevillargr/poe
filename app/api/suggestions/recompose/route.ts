import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const TONALITY_PROMPTS: Record<string, string> = {
  professional: 'Rewrite this in a professional, formal tone suitable for business communication.',
  casual: 'Rewrite this in a casual, friendly tone that feels conversational and approachable.',
  concise: 'Rewrite this to be more concise and direct while preserving the core message.',
  detailed: 'Expand this with more detail, examples, and explanation while maintaining clarity.',
  persuasive: 'Rewrite this to be more persuasive and compelling, emphasizing benefits and value.',
  friendly: 'Rewrite this in a warm, friendly tone that builds rapport and connection.',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { suggestionId, originalText, currentSuggestion, tonality, customPrompt } = body

    if (!originalText || !currentSuggestion) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Build the prompt
    let prompt = ''
    if (customPrompt) {
      prompt = `${customPrompt}\n\nOriginal text: "${originalText}"\nCurrent suggestion: "${currentSuggestion}"\n\nProvide only the rewritten text, no explanation.`
    } else if (tonality && TONALITY_PROMPTS[tonality]) {
      prompt = `${TONALITY_PROMPTS[tonality]}\n\nOriginal text: "${originalText}"\nCurrent suggestion: "${currentSuggestion}"\n\nProvide only the rewritten text, no explanation.`
    } else {
      return NextResponse.json(
        { error: 'Must provide either tonality or customPrompt' },
        { status: 400 }
      )
    }

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const newSuggestion = message.content[0].type === 'text' 
      ? message.content[0].text.trim() 
      : currentSuggestion

    return NextResponse.json({
      newSuggestion,
      suggestionId,
    })
  } catch (error) {
    console.error('Recomposition error:', error)
    return NextResponse.json(
      { error: 'Failed to recompose suggestion' },
      { status: 500 }
    )
  }
}
