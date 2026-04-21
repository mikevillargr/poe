import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ dimensions: [] })
    }

    // Get unique categories (dimensions) from heuristics
    const result = await db
      .select({ category: heuristics.category })
      .from(heuristics)
      .groupBy(heuristics.category)
      .orderBy(heuristics.category)

    const dimensions = result.map(r => r.category)

    return NextResponse.json({ dimensions })
  } catch (error: any) {
    console.error('Failed to fetch dimensions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dimensions' },
      { status: 500 }
    )
  }
}
