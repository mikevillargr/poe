import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contentDocuments } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

const TENANT_ID = '00000000-0000-0000-0000-000000000000'

// GET - List all documents
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ documents: [], source: 'no-db' })
    }

    const docs = await db
      .select()
      .from(contentDocuments)
      .where(eq(contentDocuments.tenantId, TENANT_ID))
      .orderBy(desc(contentDocuments.updatedAt))

    return NextResponse.json({
      documents: docs.map((d: any) => ({
        id: d.id,
        title: d.title,
        source: d.source,
        sourceRef: d.sourceRef,
        status: d.status,
        overallScore: d.overallScore,
        dimensionScores: d.dimensionScores,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      count: docs.length,
    })
  } catch (error: any) {
    console.error('List documents error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new document
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { title, content, source, sourceRef } = await request.json()

    if (!content || !title) {
      return NextResponse.json({ error: 'Title and content required' }, { status: 400 })
    }

    const [doc] = await db.insert(contentDocuments).values({
      tenantId: TENANT_ID,
      title,
      originalText: content,
      source: source || 'paste',
      sourceRef: sourceRef || null,
      status: 'draft',
    }).returning()

    console.log(`Created document: ${doc.id} - "${title}"`)

    return NextResponse.json({ document: doc })
  } catch (error: any) {
    console.error('Create document error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
