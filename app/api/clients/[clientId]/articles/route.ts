import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { createArticle, listArticles, statusCounts, toSummary } from '@/lib/articles/repo'
import { ARTICLE_STATUSES, articleInputSchema, type ArticleStatus } from '@/lib/articles/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string }

// GET ?status=&q= → { articles: ArticleSummary[], counts: StatusCounts }
export const GET = withRoute<P>(async ({ req, params }) => {
  const client = await requireClient(params.clientId)
  const sp = req.nextUrl.searchParams
  const status = sp.get('status')
  const [items, counts] = await Promise.all([
    listArticles(client.id, {
      status: status && (ARTICLE_STATUSES as readonly string[]).includes(status) ? (status as ArticleStatus) : undefined,
      q: sp.get('q') ?? undefined,
    }),
    statusCounts(client.id),
  ])
  return json({ articles: items, counts })
})

// POST { title, brief?, keywords?, primaryKeyword?, targetWordCount? } → { article } ("New Article")
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const input = articleInputSchema.parse(await req.json())
  const article = await createArticle(client.id, input, user)
  return json({ article: toSummary(article) }, { status: 201 })
})
