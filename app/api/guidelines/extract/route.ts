import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CategoryType } from '@/components/CategoryBadge'

interface ExtractedHeuristic {
  id: string
  category: CategoryType
  text: string
  weight: number
  active: boolean
  reasoning?: string
}

const EXTRACTION_PROMPT = `You are an expert at analyzing brand guidelines, content standards, and style guides to extract actionable scoring heuristics.

Analyze the provided document and extract specific, measurable rules that can be used to score content quality. For each rule you identify:

1. **Category**: Classify into one of these categories:
   - Brand: Brand voice, tone, messaging guidelines
   - SEO: Search optimization, keyword usage, heading structure
   - Blacklist: Prohibited terms, competitors to avoid, banned phrases
   - Agency: Quality standards, citation requirements, fact-checking
   - Client: Client-specific requirements, industry regulations

2. **Text**: Write a clear, actionable rule (1-2 sentences max)
   - Be specific and measurable
   - Use imperative language ("Must", "Should", "Never")
   - Focus on what can be checked in content

3. **Weight**: Assign importance (1-10)
   - 10: Critical, must-have requirements
   - 7-9: Important guidelines
   - 4-6: Moderate importance
   - 1-3: Nice-to-have suggestions

4. **Reasoning**: Brief explanation of why this rule matters (optional)

Return ONLY a valid JSON array of heuristics. No markdown, no explanation, just the JSON array.

Example output format:
[
  {
    "category": "Brand",
    "text": "All articles must open with a verified statistic or data point",
    "weight": 9,
    "reasoning": "Establishes credibility and hooks readers immediately"
  },
  {
    "category": "Blacklist",
    "text": "Never mention competitors LegalZoom, Incfile, or ZenBusiness by name",
    "weight": 10,
    "reasoning": "Client policy to avoid promoting competitors"
  }
]

Now analyze this document and extract heuristics:`

export async function POST(request: NextRequest) {
  try {
    const { content, source, apiKey } = await request.json()

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

    // Call Claude to extract heuristics
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\n---\n\n${content}`,
        },
      ],
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text.trim() 
      : ''

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonText = responseText
    if (responseText.includes('```json')) {
      const match = responseText.match(/```json\s*([\s\S]*?)\s*```/)
      jsonText = match ? match[1] : responseText
    } else if (responseText.includes('```')) {
      const match = responseText.match(/```\s*([\s\S]*?)\s*```/)
      jsonText = match ? match[1] : responseText
    }

    let extractedRules: any[]
    try {
      extractedRules = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonText)
      throw new Error('AI returned invalid JSON. Please try again.')
    }

    // Validate and format heuristics
    const heuristics: ExtractedHeuristic[] = extractedRules
      .filter(rule => rule.category && rule.text && rule.weight)
      .map((rule, index) => ({
        id: `heuristic-${Date.now()}-${index}`,
        category: rule.category as CategoryType,
        text: rule.text,
        weight: Math.min(10, Math.max(1, parseInt(rule.weight) || 5)),
        active: true,
        reasoning: rule.reasoning,
      }))

    if (heuristics.length === 0) {
      return NextResponse.json(
        { error: 'No valid heuristics could be extracted from the document' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      heuristics,
      count: heuristics.length,
      source,
    })
  } catch (error: any) {
    console.error('Heuristic extraction error:', error)

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
      { error: error.message || 'Failed to extract heuristics' },
      { status: 500 }
    )
  }
}
