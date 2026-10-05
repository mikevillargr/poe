import { NextResponse } from 'next/server'

// Retired scoring-era endpoints (D-001). They answer 410 with a pointer to the replacement so a
// stale caller fails loudly. The old implementations are on `main` for reference
// (`git show main:<path>`). WS retire-docs deletes these stubs.
export function gone(replacement: string) {
  const handler = () =>
    NextResponse.json(
      { error: `This endpoint was retired in the Content Hub rework. Use ${replacement}.`, code: 'GONE' },
      { status: 410 },
    )
  return { GET: handler, POST: handler, PUT: handler, PATCH: handler, DELETE: handler }
}
