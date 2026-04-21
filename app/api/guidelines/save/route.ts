import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  try {
    const { heuristics: newHeuristics } = await request.json()

    if (!Array.isArray(newHeuristics) || newHeuristics.length === 0) {
      return NextResponse.json(
        { error: 'Invalid heuristics data' },
        { status: 400 }
      )
    }

    // TODO: Get tenantId from session once auth is properly set up
    // For now, we'll use a placeholder that will be replaced
    const tenantId = '00000000-0000-0000-0000-000000000000'

    // Insert heuristics into database
    const insertData = newHeuristics.map(h => ({
      tenantId,
      category: h.category.toLowerCase() as 'brand' | 'blacklist' | 'seo' | 'agency' | 'client',
      rule: h.text, // Schema uses 'rule' not 'text'
      weight: h.weight,
      active: h.active ?? true,
    }))

    const result = await db.insert(heuristics).values(insertData).returning()

    return NextResponse.json({
      success: true,
      count: result.length,
      heuristics: result,
    })
  } catch (error: any) {
    console.error('Save heuristics error:', error)
    return NextResponse.json(
      { error: 'Failed to save heuristics' },
      { status: 500 }
    )
  }
}
