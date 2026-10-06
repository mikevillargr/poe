import 'server-only'
import { AIError, type AIStreamEvent } from '@/lib/ai/types'
import { generateForRole, modelRef, streamForRole } from '@/lib/ai/roles'
import { ApiError, Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import type { Article } from '@/lib/articles/repo'
import { categoryLabel } from '@/lib/guidelines/categories'
import { renderGuidelineTiers } from '@/lib/guidelines/render'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { persistGeneratedDraft } from '@/lib/pipeline/generate'
import { readResearch } from '@/lib/pipeline/research'
import { reserveRun, setRunState, type Run } from '@/lib/pipeline/runs'
import { snapshotDraft } from '@/lib/pipeline/versions'
import { stripTags } from '@/lib/pipeline/html'
import { executeTemplate, TemplateRunError, type ExecuteDeps } from './execute'
import { getClientFacts, getTemplate, inventoryItems, saveGenerationMeta, type TemplateRow } from './repo'
import { listPlaceholders } from './placeholders'
import { inventoriesUsed, type InventoryRow } from './values'
import type { ResolvedFacts } from './facts'

const PAGE_TIMEOUT_MS = 30_000
const PAGE_MAX_BYTES = 3_000_000

interface ClientLike {
  id: string
  name: string
  website: string | null
}

/** The product-page hook only fetches https pages on the client's allowed hosts (facts, else its website). */
export async function fetchProductPage(url: string, facts: ResolvedFacts, client: ClientLike, signal?: AbortSignal): Promise<string> {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    throw new TemplateRunError('PRODUCT_PAGE', `“${url}” isn’t a valid URL.`)
  }
  const hosts = facts.productPageHosts.length ? facts.productPageHosts : client.website ? [new URL(client.website).hostname] : []
  const host = target.hostname.toLowerCase()
  if (target.protocol !== 'https:' || !hosts.some((h) => host === h.toLowerCase() || host === `www.${h.toLowerCase()}`)) {
    throw new TemplateRunError('PRODUCT_PAGE', `Poe only reads product pages on ${hosts.join(', ') || 'the client’s website'} (got ${target.hostname}).`)
  }
  const timeout = AbortSignal.timeout(PAGE_TIMEOUT_MS)
  const res = await fetch(target, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { 'User-Agent': 'Poe content hub (product FAQ)' },
    redirect: 'follow',
  }).catch((err) => {
    if (signal?.aborted) throw err
    throw new TemplateRunError('PRODUCT_PAGE', `Could not load the product page: ${err instanceof Error ? err.message : 'network error'}.`)
  })
  if (!res.ok) throw new TemplateRunError('PRODUCT_PAGE', `The product page returned ${res.status}.`)
  const html = await res.text()
  return html.length > PAGE_MAX_BYTES ? html.slice(0, PAGE_MAX_BYTES) : html
}

function guidelinesText(groups: Awaited<ReturnType<typeof getActiveGuidelines>>): string {
  return renderGuidelineTiers(groups, (g) => `### ${categoryLabel(g.category)}\n${g.rules.map((r) => `- ${r.title ? `${r.title}: ` : ''}${r.rule}`).join('\n')}`)
}

function researchText(article: Article): string | null {
  const r = readResearch(article.research)
  if (!r) return null
  const sources = r.citations
    .filter((c) => !(c as { excluded?: boolean }).excluded)
    .map((c) => `[${c.id}] ${c.title ? `${c.title} — ` : ''}${c.url}`)
  const parts = [r.summary?.trim(), r.outlineHtml?.trim() && `Outline:\n${stripTags(r.outlineHtml).trim()}`, sources.length && `Sources:\n${sources.join('\n')}`]
  const text = parts.filter(Boolean).join('\n\n')
  return text || null
}

function toEventError(err: unknown): AIStreamEvent {
  const code = err instanceof TemplateRunError || err instanceof AIError || err instanceof ApiError ? err.code : 'PROVIDER_ERROR'
  return { type: 'error', code, message: err instanceof Error ? err.message : 'Generation failed.' }
}

/**
 * Starts a templated generation as a detached run (same slot, status columns and snapshot behaviour as
 * the generic generate route) and returns the run. Setup problems (template gone, disabled) throw
 * before anything starts.
 */
export async function startTemplateGeneration(client: ClientLike, article: Article, user: AppUser): Promise<Run> {
  if (!article.templateId) throw Errors.badRequest('This article has no template.')
  let template: TemplateRow
  try {
    template = await getTemplate(client.id, article.templateId)
  } catch {
    throw Errors.badRequest('This article’s template was removed. Choose another template or clear it.')
  }
  if (!template.enabled) throw Errors.badRequest(`The “${template.name}” template is disabled.`)

  const run = reserveRun('generation', article.id)
  try {
    const [facts, inventories, guidelines] = await Promise.all([
      getClientFacts(client.id),
      loadInventories(client.id, inventoriesUsed(template.config)),
      usesGuidelines(template) ? getActiveGuidelines(client.id, template.id).then(guidelinesText) : Promise.resolve(undefined),
    ])
    const previousState = article.draftHtml?.trim() ? 'ready' : 'idle'
    const snapshot = await snapshotDraft(article, user, 'Before regenerate')
    await setRunState('generation', client.id, article.id, 'running')

    const ctx = { tenantId: client.id, articleId: article.id, userId: user.id }
    const models: { utility?: string; generation?: string } = {}
    const signal = run.ac.signal
    const deps: ExecuteDeps = {
      emit: (ev) => run.emit(ev),
      async select(prompt, maxTokens) {
        const params = { messages: [{ role: 'user' as const, content: prompt }], maxTokens, signal }
        try {
          const r = await generateForRole('utility', params, ctx)
          models.utility = modelRef(r.resolved)
          return r.text
        } catch (err) {
          if (signal.aborted) throw err
          // The utility model may be unset, retired or failing: link selection falls back to generation.
          console.warn('[templates] utility model failed, using the generation model:', err instanceof Error ? err.message : err)
          const r = await generateForRole('generation', params, ctx)
          models.utility = modelRef(r.resolved)
          return r.text
        }
      },
      async *write(prompt, maxTokens) {
        const started = await streamForRole('generation', { messages: [{ role: 'user', content: prompt }], maxTokens, signal }, ctx)
        models.generation = modelRef(started.resolved)
        yield* started.events
      },
      fetchPage: (url) => fetchProductPage(url, facts, client, signal),
    }

    run.start(async () => {
      try {
        const result = await executeTemplate(deps, {
          config: template.config,
          article: {
            title: article.title,
            brief: article.brief,
            primaryKeyword: article.primaryKeyword,
            keywords: article.keywords,
            targetWordCount: article.targetWordCount,
          },
          inputs: (article.templateInputs as Record<string, string | number | null> | null) ?? {},
          inventories,
          facts,
          guidelines,
          research: template.config.researchEnabled ? researchText(article) : null,
        })
        const saved = await persistGeneratedDraft(client.id, article.id, result.html, models.generation ?? 'unknown', user, {
          usedResearch: template.config.researchEnabled && !!article.research,
          snapshotVersionNo: snapshot?.versionNo ?? null,
        })
        await saveGenerationMeta(client.id, article.id, {
          templateId: template.id,
          revisionNo: template.revisionNo,
          metaTitle: result.output.metaTitle,
          metaDescription: result.output.metaDescription,
          tldr: result.output.tldr,
          selectedLinks: result.selectedLinks,
          droppedLinks: result.droppedLinks,
          checks: result.checks,
          needsReview: result.needsReview,
          retried: result.retried,
          ctaStyle: result.ctaStyle,
          models,
          generatedAt: new Date().toISOString(),
        })
        await setRunState('generation', client.id, article.id, 'ready')
        const failed = result.checks.filter((c) => !c.ok).length
        run.emit({
          type: 'step',
          step: result.needsReview ? 'needs-review' : 'done',
          label: result.needsReview ? `Saved for review: ${failed} ${failed === 1 ? 'check' : 'checks'} still failing` : 'All checks passed',
        })
        run.emit({ type: 'done', text: result.html })
        run.emit({ type: 'saved', articleId: article.id, versionNo: saved.versionNo })
      } catch (err) {
        if (signal.aborted) {
          await setRunState('generation', client.id, article.id, previousState).catch(() => {})
          return
        }
        console.error('[templates] generation failed:', err)
        await setRunState('generation', client.id, article.id, 'error').catch(() => {})
        run.emit(toEventError(err))
      }
    })
  } catch (err) {
    run.release()
    throw err
  }
  return run
}

function usesGuidelines(t: TemplateRow): boolean {
  return [t.config.writerPrompt, ...t.config.selectors.map((s) => s.prompt)].some((p) => listPlaceholders(p).includes('GUIDELINES'))
}

async function loadInventories(tenantId: string, slugs: string[]): Promise<Record<string, InventoryRow[]>> {
  const entries = await Promise.all(slugs.map(async (s) => [s, await inventoryItems(tenantId, s)] as const))
  return Object.fromEntries(entries)
}
