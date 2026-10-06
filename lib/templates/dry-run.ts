import 'server-only'
import { generateForRole, modelRef, streamForRole } from '@/lib/ai/roles'
import type { AppUser } from '@/lib/auth/guards'
import { getArticle } from '@/lib/articles/repo'
import { getActiveGuidelines } from '@/lib/pipeline/guidelines'
import { categoryLabel } from '@/lib/guidelines/categories'
import { executeTemplate, prepareTemplateRun, type ExecuteDeps, type ExecuteInput } from './execute'
import { getClientFacts, inventoryItems } from './repo'
import { fetchProductPage } from './run'
import { listPlaceholders } from './placeholders'
import type { TemplateConfig } from './types'
import { inventoriesUsed } from './values'

// Template editor dry runs (DR-010), on the unsaved config: "Preview prompt" (no AI), "Test link step"
// (utility model only) and "Test full draft" (writer + checks, nothing saved).

export type DryRunMode = 'prompt' | 'links' | 'draft'

export interface DryRunSample {
  articleId?: string
  title?: string
  brief?: string
  keywords?: string[]
  wordCount?: number | null
  inputs?: Record<string, string>
}

export async function dryRunTemplate(
  client: { id: string; name: string; website: string | null },
  templateId: string | null,
  config: TemplateConfig,
  sample: DryRunSample,
  mode: DryRunMode,
  user: AppUser,
) {
  let article: ExecuteInput['article']
  let inputs: Record<string, string | number | null> = {}
  if (sample.articleId) {
    const a = await getArticle(client.id, sample.articleId)
    article = { title: a.title, brief: a.brief, primaryKeyword: a.primaryKeyword, keywords: a.keywords, targetWordCount: a.targetWordCount }
    inputs = (a.templateInputs as Record<string, string | number | null> | null) ?? {}
  } else {
    article = {
      title: sample.title?.trim() || 'Sample article title',
      brief: sample.brief?.trim() || null,
      primaryKeyword: sample.keywords?.[0] ?? null,
      keywords: sample.keywords ?? [],
      targetWordCount: sample.wordCount ?? null,
    }
  }
  inputs = { ...inputs, ...(sample.inputs ?? {}) }

  const [facts, inventoryEntries, guidelines] = await Promise.all([
    getClientFacts(client.id),
    Promise.all(inventoriesUsed(config).map(async (s) => [s, await inventoryItems(client.id, s)] as const)),
    [config.writerPrompt, ...config.selectors.map((s) => s.prompt)].some((p) => listPlaceholders(p).includes('GUIDELINES'))
      ? getActiveGuidelines(client.id, templateId)
      : Promise.resolve(null),
  ])
  const input: ExecuteInput = {
    config,
    article,
    inputs,
    inventories: Object.fromEntries(inventoryEntries),
    facts,
    guidelines: guidelines
      ? guidelines.map((g) => `### ${categoryLabel(g.category)}\n${g.rules.map((r) => `- ${r.title ? `${r.title}: ` : ''}${r.rule}`).join('\n')}`).join('\n\n')
      : undefined,
  }
  const ctx = { tenantId: client.id, userId: user.id }
  const models: { utility?: string; generation?: string } = {}
  const deps: ExecuteDeps = {
    previewEveryMs: 1e9,
    emit: () => {},
    fetchPage: (url) => fetchProductPage(url, facts, client),
    async select(prompt, maxTokens) {
      const params = { messages: [{ role: 'user' as const, content: prompt }], maxTokens }
      const r = await generateForRole('utility', params, ctx).catch(() => generateForRole('generation', params, ctx))
      models.utility = modelRef(r.resolved)
      return r.text
    },
    async *write(prompt, maxTokens) {
      const started = await streamForRole('generation', { messages: [{ role: 'user', content: prompt }], maxTokens }, ctx)
      models.generation = modelRef(started.resolved)
      yield* started.events
    },
  }

  if (mode !== 'draft') {
    const p = await prepareTemplateRun(deps, input, { runSelectors: mode === 'links' })
    return { mode, prompt: p.prompt, selectedLinks: p.selectedLinks, droppedLinks: p.droppedLinks, ctaStyle: p.ctaStyle, models }
  }
  const r = await executeTemplate(deps, input)
  return {
    mode,
    html: r.html,
    checks: r.checks,
    needsReview: r.needsReview,
    retried: r.retried,
    metaTitle: r.output.metaTitle,
    metaDescription: r.output.metaDescription,
    selectedLinks: r.selectedLinks,
    droppedLinks: r.droppedLinks,
    models,
  }
}
