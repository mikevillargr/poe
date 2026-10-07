import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { listNotifications, markNotificationsRead } from '@/lib/notifications/notify'

export const dynamic = 'force-dynamic'

// GET → { items, unread } (DR-021: the sidebar bell)
export const GET = withRoute(async ({ user }) => json(await listNotifications(user.id)))

// PATCH { ids } | { all: true } → { items, unread }
export const PATCH = withRoute(async ({ req, user }) => {
  const b = z.union([z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }), z.object({ all: z.literal(true) })]).parse(await req.json())
  await markNotificationsRead(user.id, 'all' in b ? 'all' : b.ids)
  return json(await listNotifications(user.id))
})
