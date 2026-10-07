import type { Metadata } from 'next'
import { loadSharedArticle } from '@/lib/shares/public'
import { getBranding } from '@/lib/branding'
import { SharedArticleView } from '@/components/share/SharedArticleView'
import { LinkInactive } from '@/components/share/LinkInactive'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadSharedArticle((await params).token)
  return { title: data ? `${data.article.title} · ${data.client.name}` : 'Link not active' }
}

// DR-021: the shared article preview. Anyone with the link can view it until it's revoked.
export default async function SharedArticlePage({ params }: Props) {
  const { token } = await params
  const data = await loadSharedArticle(token, { countView: true })
  if (!data) return <LinkInactive branding={await getBranding()} />
  return <SharedArticleView token={token} data={JSON.parse(JSON.stringify(data))} />
}
