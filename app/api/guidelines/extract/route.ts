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

Your task is to:
1. **Identify the key dimensions/categories** that matter for this specific document
2. **Group related rules** under those dimensions
3. **Extract specific, measurable rules** that can be used to score content

IMPORTANT: Don't force rules into predefined categories. Instead, infer what dimensions are actually present in the document. Common dimensions include:
- Brand (voice, tone, messaging)
- SEO (optimization, keywords, structure)
- Blacklist (prohibited terms, competitors)
- Agency (quality standards, citations)
- Client (client-specific requirements)
- Legal (compliance, regulations)
- Accessibility (readability, inclusivity)
- Technical (formatting, structure)
- Style (grammar, punctuation, formatting)

But you should identify dimensions based on what's actually in the document. If the document focuses heavily on legal compliance, create a "Legal" dimension. If it emphasizes data-driven content, create a "Data & Statistics" dimension.

For each rule you extract:

1. **Category**: The dimension this rule belongs to (infer from document, don't force into predefined list)
2. **Text**: Clear, actionable rule (1-2 sentences max)
   - Be specific and measurable
   - Use imperative language ("Must", "Should", "Never")
   - Focus on what can be checked in content
3. **Weight**: Importance (1-10)
   - 10: Critical, must-have requirements
   - 7-9: Important guidelines
   - 4-6: Moderate importance
   - 1-3: Nice-to-have suggestions
4. **Reasoning**: Brief explanation of why this rule matters
5. **Dimension**: The broader dimension/category this belongs to (can be custom)

Return a JSON object with two parts:
1. "dimensions": Array of discovered dimensions with descriptions
2. "heuristics": Array of extracted rules

Example output format:
{
  "dimensions": [
    {
      "name": "Brand Voice",
      "description": "Guidelines for maintaining consistent brand tone and messaging",
      "color": "brand"
    },
    {
      "name": "Legal Compliance",
      "description": "Requirements for legal disclaimers and regulatory compliance",
      "color": "client"
    }
  ],
  "heuristics": [
    {
      "category": "Brand Voice",
      "text": "All articles must open with a verified statistic or data point",
      "weight": 9,
      "reasoning": "Establishes credibility and hooks readers immediately",
      "dimension": "Brand Voice"
    },
    {
      "category": "Legal Compliance",
      "text": "Include disclaimer about state-specific requirements in all LLC content",
      "weight": 10,
      "reasoning": "Legal requirement to avoid liability",
      "dimension": "Legal Compliance"
    }
  ]
}

For the "color" field in dimensions, map to one of: brand, seo, blacklist, agency, client (choose the closest match for UI purposes).

Now analyze this document and extract dimensions and heuristics:`

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

    let extractedData: any
    try {
      extractedData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonText)
      throw new Error('AI returned invalid JSON. Please try again.')
    }

    // Handle both old format (array) and new format (object with dimensions + heuristics)
    let dimensions = []
    let extractedRules = []
    
    if (Array.isArray(extractedData)) {
      // Old format - just an array of rules
      extractedRules = extractedData
    } else if (extractedData.dimensions && extractedData.heuristics) {
      // New format - object with dimensions and heuristics
      dimensions = extractedData.dimensions || []
      extractedRules = extractedData.heuristics || []
    } else {
      throw new Error('Unexpected response format from AI')
    }

    // Validate and format heuristics - preserve discovered categories as-is
    const heuristics: ExtractedHeuristic[] = extractedRules
      .filter((rule: any) => rule.category && rule.text && rule.weight)
      .map((rule: any, index: number) => ({
        id: `heuristic-${Date.now()}-${index}`,
        category: rule.category as CategoryType, // Use discovered category directly
        text: rule.text,
        weight: Math.min(10, Math.max(1, parseInt(rule.weight) || 5)),
        active: true,
        reasoning: rule.reasoning || rule.dimension ? `${rule.dimension ? `[${rule.dimension}] ` : ''}${rule.reasoning || ''}`.trim() : undefined,
      }))

    if (heuristics.length === 0) {
      return NextResponse.json(
        { error: 'No valid heuristics could be extracted from the document' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      heuristics,
      dimensions, // Include discovered dimensions in response
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
