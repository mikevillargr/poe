import 'server-only'
import type { AppUser } from '@/lib/auth/guards'
import type { Article } from '@/lib/articles/repo'
import { modelRef, streamForRole } from '@/lib/ai/roles'
import { buildGenerationPrompt } from '@/lib/prompts/generation'
import { getActiveGuidelines } from './guidelines'
import { readResearch } from './research'
import { persistGeneratedDraft } from './generate'
import { snapshotDraft } from './versions'
import { tapStream, toApiError } from './stream'
import { drive, reserveRun, setRunState, type Run } from './runs'
import { draftInputs } from '@/lib/articles/draft-inputs'
import { claimOwnerIfUnassigned } from '@/lib/articles/owner'

/** True when the article has a usable research brief (summary, outline or sources). */
export function articleHasResearch(article: Pick<Article, 'research'>): boolean {
  const r = readResearch(article.research)
  return !!r && !!(r.summary?.trim() || r.outlineHtml?.trim() || r.citations.length)
}

/**
 * Starts the standard (non-template) draft as a detached run: research brief (when wanted and present) +
 * guidelines → streamed HTML → saved as a version. A non-empty current draft is first kept as "Before regenerate".
 * Used by the Generate button's route and by "Generate queued". Throws (409) if a generation is already running.
 */
export async function startStandardGeneration(
  client: { id: string; name: string },
  article: Article,
  user: AppUser,
  opts: { useResearch?: boolean } = {},
): Promise<Run> {
  const run = reserveRun('generation', article.id)
  const inputs = draftInputs(article)
  try {
    await claimOwnerIfUnassigned(client.id, article.id, user)
    const research = readResearch(article.research)
    const useResearch = articleHasResearch(article) && opts.useResearch !== false
    const previousState = article.draftHtml?.trim() ? 'ready' : 'idle'
    const guidelines = await getActiveGuidelines(client.id, article.templateId)
    const prompt = buildGenerationPrompt(article, {
      clientName: client.name,
      guidelines,
      research: useResearch ? research : null,
    })
    let started: Awaited<ReturnType<typeof streamForRole>>
    try {
      started = await streamForRole(
        'generation',
        { system: prompt.system, messages: prompt.messages, maxTokens: prompt.maxTokens, signal: run.ac.signal },
        { tenantId: client.id, articleId: article.id, userId: user.id },
      )
    } catch (err) {
      throw toApiError(err)
    }
    const model = modelRef(started.resolved)
    const snapshot = await snapshotDraft(article, user, 'Before regenerate')
    await setRunState('generation', client.id, article.id, 'running')
    const { events } = tapStream(started.events, {
      onFailed: () => setRunState('generation', client.id, article.id, 'error'),
      onIncomplete: () => setRunState('generation', client.id, article.id, previousState),
    })
    drive(run, events, {
      onPersistError: () => setRunState('generation', client.id, article.id, 'error'),
      onDone: async (done) => {
        const saved = await persistGeneratedDraft(client.id, article.id, done.text, model, user, {
          usedResearch: useResearch,
          snapshotVersionNo: snapshot?.versionNo ?? null,
          inputs,
        })
        await setRunState('generation', client.id, article.id, 'ready')
        return [{ type: 'saved', articleId: article.id, versionNo: saved.versionNo }]
      },
    })
  } catch (err) {
    run.release()
    throw err
  }
  return run
}
