import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  try {
    // TODO: Filter by tenantId from session once auth is properly set up
    // For now, get all heuristics
    const allHeuristics = await db.select().from(heuristics)

    // Format for frontend
    const formatted = allHeuristics.map(h => ({
      id: h.id,
      category: h.category.charAt(0).toUpperCase() + h.category.slice(1), // Capitalize
      text: h.rule,
      weight: h.weight,
      active: h.active,
    }))

    return NextResponse.json({
      heuristics: formatted,
      count: formatted.length,
    })
  } catch (error: any) {
    console.error('List heuristics error:', error)
    return NextResponse.json(
      { error: 'Failed to load heuristics' },
      { status: 500 }
    )
  }
}
