import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'
import { getInMemoryHeuristics } from '@/lib/storage/in-memory'

export async function GET(request: NextRequest) {
  try {
    // Try database first
    if (db) {
      try {
        const rows = await db.select().from(heuristics)
        console.log(`Loaded ${rows.length} heuristics from database`)

        const formatted = rows.map((h: any) => ({
          id: h.id,
          category: h.category,
          text: h.rule,
          weight: h.weight,
          active: h.active,
        }))

        return NextResponse.json({
          heuristics: formatted,
          count: formatted.length,
          source: 'database',
        })
      } catch (dbError: any) {
        console.error('Database read failed:', dbError.message)
        // Fall through to file storage
      }
    }

    // Fallback: file-based storage
    const fileHeuristics = getInMemoryHeuristics()
    console.log(`Loaded ${fileHeuristics.length} heuristics from file storage`)

    return NextResponse.json({
      heuristics: fileHeuristics,
      count: fileHeuristics.length,
      source: 'file',
    })

  } catch (error: any) {
    console.error('List heuristics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load heuristics' },
      { status: 500 }
    )
  }
}
