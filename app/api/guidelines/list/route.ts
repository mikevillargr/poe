import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'
import { getInMemoryHeuristics } from '@/lib/storage/in-memory'

export async function GET(request: NextRequest) {
  try {
    try {
      // Check if database is available
      if (!db) {
        throw new Error('Database not available')
      }

      // Try database first
      const allHeuristics = await db.select().from(heuristics)

      const formatted = allHeuristics.map(h => {
        // Extract original category from rule text if it has [Category] prefix
        let category = h.category.charAt(0).toUpperCase() + h.category.slice(1)
        let text = h.rule
        
        const categoryMatch = h.rule.match(/^\[([^\]]+)\]\s*(.*)/)
        if (categoryMatch) {
          category = categoryMatch[1]
          text = categoryMatch[2]
        }
        
        return {
          id: h.id,
          category,
          text,
          weight: h.weight,
          active: h.active,
        }
      })

      return NextResponse.json({
        heuristics: formatted,
        count: formatted.length,
      })
    } catch (dbError) {
      console.warn('Database read failed, using in-memory storage:', dbError)
      
      // Fallback to in-memory storage
      const memoryHeuristics = getInMemoryHeuristics()
      return NextResponse.json({
        heuristics: memoryHeuristics,
        count: memoryHeuristics.length,
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
