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

    const tenantId = '00000000-0000-0000-0000-000000000000'

    // Try database first
    if (db) {
      try {
        const insertData = newHeuristics.map((h: any) => ({
          tenantId,
          category: h.category,
          rule: h.text,
          weight: h.weight,
          active: h.active ?? true,
        }))

        const result = await db.insert(heuristics).values(insertData).returning()
        console.log(`Saved ${result.length} heuristics to database`)

        return NextResponse.json({
          success: true,
          count: result.length,
          heuristics: result.map((h: any) => ({
            id: h.id,
            category: h.category,
            text: h.rule,
            weight: h.weight,
            active: h.active,
          })),
        })
      } catch (dbError: any) {
        console.error('Database save failed:', dbError.message)
        // Fall through to file storage
      }
    }

    // Fallback: file-based storage
    console.log('Using file-based storage fallback')
    const saved = newHeuristics.map((h: any, i: number) => ({
      id: `h-${Date.now()}-${i}`,
      category: h.category,
      text: h.text,
      weight: h.weight,
      active: h.active ?? true,
    }))

    addInMemoryHeuristics(saved)

    return NextResponse.json({
      success: true,
      count: saved.length,
      heuristics: saved,
    })

  } catch (error: any) {
    console.error('Save heuristics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save heuristics' },
      { status: 500 }
    )
  }
}
