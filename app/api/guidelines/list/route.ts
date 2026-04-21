import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'

// In-memory storage (shared with save endpoint)
let inMemoryHeuristics: any[] = []

export async function GET(request: NextRequest) {
  try {
    try {
      // Check if database is available
      if (!db) {
        throw new Error('Database not available')
      }

      // Try database first
      const allHeuristics = await db.select().from(heuristics)

      const formatted = allHeuristics.map(h => ({
        id: h.id,
        category: h.category.charAt(0).toUpperCase() + h.category.slice(1),
        text: h.rule,
        weight: h.weight,
        active: h.active,
      }))

      return NextResponse.json({
        heuristics: formatted,
        count: formatted.length,
      })
    } catch (dbError) {
      console.warn('Database read failed, using in-memory storage:', dbError)
      
      // Fallback to in-memory storage
      return NextResponse.json({
        heuristics: inMemoryHeuristics,
        count: inMemoryHeuristics.length,
        warning: 'Using temporary storage. Database connection required for persistence.',
      })
    }
  } catch (error: any) {
    console.error('List heuristics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load heuristics' },
      { status: 500 }
    )
  }
}

// Allow save endpoint to update in-memory storage
export function addToMemory(heuristics: any[]) {
  inMemoryHeuristics = [...inMemoryHeuristics, ...heuristics]
}
