import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { listArticles } from '@/lib/articles/repo'
import { recentImports } from '@/lib/import/repo'
import { ImportView } from '@/components/import/ImportView'

export const dynamic = 'force-dynamic'

// Content calendar import (WS import, DR-004).
export default async function ImportPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()
  const [articles, recent] = await Promise.all([listArticles(client.id), recentImports(client.id)])
  return (
    <ImportView
      client={{ id: client.id, name: client.name, slug: client.slug }}
      existingTitles={articles.map((a) => a.title)}
      recent={recent}
    />
  )
}
