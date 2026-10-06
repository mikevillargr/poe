// Resolves a template's {{PLACEHOLDER}} values from the article row, its template inputs and the
// client's link inventories (pure; the runtime loads the data).
import { currentYear, resolveWordCount } from './placeholders'
import type { TemplateConfig, ValueSource } from './types'

export interface ArticleValues {
  title: string
  brief: string | null
  primaryKeyword: string | null
  keywords: string[]
  targetWordCount: number | null
}

export interface InventoryRow {
  url: string
  title: string | null
  attrs: Record<string, string> | null
}

/**
 * One line per item from a format like `{title}-{url}` or `{attr.city}: {url}`. An item missing any
 * field the format uses is skipped (n8n only listed rows with both a title and a link).
 */
export function formatInventory(items: InventoryRow[], format: string): string {
  return items
    .map((item) => {
      let complete = true
      const line = format.replace(/\{(url|title|attr\.[a-z0-9_]+)\}/gi, (_m, key: string) => {
        const v = key === 'url' ? item.url : key === 'title' ? item.title : item.attrs?.[key.slice(5)]
        if (!v?.trim()) complete = false
        return v?.trim() ?? ''
      })
      return complete ? line : null
    })
    .filter((l): l is string => l !== null)
    .join('\n')
}

/** Inventory slugs a template reads, from value sources and hook options. */
export function inventoriesUsed(config: TemplateConfig): string[] {
  const slugs = new Set<string>()
  for (const v of Object.values(config.values)) if (v.from === 'inventory') slugs.add(v.inventory)
  for (const h of config.hooks) if (h.options?.inventory) slugs.add(h.options.inventory)
  return [...slugs]
}

export function resolveValue(
  source: ValueSource,
  article: ArticleValues,
  inputs: Record<string, string | number | null>,
  inventories: Record<string, InventoryRow[]>,
  config: TemplateConfig,
  now: Date,
): string {
  switch (source.from) {
    case 'article':
      return (article[source.field] ?? '').toString()
    case 'keywords':
      return article.keywords.length ? article.keywords.join(', ') : (source.empty ?? '')
    case 'input': {
      const v = inputs[source.key]
      return v === null || v === undefined || v === '' ? (source.fallback ?? '') : String(v)
    }
    case 'wordCount': {
      // The sheet's own text ("1500-2000") when the row came from a sheet, else the stored number.
      const text = inputs.wordCount
      return resolveWordCount(typeof text === 'string' && text.trim() ? text : article.targetWordCount, config.defaultWordCount)
    }
    case 'currentYear':
      return currentYear(now)
    case 'inventory':
      return formatInventory(inventories[source.inventory] ?? [], source.format)
  }
}

export function resolveValues(
  config: TemplateConfig,
  article: ArticleValues,
  inputs: Record<string, string | number | null>,
  inventories: Record<string, InventoryRow[]>,
  now = new Date(),
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config.values).map(([name, source]) => [name, resolveValue(source, article, inputs, inventories, config, now)]),
  )
}

/** Candidate URLs behind each inventory-backed placeholder (selectors validate against these, not the text). */
export function inventoryUrls(config: TemplateConfig, inventories: Record<string, InventoryRow[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [name, source] of Object.entries(config.values)) {
    if (source.from === 'inventory') out[name] = (inventories[source.inventory] ?? []).map((i) => i.url)
  }
  return out
}
