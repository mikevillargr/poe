import { notFound } from 'next/navigation'
import { inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getClientBySlug } from '@/lib/tenancy'
import { listArticles, recentEvents } from '@/lib/articles/repo'
import { HomeView } from '@/components/home/HomeView'

export const dynamic = 'force-dynamic'

// Client Home (WS client-home, DR-003).
export default async function ClientHomePage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()

  const [articles, activity] = await Promise.all([listArticles(client.id), recentEvents(client.id, 12)])
  const assigneeIds = [...new Set(articles.map((a) => a.assigneeId).filter(Boolean))] as string[]
  const people = assigneeIds.length
    ? await db.select({ id: users.id, name: users.name, image: users.image }).from(users).where(inArray(users.id, assigneeIds))
    : []

  return (
    <HomeView
      client={{ id: client.id, name: client.name, slug: client.slug, website: client.website }}
      initialArticles={articles}
      events={activity.events}
      activityCursor={activity.nextCursor}
      people={people}
    />
  )
}
