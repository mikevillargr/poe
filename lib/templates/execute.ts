// Runs one templated generation: hooks → link selectors → writer → assemble → checks → one retry.
// Pure orchestration: model calls, page fetches and event emission are injected, so this is tested
// with fakes and driven for real by run.ts.

import type { AIStreamEvent } from '@/lib/ai/types'
import { assemble } from './assembly'
import { failedChecks, retryInstructions, runChecks } from './checks'
import { planCityDirectory, type DirectoryRow } from './hooks/city-directory'
import { productDetailsFromPage } from './hooks/product-page'
import { ctaStyleFor, planFifaLinks, planTribeLinks, selectedUrlsText, type LinkPlan } from './hooks/united-tribes'
import { markdownToHtml } from './markdown'
import { parseWordRange, renderPlaceholders } from './placeholders'
import { extractUrls, filterToCandidates, formatSectioned, formatUrlList, parseSectionedUrls } from './selector'
import type { ResolvedFacts } from './facts'
import type { AssembledOutput, CheckResult, TemplateConfig } from './types'
import { inventoryUrls, resolveValues, type ArticleValues, type InventoryRow } from './values'

export class TemplateRunError extends Error {
  constructor(
    public code: 'MISSING_VALUE' | 'PRODUCT_PAGE' | 'EMPTY_OUTPUT',
    message: string,
  ) {
    super(message)
  }
}

export interface ExecuteDeps {
  /** Link-selector call (utility model); returns the raw text. */
  select(prompt: string, maxTokens: number): Promise<string>
  /** Writer call (generation model), streamed. */
  write(prompt: string, maxTokens: number): AsyncIterable<AIStreamEvent>
  fetchPage(url: string): Promise<string>
  emit(ev: AIStreamEvent): void
  /** How often to push a rendered preview while the writer streams (ms). */
  previewEveryMs?: number
}

export interface ExecuteInput {
  config: TemplateConfig
  article: ArticleValues
  inputs: Record<string, string | number | null>
  inventories: Record<string, InventoryRow[]>
  facts: ResolvedFacts
  /** Rendered {{GUIDELINES}} text (only used when a prompt has the placeholder). */
  guidelines?: string
  /** Research brief appended to the writer prompt when the template has research on. */
  research?: string | null
  now?: Date
}

export interface ExecuteResult {
  html: string
  output: AssembledOutput
  checks: CheckResult[]
  needsReview: boolean
  retried: boolean
  selectedLinks: string[]
  droppedLinks: string[]
  ctaStyle?: string
}

function render(text: string, values: Record<string, string>, where: string): string {
  const { text: out, missing } = renderPlaceholders(text, values)
  if (missing.length) throw new TemplateRunError('MISSING_VALUE', `${where} needs ${missing.map((m) => `{{${m}}}`).join(', ')}, which has no value.`)
  return out
}

export interface PreparedRun {
  values: Record<string, string>
  /** The fully rendered writer prompt (research brief appended when given). */
  prompt: string
  selectedLinks: string[]
  droppedLinks: string[]
  supplied: string[]
  ctaStyle?: string
}

/**
 * Everything before the writer: values, hooks, link selection and the rendered prompt. With
 * `runSelectors: false` (the editor's free "Preview prompt"), link steps aren't called and their outputs
 * show a note instead.
 */
export async function prepareTemplateRun(
  deps: Pick<ExecuteDeps, 'select' | 'fetchPage' | 'emit'>,
  input: ExecuteInput,
  opts: { runSelectors?: boolean } = {},
): Promise<PreparedRun> {
  const runSelectors = opts.runSelectors ?? true
  const { config, article, inputs, inventories, facts } = input
  const values = resolveValues(config, article, inputs, inventories, input.now)
  const candidateUrls = inventoryUrls(config, inventories)
  if (input.guidelines !== undefined) values.GUIDELINES = input.guidelines
  const topic = `${article.title} ${article.brief ?? ''}`.toLowerCase()
  const supplied: string[] = []
  let linkPlan: LinkPlan | null = null
  let ctaStyle: string | undefined

  // ── hooks ──────────────────────────────────────────────────────────────────────────────────
  for (const hook of config.hooks) {
    const inv = hook.options?.inventory ? (inventories[hook.options.inventory] ?? []) : []
    if (hook.id === 'product-page') {
      const url = String(inputs[hook.options?.urlInput ?? 'itemUrl'] ?? '').trim()
      if (!url) throw new TemplateRunError('PRODUCT_PAGE', 'This row has no product URL.')
      deps.emit({ type: 'step', step: 'reading', label: 'Reading the product page' })
      const details = productDetailsFromPage(await deps.fetchPage(url), facts.productPageClasses)
      if (!details) throw new TemplateRunError('PRODUCT_PAGE', `No product description was found on ${url}, so the FAQ wasn't generated.`)
      values.PRODUCT_DETAILS = details
    } else if (hook.id === 'ut-tribe-links') {
      linkPlan = planTribeLinks(topic, inv.map((i) => i.url), facts.utTribes, facts.utGeneralFallback)
      values.AGGREGATED_URLS = linkPlan.candidates.join('\n')
      candidateUrls.AGGREGATED_URLS = linkPlan.candidates
      values.CONTEXT_NOTE = linkPlan.contextNote
    } else if (hook.id === 'fifa-links') {
      linkPlan = planFifaLinks(topic, inv.map((i) => i.url), facts.utTribes)
      values.AGGREGATED_URLS = linkPlan.candidates.join('\n')
      candidateUrls.AGGREGATED_URLS = linkPlan.candidates
    } else if (hook.id === 'ut-cta-style') {
      ctaStyle = ctaStyleFor(Number(inputs.ctaIndex ?? 0), facts.utCtaStyles)
      values.CTA_STYLE = ctaStyle
    } else if (hook.id === 'fifa-city-directory') {
      const rows: DirectoryRow[] = inv.map((i) => ({
        url: i.url,
        label: i.title ?? undefined,
        city: i.attrs?.city,
        tribe: i.attrs?.tribe ?? i.attrs?.heritage ?? i.attrs?.community,
      }))
      const plan = planCityDirectory(topic, rows, facts.fifaCities, facts.utTribes)
      values.CITY_DIRECTORY_LINKS = plan.text
      values.DETECTED_CITY = plan.city
      supplied.push(...plan.links.map((l) => l.url))
    }
  }

  // ── link selectors (utility model) ─────────────────────────────────────────────────────────
  const selectedLinks: string[] = []
  const droppedLinks: string[] = []
  if (config.selectors.length) deps.emit({ type: 'step', step: 'selecting', label: 'Choosing internal links' })
  for (const step of config.selectors) {
    const candidateText = step.candidates.map((p) => values[p] ?? '').join('\n')
    if (!candidateText.trim()) {
      values[step.output] = ''
      continue
    }
    if (!runSelectors) {
      values[step.output] = `[links chosen by the "${step.id}" step at run time]`
      continue
    }
    const raw = await deps.select(render(step.prompt, values, `The "${step.id}" link step`), step.maxTokens)
    const candidates = step.candidates.flatMap((p) => candidateUrls[p] ?? extractUrls(values[p] ?? ''))
    if (step.format === 'sections') {
      const s = parseSectionedUrls(raw)
      const a = filterToCandidates(s.articles, candidates)
      const p = filterToCandidates(s.products, candidates)
      values[step.output] = formatSectioned({ articles: a.kept, products: p.kept })
      selectedLinks.push(...a.kept, ...p.kept)
      droppedLinks.push(...a.dropped, ...p.dropped)
    } else {
      const f = filterToCandidates(extractUrls(raw), candidates)
      const kept = step.format === 'single-url' ? f.kept.slice(0, 1) : f.kept
      values[step.output] = step.format === 'single-url' ? (kept[0] ?? '') : formatUrlList(kept)
      selectedLinks.push(...kept)
      droppedLinks.push(...f.dropped)
    }
  }
  if (linkPlan) values.SELECTED_URLS = selectedUrlsText(linkPlan, values.SELECTED_URLS ?? '')
  supplied.push(...selectedLinks)
  for (const v of ['PAGE_URL', 'ITEM_URL']) if (values[v]) supplied.push(values[v])

  let prompt = render(config.writerPrompt, values, 'The writer prompt')
  if (input.research?.trim()) prompt += `\n\nRESEARCH BRIEF (live web research for this article; use it for facts and figures):\n${input.research.trim()}`
  return { values, prompt, selectedLinks, droppedLinks, supplied, ctaStyle }
}

export async function executeTemplate(deps: ExecuteDeps, input: ExecuteInput): Promise<ExecuteResult> {
  const { config, article } = input
  const { values, prompt, selectedLinks, droppedLinks, supplied, ctaStyle } = await prepareTemplateRun(deps, input)

  // ── writer (generation model), checks, one retry ───────────────────────────────────────────
  const wordRange = parseWordRange(config.values.WORD_COUNT ? values.WORD_COUNT : (config.defaultWordCount ?? ''))
  const checkCtx = {
    markers: config.markers,
    wordRange,
    suppliedUrls: supplied,
    ctaUrls: config.ctaUrls,
    leadIns: config.leadIns,
  }
  const fallbackTitle = config.titlePlaceholder ? values[config.titlePlaceholder] || article.title : article.title

  let best: { output: AssembledOutput; checks: CheckResult[]; failed: number } | null = null
  let retried = false
  for (let attempt = 1; attempt <= 2; attempt++) {
    const failedBefore = best ? failedChecks(best.checks) : []
    if (attempt === 2) {
      retried = true
      deps.emit({ type: 'step', step: 'retrying', label: `Rewriting to fix ${failedBefore.length} failed ${failedBefore.length === 1 ? 'check' : 'checks'}` })
      deps.emit({ type: 'reset', reason: 'retry' })
    } else {
      deps.emit({ type: 'step', step: 'writing', label: 'Writing the draft' })
    }
    const text = await streamWriter(deps, attempt === 2 ? prompt + '\n' + retryInstructions(failedBefore) : prompt, config, fallbackTitle)
    const output = assemble({ recipe: config.assembly, response: text, markers: config.markers, blogCleanup: config.blogCleanup, fallbackTitle })
    deps.emit({ type: 'step', step: 'checking', label: 'Checking the draft' })
    const checks = runChecks(output, config.checks, checkCtx)
    const failed = failedChecks(checks).length
    if (!best || failed < best.failed) best = { output, checks, failed }
    if (!failed) break
  }

  const html = markdownToHtml(best!.output.markdown)
  if (!html.trim()) throw new TemplateRunError('EMPTY_OUTPUT', 'The model returned an empty draft.')
  return {
    html,
    output: best!.output,
    checks: best!.checks,
    needsReview: best!.failed > 0,
    retried,
    selectedLinks,
    droppedLinks,
    ctaStyle,
  }
}

/** Streams the writer, pushing a rendered HTML preview (reset + full delta) at most every N ms. */
async function streamWriter(deps: ExecuteDeps, prompt: string, config: TemplateConfig, fallbackTitle: string): Promise<string> {
  const every = deps.previewEveryMs ?? 400
  let text = ''
  let last = 0
  const preview = () => {
    const md = assemble({ recipe: config.assembly, response: text, markers: config.markers, blogCleanup: config.blogCleanup, fallbackTitle }).markdown
    deps.emit({ type: 'reset' })
    deps.emit({ type: 'delta', text: markdownToHtml(md) })
  }
  for await (const ev of deps.write(prompt, config.writerMaxTokens)) {
    if (ev.type === 'delta') {
      text += ev.text
      const now = Date.now()
      if (now - last >= every) {
        last = now
        preview()
      }
    } else if (ev.type === 'done') {
      text = ev.text || text
    } else if (ev.type === 'error') {
      throw Object.assign(new Error(ev.message), { code: ev.code })
    }
  }
  preview()
  return text
}
