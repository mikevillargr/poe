import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { generateForRole } from '@/lib/ai/roles'
import { isMockMode } from '@/lib/ai/registry'
import { buildExtractMessages, parseExtractedRules } from '@/lib/guidelines/extract'
import { extractRequestSchema, type ExtractedRule } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string }

// Deterministic proposals for AI_MOCK=1 so the review UI can be developed without a model.
const MOCK_PROPOSALS: ExtractedRule[] = [
  {
    category: 'seo',
    title: 'Primary keyword placement',
    rule: 'Use the primary keyword in the H1, within the first 100 words, and in at least one H2.',
    weight: 9,
  },
  {
    category: 'readability',
    title: 'Plain language',
    rule: 'Write at roughly an 8th–9th grade reading level. Prefer short, concrete words over abstract ones.',
    weight: 6,
  },
  {
    category: 'blacklist',
    title: 'Stock openers',
    rule: 'Never open with "In today\'s fast-paced world", "When it comes to…" or "It\'s important to note that…".',
    weight: 9,
  },
]

// POST { text, sourceRef? } → { proposals: ExtractedRule[] }. Proposals are reviewed and edited in
// the UI before anything is saved (DR-006); this endpoint writes nothing.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { text } = extractRequestSchema.parse(await req.json())

  if (isMockMode()) return json({ proposals: MOCK_PROPOSALS })

  const result = await generateForRole(
    'generation',
    { ...buildExtractMessages(text), maxTokens: 4096, temperature: 0 },
    { tenantId: client.id, userId: user.id },
  )
  let proposals: ExtractedRule[]
  try {
    proposals = parseExtractedRules(result.text)
  } catch {
    throw Errors.badRequest('Could not extract guidelines from that document. Try a shorter excerpt, or add the rules manually.')
  }
  return json({ proposals })
})
