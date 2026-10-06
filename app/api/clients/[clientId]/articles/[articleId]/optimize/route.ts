import { eq, and } from 'drizzle-orm'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'
import { getArticle } from '@/lib/articles/repo'
import { htmlToText } from '@/lib/articles/text'
import { generateForRole } from '@/lib/ai/roles'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { analyzeCoverage } from '@/lib/optimize/coverage'
import { buildOptimizePrompt, OPTIMIZE_SYSTEM } from '@/lib/optimize/prompt'
import { parseOptimizeOutput } from '@/lib/optimize/parse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST → { overallScore, dimensionScores, suggestions, dropped, guidelineCount, keywordCoverage }
// Runs the generation-role model against the client's active guidelines (incl. the AI-tell blacklist) and
// keeps only suggestions whose quoted text is really in the draft. Saves the score summary to last_optimize.
export const POST = withRoute<{ clientId: string; articleId: string }>(async ({ params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const draftText = htmlToText(article.draftHtml)
  if (draftText.length < 50) throw Errors.badRequest('Generate or write a draft first (at least 50 characters).')

  const guidelines = await getActiveGuidelines(client.id, article.templateId)
  const guidelineCount = guidelines.reduce((n, g) => n + g.rules.length, 0)
  if (!guidelineCount) throw Errors.badRequest('This client has no active guidelines to check against. Add some on the Guidelines page.')

  const { text } = await generateForRole(
    'generation',
    {
      system: OPTIMIZE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: buildOptimizePrompt({
            title: article.title,
            primaryKeyword: article.primaryKeyword,
            keywords: article.keywords,
            targetWordCount: article.targetWordCount,
            draftText,
            guidelines,
          }),
        },
      ],
      maxTokens: 8000,
      temperature: 0.2,
    },
    { tenantId: client.id, articleId: article.id, userId: user.id },
  )

  let parsed
  try {
    parsed = parseOptimizeOutput(text, draftText)
  } catch {
    throw Errors.badRequest('The model’s answer couldn’t be read. Try the check again.')
  }

  const keywordCoverage = analyzeCoverage(article.draftHtml ?? '', article.keywords, article.primaryKeyword, article.targetWordCount).keywords
  await db
    .update(articles)
    .set({
      lastOptimize: {
        ranAt: new Date().toISOString(),
        overallScore: parsed.overallScore,
        dimensionScores: parsed.dimensionScores,
        keywordCoverage: keywordCoverage.map((k) => ({
          keyword: k.keyword,
          count: k.count,
          inTitle: k.inH1,
          inIntro: k.inIntro,
          inHeading: k.inHeading,
        })),
      },
    })
    .where(and(eq(articles.id, article.id), eq(articles.tenantId, client.id)))

  return json({ ...parsed, guidelineCount })
})
