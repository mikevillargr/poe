import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { getInMemoryHeuristics } from '@/lib/storage/in-memory'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'

const scoreRequestSchema = z.object({
  content: z.string().min(1),
  source: z.enum(['url', 'docx', 'gdoc', 'paste', 'csv_batch']),
  sourceRef: z.string().optional(),
  apiKey: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, source, sourceRef, apiKey } = scoreRequestSchema.parse(body)

    // Get heuristics from database or in-memory storage
    let allHeuristics: any[] = []
    
    try {
      if (db) {
        const dbHeuristics = await db.select().from(heuristics)
        allHeuristics = dbHeuristics.map((h: any) => {
          // Parse category from rule text if it has [Category] prefix
          let category = h.category
          let rule = h.rule
          const match = h.rule?.match(/^\[([^\]]+)\]\s*(.*)/)
          if (match) {
            category = match[1]
            rule = match[2]
          }
          return { id: h.id, category, text: rule, weight: h.weight }
        })
        console.log('Loaded', allHeuristics.length, 'heuristics from database')
      }
    } catch (dbError) {
      console.warn('Database read failed, using in-memory heuristics')
    }

    // Fallback to in-memory if database failed or empty
    if (allHeuristics.length === 0) {
      const memHeuristics = getInMemoryHeuristics()
      console.log('In-memory heuristics:', memHeuristics.length)
      allHeuristics = memHeuristics
    }

    console.log('Total heuristics for scoring:', allHeuristics.length)

    if (allHeuristics.length === 0) {
      return NextResponse.json({
        error: 'No heuristics configured. Please add guidelines first.',
      }, { status: 400 })
    }

    // Create scoring prompt
    const scoringPrompt = `You are an expert content quality analyst. Analyze the following content against these specific guidelines and rules:

${allHeuristics.map((h: any, i: number) => `${i + 1}. [${h.category}] ${h.text || h.rule} (Weight: ${h.weight}/10)`).join('\n')}

For each rule that is violated or could be improved:
1. Identify the specific text that needs attention
2. Explain why it violates the rule
3. Provide a specific suggestion for improvement
4. Rate the severity: high (critical), medium (important), low (minor)

Return ONLY a valid JSON object with this structure:
{
  "overallScore": 85,
  "dimensionScores": [
    {"category": "Brand", "score": 90, "passCount": 5, "failCount": 1},
    {"category": "SEO", "score": 75, "passCount": 3, "failCount": 2}
  ],
  "suggestions": [
    {
      "heuristicId": "rule-id",
      "category": "Brand",
      "severity": "high",
      "title": "Brief issue description",
      "original": "exact text from content",
      "suggested": "improved version",
      "reason": "why this violates the rule",
      "charStart": 0,
      "charEnd": 50
    }
  ]
}

Content to analyze:
---
${content}
---

Analyze thoroughly and return the JSON object:`

    // Call Anthropic API
    const anthropic = new Anthropic({
      apiKey,
      baseURL: 'https://api.anthropic.com',
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: scoringPrompt,
        },
      ],
    })

    // Parse response
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

    let scoreData: any
    try {
      scoreData = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', jsonText)
      throw new Error('AI returned invalid JSON. Please try again.')
    }

    // Add IDs to suggestions
    const suggestions = (scoreData.suggestions || []).map((s: any, i: number) => ({
      ...s,
      id: `suggestion-${Date.now()}-${i}`,
      status: 'pending',
    }))

    return NextResponse.json({
      success: true,
      overallScore: scoreData.overallScore || 0,
      dimensionScores: scoreData.dimensionScores || [],
      suggestions,
      heuristicsCount: allHeuristics.length,
      source,
      sourceRef,
    })

  } catch (error: any) {
    console.error('Scoring error:', error)

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
      { error: error.message || 'Failed to score content' },
      { status: 500 }
    )
  }
}
