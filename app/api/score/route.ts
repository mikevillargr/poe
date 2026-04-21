import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { getInMemoryHeuristics } from '@/lib/storage/in-memory'
import { db } from '@/lib/db'
import { heuristics, scoreJobs, contentDocuments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const scoreRequestSchema = z.object({
  content: z.string().min(1),
  source: z.enum(['url', 'docx', 'gdoc', 'paste', 'csv_batch']),
  sourceRef: z.string().optional(),
  documentId: z.string().uuid().optional(),
  apiKey: z.string().min(1),
})

// GET handler to return heuristics (for filter generation)
export async function GET() {
  try {
    let allHeuristics: any[] = []
    
    if (db) {
      try {
        const rows = await db.select().from(heuristics)
        allHeuristics = rows.map((h: any) => ({
          id: h.id,
          category: h.category,
          text: h.rule,
          weight: h.weight,
        }))
      } catch (dbError) {
        console.warn('Failed to load heuristics from database')
      }
    }

    if (allHeuristics.length === 0) {
      allHeuristics = getInMemoryHeuristics()
    }

    return NextResponse.json({ heuristics: allHeuristics })
  } catch (error: any) {
    console.error('GET /api/score error:', error)
    return NextResponse.json(
      { error: 'Failed to load heuristics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, source, sourceRef, documentId, apiKey } = scoreRequestSchema.parse(body)

    // Load heuristics: database first, file fallback
    let allHeuristics: any[] = []
    
    if (db) {
      try {
        const rows = await db.select().from(heuristics)
        allHeuristics = rows.map((h: any) => ({
          id: h.id, category: h.category, text: h.rule, weight: h.weight,
        }))
        console.log(`Score: loaded ${allHeuristics.length} heuristics from database`)
      } catch (dbError) {
        console.warn('Score: database read failed, trying file storage')
      }
    }

    if (allHeuristics.length === 0) {
      allHeuristics = getInMemoryHeuristics()
      console.log(`Score: loaded ${allHeuristics.length} heuristics from file storage`)
    }

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

    const overallScore = scoreData.overallScore || 0
    const dimensionScores = scoreData.dimensionScores || []
    const tenantId = '00000000-0000-0000-0000-000000000000'

    // Persist to database
    if (db) {
      try {
        // Save score job
        await db.insert(scoreJobs).values({
          tenantId,
          documentId: documentId || null,
          contentText: content.substring(0, 10000), // Truncate for storage
          contentSource: source,
          sourceRef: sourceRef || null,
          status: 'complete',
          overallScore,
          dimensionScores,
          suggestions,
        })

        // Update the document with the score if documentId is provided
        if (documentId) {
          await db.update(contentDocuments)
            .set({
              overallScore,
              dimensionScores,
              status: 'scored',
              updatedAt: new Date(),
            })
            .where(eq(contentDocuments.id, documentId))
        }

        console.log(`Score saved to database. Document: ${documentId || 'none'}, Score: ${overallScore}`)
      } catch (dbError: any) {
        console.error('Failed to save score to database:', dbError.message)
        // Non-fatal: still return the results
      }
    }

    return NextResponse.json({
      success: true,
      overallScore,
      dimensionScores,
      suggestions,
      heuristicsCount: allHeuristics.length,
      source,
      sourceRef,
      documentId,
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
