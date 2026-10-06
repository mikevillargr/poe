import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { getArticle } from '@/lib/articles/repo'
import { generateForRole } from '@/lib/ai/roles'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { buildRecomposePrompt, TONALITIES } from '@/lib/optimize/prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z
  .object({
    suggestionId: z.string().max(100).optional(),
    originalText: z.string().trim().min(1).max(2000),
    currentSuggestion: z.string().trim().min(1).max(4000),
    tonality: z.string().max(40).optional(),
    customPrompt: z.string().trim().max(1000).optional(),
  })
  .refine((b) => b.customPrompt || (b.tonality && TONALITIES[b.tonality]), 'Choose a tonality or write a custom instruction.')

// POST { suggestionId?, originalText, currentSuggestion, tonality? | customPrompt } → { newSuggestion, suggestionId }
export const POST = withRoute<{ clientId: string; articleId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const b = bodySchema.parse(await req.json())

  // The blacklist rules always apply to rewrites, so a rewrite can't reintroduce an AI tell.
  const blacklist = (await getActiveGuidelines(client.id, article.templateId)).find((g) => g.category === 'blacklist')
  const hint = blacklist?.rules.map((r) => r.rule).join(' ').slice(0, 1500)

  const { text } = await generateForRole(
    'generation',
    {
      messages: [
        {
          role: 'user',
          content: buildRecomposePrompt({
            originalText: b.originalText,
            currentSuggestion: b.currentSuggestion,
            instruction: b.customPrompt || TONALITIES[b.tonality!],
            guidelineHint: hint,
          }),
        },
      ],
      maxTokens: 1500,
      temperature: 0.6,
    },
    { tenantId: client.id, articleId: article.id, userId: user.id },
  )
  const newSuggestion = text.trim().replace(/^["“]|["”]$/g, '')
  if (!newSuggestion) throw Errors.badRequest('The model returned nothing. Try again.')
  return json({ newSuggestion, suggestionId: b.suggestionId })
})
