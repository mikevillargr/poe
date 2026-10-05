import { withRoute } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { streamForRole } from '@/lib/ai/roles'
import { toSSEResponse } from '@/lib/ai/sse'
import type { AIStreamEvent } from '@/lib/ai/types'
import { aiEditBodySchema, buildAiEditPrompt, cleanFragment, computeAiEditWarnings, type AiEditWarning } from '@/lib/prompts/ai-edit'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { toApiError } from '@/lib/pipeline/stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Inline AI edit of a selection (rewrite) or new text at the cursor (insert). Persists NOTHING: the
// client applies the result to the editor. Request-scoped: aborting the request cancels the model call.
//
// POST body (zod, lib/prompts/ai-edit.ts):
//   { mode: 'rewrite', selectedText (1..8000), preset: 'shorten'|'expand'|'simplify'|'casual'|'formal'|'fix_grammar'|'custom',
//     instruction? (<=1000; required for 'custom'), contextBefore? (<=4000), contextAfter? (<=4000) }
//   { mode: 'insert', instruction (1..1000), contextBefore?, contextAfter? }
//   → text/event-stream:
//     { type:'delta', text } …   raw model text as it streams (preview only; may contain code fences)
//     { type:'usage', usage } { type:'done', text }   provider events (done.text is the RAW text)
//     { type:'result', html, warnings }               final, sanitised HTML FRAGMENT to apply;
//        warnings: ('primary_keyword_removed'|'link_removed')[] (always [] for insert)
//     or { type:'error', code, message }
//   Errors before streaming: JSON `{ error, code }` with 400 (validation), 401/403, 404, 502/503 (AI not configured).
export interface AiEditResultEvent {
  type: 'result'
  html: string
  warnings: AiEditWarning[]
}

export const POST = withRoute<{ clientId: string; articleId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const body = aiEditBodySchema.parse(await req.json().catch(() => ({})))
  const article = await getArticle(client.id, params.articleId)
  const guidelines = await getActiveGuidelines(client.id)
  const prompt = buildAiEditPrompt(article, body, guidelines)

  let started: Awaited<ReturnType<typeof streamForRole>>
  try {
    started = await streamForRole(
      'generation',
      { system: prompt.system, messages: prompt.messages, maxTokens: prompt.maxTokens, signal: req.signal },
      { tenantId: client.id, articleId: article.id, userId: user.id },
    )
  } catch (err) {
    throw toApiError(err)
  }

  return toSSEResponse(started.events, {
    signal: req.signal,
    onDone: async (done) => {
      const html = cleanFragment(done.text)
      const warnings = body.mode === 'rewrite' ? computeAiEditWarnings(body.selectedText, html, article.primaryKeyword ?? article.keywords[0] ?? null) : []
      // `result` isn't part of the frozen AIStreamEvent union; toSSEResponse only serialises it.
      return [{ type: 'result', html, warnings } satisfies AiEditResultEvent as unknown as AIStreamEvent]
    },
  })
})
