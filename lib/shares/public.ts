import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles, tenants, users } from '@/lib/db/schema'
import { getArticleHistory } from '@/lib/articles/history'
import { getGuidelinesForPrompt, type GuidelineGroup } from '@/lib/guidelines/prompt'
import { getBranding, type Branding } from '@/lib/branding'
import type { HistoryEvent } from '@/lib/articles/history-format'
import { buildStory, storyTotals, type StoryStep } from './story'
import { countShareView, resolveShareToken, type ShareRow } from './repo'

// DR-021: everything the public page `/s/[token]` shows, loaded server-side for one valid token.

export interface SharedRuleGroup {
  category: string
  tier: 'universal' | 'client'
  rules: { title: string | null; rule: string }[]
}

export interface SharedArticle {
  share: Pick<ShareRow, 'showComments' | 'showRules' | 'showHistory'>
  branding: Branding
  client: { name: string; website: string | null; logoUrl: string | null }
  article: {
    id: string
    title: string
    status: string
    keywords: string[]
    primaryKeyword: string | null
    wordCount: number
    targetWordCount: number | null
    html: string
    updatedAt: string
    owner: { name: string; image: string | null } | null
  }
  score: { overall: number | null; rules: { universal: number; client: number } | null; ranAt: string | null }
  story: StoryStep[]
  totals: { people: number; humanActions: number }
  /** Newest first; only when the link shows history. Free text written for colleagues is removed. */
  history: HistoryEvent[] | null
  people: Record<string, string>
  rules: SharedRuleGroup[] | null
}

export { publicEvent } from './public-event'
import { HIDDEN_TYPES, publicEvent } from './public-event'

export async function loadSharedArticle(token: string, opts: { countView?: boolean } = {}): Promise<SharedArticle | null> {
  const share = await resolveShareToken(token)
  if (!share) return null
  const [row] = await db
    .select({
      a: articles,
      clientName: tenants.name,
      clientWebsite: tenants.website,
      clientLogo: tenants.logoUrl,
      ownerName: users.name,
      ownerImage: users.image,
    })
    .from(articles)
    .innerJoin(tenants, eq(tenants.id, articles.tenantId))
    .leftJoin(users, eq(users.id, articles.assigneeId))
    .where(eq(articles.id, share.articleId))
    .limit(1)
  if (!row) return null
  const a = row.a

  const [history, branding, ruleGroups] = await Promise.all([
    getArticleHistory(a.tenantId, a.id),
    getBranding(),
    share.showRules ? getGuidelinesForPrompt(a.tenantId, a.templateId) : Promise.resolve(null as GuidelineGroup[] | null),
  ])
  if (opts.countView) await countShareView(share.id)

  const opt = a.lastOptimize
  const score = typeof opt?.overallScore === 'number' ? Math.round(opt.overallScore) : null
  const events = history.events.filter((e) => !HIDDEN_TYPES.has(e.type))

  return {
    share: { showComments: share.showComments, showRules: share.showRules, showHistory: share.showHistory },
    branding,
    client: { name: row.clientName, website: row.clientWebsite, logoUrl: row.clientLogo },
    article: {
      id: a.id,
      title: a.title,
      status: a.status,
      keywords: a.keywords ?? [],
      primaryKeyword: a.primaryKeyword,
      wordCount: a.wordCount ?? 0,
      targetWordCount: a.targetWordCount,
      html: a.draftHtml ?? '',
      updatedAt: a.updatedAt.toISOString(),
      owner: row.ownerName ? { name: row.ownerName, image: row.ownerImage } : null,
    },
    score: { overall: score, rules: opt?.rules ?? null, ranAt: opt?.ranAt ?? null },
    story: buildStory({ events, researchEnabled: a.researchEnabled, status: a.status, score }),
    totals: storyTotals(events),
    history: share.showHistory ? events.map(publicEvent) : null,
    people: history.people,
    rules: ruleGroups?.map((g) => ({ category: g.category, tier: g.tier ?? 'client', rules: g.rules.map((r) => ({ title: r.title, rule: r.rule })) })) ?? null,
  }
}
