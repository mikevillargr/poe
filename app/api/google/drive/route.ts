import { withRoute, json } from '@/lib/auth/guards'
import { disconnectDrive, driveStatus } from '@/lib/google/drive'

export const dynamic = 'force-dynamic'

// DR-014: the signed-in person's own Google Drive connection.
// GET → { connected, email }
export const GET = withRoute(async ({ user }) => json(await driveStatus(user.id)))

// DELETE → { connected: false }. Forgets and revokes the stored permission.
export const DELETE = withRoute(async ({ user }) => {
  await disconnectDrive(user.id)
  return json({ connected: false, email: null })
})
