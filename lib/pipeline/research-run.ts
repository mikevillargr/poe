import 'server-only'
import type { AppUser } from '@/lib/auth/guards'
import type { Article } from '@/lib/articles/repo'
import { researchForRole, modelRef } from '@/lib/ai/roles'
import { buildResearchPrompt } from '@/lib/prompts/research'
import { parseResearchOutput, writeResearch } from './research'
import { drive, reserveRun, setRunState, type Run } from './runs'
import { logArticleEvent, tapStream, toApiError } from './stream'
import { claimOwnerIfUnassigned } from '@/lib/articles/owner'

/**
 * Starts live web research for an article as a detached run (lib/pipeline/runs.ts): it finishes and saves even
 * if nobody is watching. Used by the Research button's route and by "Generate queued". Throws (409) if a research
 * run is already going for this article.
 */
export async function startResearch(client: { id: string }, article: Article, user: AppUser): Promise<Run> {
  const run = reserveRun('research', article.id)
  try {
    await claimOwnerIfUnassigned(client.id, article.id, user)
    const previousState = article.research ? 'ready' : 'idle'
    const prompt = buildResearchPrompt(article)
    let started: Awaited<ReturnType<typeof researchForRole>>
    try {
      started = await researchForRole(
        { system: prompt.system, messages: prompt.messages, maxTokens: prompt.maxTokens, maxSearches: prompt.maxSearches, signal: run.ac.signal },
        { tenantId: client.id, articleId: article.id, userId: user.id },
      )
    } catch (err) {
      throw toApiError(err)
    }
    const model = modelRef(started.resolved)
    await setRunState('research', client.id, article.id, 'running')
    const { events, tap } = tapStream(started.events, {
      onFailed: () => setRunState('research', client.id, article.id, 'error'),
      onIncomplete: () => setRunState('research', client.id, article.id, previousState),
    })
    drive(run, events, {
      onPersistError: () => setRunState('research', client.id, article.id, 'error'),
      onDone: async (done) => {
        const research = parseResearchOutput(done.text, done.citations?.length ? done.citations : tap.citations, tap.queries)
        await writeResearch(client.id, article.id, research, user.id)
        await setRunState('research', client.id, article.id, 'ready', { researchModel: model })
        await logArticleEvent(client.id, article.id, 'researched', user.id, {
          model,
          citations: research.citations.length,
          queries: research.queries.length,
        })
        return [{ type: 'saved', articleId: article.id }]
      },
    })
  } catch (err) {
    run.release()
    throw err
  }
  return run
}
