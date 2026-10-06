// DR-015: what a sheet must look like for each kind of import, generated from the same definitions the
// importers read (lib/import/mapping.ts, template inputs, lib/templates/rows.ts), so the guide can't drift.
// Pure: used by the Sheet format panel, the sample download and the shareable format page.

export interface FormatColumn {
  /** Header to put in row 1 of the sample. */
  header: string
  required: boolean
  meaning: string
  /** Other header names Poe recognises for this column. */
  alsoAccepted: string[]
  /** Two example values for the sample rows. */
  examples: [string, string]
}

export interface SheetFormat {
  id: string
  title: string
  intro: string
  /** False for headerless shapes (tribe pages): no header row in the sample. */
  headerRow: boolean
  columns: FormatColumn[]
  notes: string[]
}

/** The subset of a template the formats need (TemplateOption on the client, config on the server). */
export interface FormatTemplate {
  id: string
  name: string
  kind: 'faq' | 'blog' | 'page'
  inputs: { key: string; label: string; required?: boolean; aliases?: string[] }[]
}

// Display names for the generic calendar aliases in lib/import/mapping.ts (it matches loosely beyond these).
const CALENDAR: Record<string, Omit<FormatColumn, 'header' | 'required'> & { header: string }> = {
  title: {
    header: 'Title',
    meaning: 'The article title, used as written.',
    alsoAccepted: ['Article title', 'Topic', 'Headline', 'Name'],
    examples: ['How to Choose Your First Automatic Watch', 'Seiko vs Citizen: Which Is Better Value?'],
  },
  brief: {
    header: 'Brief',
    meaning: 'What the article should cover: angle, audience, must-mention points.',
    alsoAccepted: ['Description', 'Summary', 'Notes', 'Outline'],
    examples: ['Beginner guide: movement types, sizes, budget; end with 3 picks.', 'Compare price, movement and finishing for 3 popular models.'],
  },
  keywords: {
    header: 'Keywords',
    meaning: 'SEO keywords, comma-separated. The first one is the primary keyword.',
    alsoAccepted: ['SEO keywords', 'Target keywords', 'Focus keyword', 'Tags'],
    examples: ['automatic watch, first watch, watch buying guide', 'seiko vs citizen, best value watch'],
  },
  wordcount: {
    header: 'Word count',
    meaning: 'Target length in words (a number, or a range like 1500-2000).',
    alsoAccepted: ['Words', 'Target word count', 'Number of words', 'Length'],
    examples: ['1500', '1200-1500'],
  },
}

const KNOWN_INPUTS: Record<string, { meaning: string; examples: [string, string] }> = {
  itemUrl: { meaning: 'Link to the product page the content is about.', examples: ['https://example.com/products/item-123', 'https://example.com/products/item-456'] },
  productName: { meaning: 'The product’s name as it appears on the site.', examples: ['Tissot PRX Powermatic 80', 'Seiko 5 Sports SRPD55'] },
  pageUrl: { meaning: 'The page this content is for.', examples: ['https://example.com/page-one', 'https://example.com/page-two'] },
}

export function calendarFormat(): SheetFormat {
  return {
    id: 'calendar',
    title: 'Content calendar',
    intro: 'One row per article. Only Title is required; the rest fill the brief.',
    headerRow: true,
    columns: (['title', 'brief', 'keywords', 'wordcount'] as const).map((k) => ({ ...CALENDAR[k], required: k === 'title' })),
    notes: ['The header row can be anywhere in the first rows; Poe finds it.', 'Extra columns are ignored.'],
  }
}

export function templateFormat(t: FormatTemplate, communityPrefix = 'https://unitedtribes.com/community/'): SheetFormat {
  if (t.kind === 'page') {
    return {
      id: `tpl-${t.id}`,
      title: t.name,
      intro: 'No header row needed. Each row with a community page link becomes one page; keyword cells carry their search volume in brackets.',
      headerRow: false,
      columns: [
        { header: 'Page link', required: true, meaning: `The community page URL (starts with ${communityPrefix}).`, alsoAccepted: [], examples: [`${communityPrefix}mexican`, `${communityPrefix}filipino`] },
        { header: 'Keyword', required: false, meaning: 'A keyword with its volume, e.g. “mexican food (1,200)”. Add as many keyword cells as needed.', alsoAccepted: [], examples: ['mexican food near me (1,200)', 'filipino restaurants (880)'] },
        { header: 'Keyword', required: false, meaning: 'Another keyword cell (optional).', alsoAccepted: [], examples: ['mexican culture events (390)', 'filipino festivals (210)'] },
      ],
      notes: ['The first keyword cell names the page (e.g. “Mexican”).', 'Rows without a community link are skipped.'],
    }
  }
  const columns: FormatColumn[] = t.inputs.map((f) => {
    const generic = CALENDAR[f.key]
    const known = KNOWN_INPUTS[f.key]
    // Only the template's own names: live sheet sync matches nothing else (lib/templates/rows.ts columnSpecs).
    const aliases = [...new Set(f.aliases ?? [])].filter((a) => a.toLowerCase() !== f.label.toLowerCase())
    return {
      header: f.label,
      required: !!f.required || f.key === 'title',
      meaning: generic?.meaning ?? known?.meaning ?? `${f.label} for each row.`,
      alsoAccepted: aliases,
      examples: generic?.examples ?? known?.examples ?? [`${f.label} 1`, `${f.label} 2`],
    }
  })
  return {
    id: `tpl-${t.id}`,
    title: t.name,
    intro: `One row per ${t.kind === 'faq' ? 'FAQ' : 'article'}. Columns are matched by name, so the order doesn’t matter.`,
    headerRow: true,
    columns,
    notes: ['Extra columns are ignored.'],
  }
}

export function linkListFormat(): SheetFormat {
  return {
    id: 'links',
    title: 'Link list',
    intro: 'One row per page Poe may link to. Uploading replaces the whole list.',
    headerRow: true,
    columns: [
      { header: 'URL', required: true, meaning: 'Full link (https://…). Slugs work too if you set a URL prefix when uploading.', alsoAccepted: ['Link', 'Page URL', 'any header containing “url” or “link”'], examples: ['https://example.com/blog/first-watch-guide', 'https://example.com/products/tissot-prx'] },
      { header: 'Title', required: false, meaning: 'The page or product name; helps Poe pick the right link.', alsoAccepted: ['Page', 'Name', 'Product name', 'Label'], examples: ['How to Choose Your First Watch', 'Tissot PRX Powermatic 80'] },
    ],
    notes: ['Duplicate links keep their first row.', 'Rows without a valid link are skipped.'],
  }
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** A small CSV: the header row (when the shape has one) and two example rows. BOM so Excel reads UTF-8. */
export function sampleCsv(f: SheetFormat): string {
  const rows = sampleRows(f)
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Tab-separated header row: pasting it into cell A1 of a Google Sheet fills one header per column. */
export function headerTsv(f: SheetFormat): string {
  return f.columns.map((c) => c.header).join('\t')
}

/** The sample's rows: the header row (when the shape has one) and two example rows. */
export function sampleRows(f: SheetFormat): string[][] {
  return [...(f.headerRow ? [f.columns.map((c) => c.header)] : []), f.columns.map((c) => c.examples[0]), f.columns.map((c) => c.examples[1])]
}

export function sampleFilename(f: SheetFormat, ext: 'csv' | 'xlsx'): string {
  return `poe-sample-${f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sheet'}.${ext}`
}

/** Resolves a format id ("calendar", "links" or "tpl-<templateId>") against the client's templates. */
export function formatById(id: string, templates: FormatTemplate[]): SheetFormat | null {
  if (id === 'calendar') return calendarFormat()
  if (id === 'links') return linkListFormat()
  const t = id.startsWith('tpl-') ? templates.find((x) => x.id === id.slice(4)) : undefined
  return t ? templateFormat(t) : null
}
