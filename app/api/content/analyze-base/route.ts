import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const BASE_ANALYSIS_PROMPT = `You are an expert editor analyzing content for grammar, readability, and writing quality issues.

Analyze the provided text and identify issues in these categories:

**Grammar & Mechanics**
- Spelling errors
- Grammar mistakes (subject-verb agreement, tense consistency, etc.)
- Punctuation errors
- Sentence fragments or run-ons

**Readability**
- Overly complex sentences (20+ words)
- Passive voice overuse
- Unclear pronouns or ambiguous references
- Jargon without explanation
- Paragraphs that are too long (5+ sentences)

**Style & Clarity**
- Redundant phrases ("past history", "future plans")
- Weak verbs ("is", "has", "there is/are")
- Wordiness that could be simplified
- Inconsistent tone or voice

For each issue found, provide:

1. **type**: One of: "grammar", "readability", "style", "clarity"
2. **severity**: "high" (breaks readability), "medium" (impacts quality), "low" (minor improvement)
3. **original**: The problematic text (exact quote from content)
4. **suggested**: Your improved version
5. **reason**: Brief explanation of the issue (1 sentence)
6. **charStart**: Character position where the issue starts (approximate)
7. **charEnd**: Character position where the issue ends (approximate)

Return ONLY a valid JSON array of suggestions. No markdown, no explanation.

Example output:
[
  {
    "type": "readability",
    "severity": "medium",
    "original": "The aforementioned documentation that was previously submitted",
    "suggested": "The previously submitted documentation",
    "reason": "Wordy phrase can be simplified for better readability",
    "charStart": 45,
    "charEnd": 107
  },
  {
    "type": "grammar",
    "severity": "high",
    "original": "The team are working on the project",
    "suggested": "The team is working on the project",
    "reason": "Subject-verb agreement error - collective noun takes singular verb",
    "charStart": 120,
    "charEnd": 155
  }
]

Focus on the most impactful issues. Limit to 15 suggestions maximum.

Now analyze this content:`

export async function POST(request: NextRequest) {
  try {
    const { content, apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Create Anthropic client
    const anthropic = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com',
    })

    // Call Claude to analyze content
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${BASE_ANALYSIS_PROMPT}\n\n---\n\n${content}`,
        },
      ],
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text.trim() 
      : ''

    // Extract JSON from response
    let jsonText = responseText
    if (responseText.includes('```json')) {
      const match = responseText.match(/```json\s*([\s\S]*?)\s*```/)
      jsonText = match ? match[1] : responseText
    } else if (responseText.includes('```')) {
      const match = responseText.match(/```\s*([\s\S]*?)\s*```/)
      jsonText = match ? match[1] : responseText
    }

    let suggestions: any[]
    try {
      suggestions = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonText)
      throw new Error('AI returned invalid JSON. Please try again.')
    }

    // Validate and format suggestions
    const validSuggestions = suggestions
      .filter((s: any) => s.type && s.original && s.suggested && s.severity)
      .map((s: any, index: number) => ({
        id: `base-${Date.now()}-${index}`,
        category: 'Quality', // Special category for base suggestions
        type: s.type,
        severity: s.severity,
        title: s.reason || 'Writing quality issue',
        original: s.original,
        suggested: s.suggested,
        reason: s.reason,
        charStart: s.charStart || null,
        charEnd: s.charEnd || null,
        isBase: true, // Flag to distinguish from guideline suggestions
      }))

    return NextResponse.json({
      suggestions: validSuggestions,
      count: validSuggestions.length,
    })
  } catch (error: any) {
    console.error('Base analysis error:', error)

    // Handle Anthropic API errors
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your settings.' },
        { status: 401 }
      )
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to analyze content' },
      { status: 500 }
    )
  }
}
