import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Public liveness/readiness check (deploy health check). Reports DB reachability only.
export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ ok: true, db: true })
  } catch {
    return NextResponse.json({ ok: false, db: false, code: 'DB_UNAVAILABLE' }, { status: 503 })
  }
}
