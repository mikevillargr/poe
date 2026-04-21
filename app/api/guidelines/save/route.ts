import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'
import { addInMemoryHeuristics } from '@/lib/storage/in-memory'

export async function POST(request: NextRequest) {
  try {
    const { heuristics: newHeuristics } = await request.json()

    if (!Array.isArray(newHeuristics) || newHeuristics.length === 0) {
      return NextResponse.json(
        { error: 'Invalid heuristics data' },
        { status: 400 }
      )
    }

    try {
      // Check if database is available
      if (!db) {
        throw new Error('Database not available')
      }

      // Try to save to database first
      const tenantId = '00000000-0000-0000-0000-000000000000'

      const insertData = newHeuristics.map(h => ({
        tenantId,
        category: h.category.toLowerCase() as 'brand' | 'blacklist' | 'seo' | 'agency' | 'client',
        rule: h.text,
        weight: h.weight,
        active: h.active ?? true,
      }))

      const result = await db.insert(heuristics).values(insertData).returning()

      return NextResponse.json({
        success: true,
        count: result.length,
        heuristics: result.map(h => ({
          id: h.id,
          category: h.category.charAt(0).toUpperCase() + h.category.slice(1),
          text: h.rule,
          weight: h.weight,
          active: h.active,
        })),
      })
    } catch (dbError) {
      console.warn('Database save failed, using in-memory storage:', dbError)
      
      // Fallback to in-memory storage
      const savedHeuristics = newHeuristics.map((h, index) => ({
        id: `temp-${Date.now()}-${index}`,
        category: h.category,
        text: h.text,
        weight: h.weight,
        active: h.active ?? true,
      }))

      addInMemoryHeuristics(savedHeuristics)

      return NextResponse.json({
        success: true,
        count: savedHeuristics.length,
        heuristics: savedHeuristics,
        warning: 'Saved to temporary storage. Database connection required for persistence.',
      })
    }
  } catch (error: any) {
    console.error('Save heuristics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save heuristics' },
      { status: 500 }
    )
  }
}
