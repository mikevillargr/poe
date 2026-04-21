import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contentDocuments, scoreJobs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET - Get a single document with its latest score
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { id } = await params

    const [doc] = await db
      .select()
      .from(contentDocuments)
      .where(eq(contentDocuments.id, id))

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Get latest score job for this document
    const scores = await db
      .select()
      .from(scoreJobs)
      .where(eq(scoreJobs.documentId, id))
      .orderBy(desc(scoreJobs.createdAt))
      .limit(1)

    const latestScore = scores[0] || null

    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        originalText: doc.originalText,
        editedText: doc.editedText,
        source: doc.source,
        sourceRef: doc.sourceRef,
        status: doc.status,
        overallScore: doc.overallScore,
        dimensionScores: doc.dimensionScores,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
      latestScore: latestScore ? {
        id: latestScore.id,
        overallScore: latestScore.overallScore,
        dimensionScores: latestScore.dimensionScores,
        suggestions: latestScore.suggestions,
        status: latestScore.status,
        createdAt: latestScore.createdAt,
      } : null,
    })
  } catch (error: any) {
    console.error('Get document error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update a document (edited text, title, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { id } = await params
    const updates = await request.json()
    
    const updateData: any = { updatedAt: new Date() }
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.editedText !== undefined) updateData.editedText = updates.editedText
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.overallScore !== undefined) updateData.overallScore = updates.overallScore
    if (updates.dimensionScores !== undefined) updateData.dimensionScores = updates.dimensionScores

    const [doc] = await db
      .update(contentDocuments)
      .set(updateData)
      .where(eq(contentDocuments.id, id))
      .returning()

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ document: doc })
  } catch (error: any) {
    console.error('Update document error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    await db
      .delete(contentDocuments)
      .where(eq(contentDocuments.id, id))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
