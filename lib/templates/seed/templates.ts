// The 10 n8n workflows as Poe templates (D-002). Prompts come verbatim from ./prompts.ts; everything
// else (sources, selectors, markers, checks) follows the doc's per-client "Rules at a glance",
// "Inputs and where they come from" and "Output checks" tables. Template slugs match the `template`
// field in ./<client>/guidelines.ts.

import { UT_FILLER_PHRASES } from './united-tribes/guidelines'
import { NCH_COMPETITORS } from './nch/guidelines'
import * as P from './prompts'
import type { CheckConfig, TemplateConfig, ValueSource } from '../types'

export interface SeedTemplate {
  slug: string
  name: string
  kind: TemplateConfig['kind']
  config: TemplateConfig
}

export interface SeedInventory {
  slug: string
  name: string
  kind: 'articles' | 'products' | 'pages' | 'videos' | 'directory'
}

const BLOG_MARKERS = ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'MAIN_CONTENT', 'CONCLUSION_HEADER', 'CONCLUSION']
const TWS_MARKERS = ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'KEY_TAKEAWAYS', 'MAIN_CONTENT', 'FAQ_SECTION', 'CONCLUSION_HEADER', 'CONCLUSION']
const NCH_MARKERS = [
  'ARTICLE_TITLE',
  'META_TITLE',
  'META_DESCRIPTION',
  'TLDR_SUMMARY',
  'KEY_TAKEAWAYS',
  'MAIN_CONTENT',
  'VERDICT_SECTION',
  'FAQ_SECTION',
  'EXPERT_TIPS_FROM_NCH',
  'CONCLUSION_HEADER',
  'CONCLUSION',
]

const BLOG_META_CHECKS: CheckConfig = { metaTitleMax: 60, metaDescriptionMax: 155, conclusionHeaderWords: { min: 3, max: 7 } }

const SWISS_RULES: CheckConfig['proximity'] = [
  { label: 'Swiss', terms: ['swiss', 'swiss-made'], allowedWith: ['tissot', 'alpina', 'frederique constant', 'sandoz'] },
  { label: 'Luxury', terms: ['luxury', 'luxurious'], allowedWith: ['frederique constant'] },
]

const IDEATION_INPUTS: TemplateConfig['inputs'] = [
  { key: 'title', label: 'Title', required: true, aliases: ['Title', 'Blog Page'] },
  { key: 'brief', label: 'Brief', aliases: ['Prompt', 'Blog summary', 'Brief'] },
  { key: 'keywords', label: 'SEO keywords', aliases: ['SEO Keywords', 'Keywords'] },
  { key: 'wordcount', label: 'Word count', aliases: ['Number of Words', 'Word count'] },
]

/** Title / brief / keywords / word count under the names a prompt uses. */
function ideationValues(names: { title: string; brief: string; keywords?: string; wordCount?: string }): Record<string, ValueSource> {
  const v: Record<string, ValueSource> = {
    [names.title]: { from: 'article', field: 'title' },
    [names.brief]: { from: 'article', field: 'brief' },
  }
  if (names.keywords) v[names.keywords] = { from: 'keywords' }
  if (names.wordCount) v[names.wordCount] = { from: 'wordCount' }
  return v
}

// ── Levittown Ford Parts / Subaru Parts Pros: product FAQ ────────────────────────────────────

function autoPartsFaq(selector: string, writer: string): SeedTemplate {
  return {
    slug: 'product-faq',
    name: 'Product FAQ',
    kind: 'faq',
    config: {
      kind: 'faq',
      selectors: [
        { id: 'links', prompt: selector, maxTokens: 300, output: 'SELECTED_URLS', format: 'sections', candidates: ['INTERLINK_PAGES', 'ALL_PRODUCTS'] },
      ],
      writerPrompt: writer,
      writerMaxTokens: 2000,
      markers: [],
      assembly: 'raw',
      blogCleanup: false,
      defaultWordCount: '600-700',
      hooks: [],
      values: {
        PRODUCT_NAME: { from: 'article', field: 'title' },
        INTERLINK_PAGES: { from: 'inventory', inventory: 'interlink-pages', format: '{url}-{title}' },
        ALL_PRODUCTS: { from: 'inventory', inventory: 'products', format: '{url}-{title}' },
      },
      inputs: [{ key: 'title', label: 'Product name', required: true, aliases: ['Product Name', 'Product name'] }],
      checks: {
        questions: { level: 2, min: 10, max: 10 },
        links: { min: 4, max: 5, label: 'links (2 pages + 2–3 products)' },
        onlySuppliedUrls: true,
      },
      researchEnabled: false,
    },
  }
}

export const LFP_TEMPLATES = [autoPartsFaq(P.LFP_SELECTOR_PROMPT, P.LFP_WRITER_PROMPT)]
export const SPP_TEMPLATES = [autoPartsFaq(P.SPP_SELECTOR_PROMPT, P.SPP_WRITER_PROMPT)]
export const AUTO_PARTS_INVENTORIES: SeedInventory[] = [
  { slug: 'interlink-pages', name: 'VIP interlinking pages', kind: 'pages' },
  { slug: 'products', name: 'Products', kind: 'products' },
]

// ── TenderBites ──────────────────────────────────────────────────────────────────────────────

export const TENDERBITES_TEMPLATES: SeedTemplate[] = [
  {
    slug: 'product-faq',
    name: 'Product FAQ',
    kind: 'faq',
    config: {
      kind: 'faq',
      selectors: [],
      writerPrompt: P.TB_FAQ_PROMPT,
      writerMaxTokens: 2000,
      markers: [],
      assembly: 'raw',
      blogCleanup: false,
      defaultWordCount: '400-500',
      hooks: [],
      values: { PRODUCT_NAME: { from: 'article', field: 'title' } },
      inputs: [{ key: 'title', label: 'Product name', required: true, aliases: ['Product Name', 'Product name'] }],
      checks: { questions: { level: 3, min: 5, max: 5 }, links: { max: 0, label: 'links' } },
      researchEnabled: false,
    },
  },
  {
    slug: 'blog',
    name: 'Blog',
    kind: 'blog',
    config: {
      kind: 'blog',
      selectors: [{ id: 'links', prompt: P.TB_SELECTOR_PROMPT, maxTokens: 300, output: 'SELECTED_URLS', format: 'urls', candidates: ['BLOG_URLS'] }],
      writerPrompt: P.TB_WRITER_PROMPT,
      writerMaxTokens: 4096,
      markers: BLOG_MARKERS,
      assembly: 'meta-blog',
      blogCleanup: true,
      defaultWordCount: '800-1100',
      hooks: [],
      values: {
        ...ideationValues({ title: 'BLOG_TITLE', brief: 'BLOG_BRIEF' }),
        BLOG_URLS: { from: 'inventory', inventory: 'blog-articles', format: '{url}' },
      },
      inputs: IDEATION_INPUTS.slice(0, 2),
      ctaUrls: ['https://tenderbites.ph'],
      checks: {
        ...BLOG_META_CHECKS,
        h2: { min: 4, max: 6 },
        h3: { min: 0, max: 2 },
        links: { min: 3, max: 5 },
        onlySuppliedUrls: true,
        bannedPhrases: ['order now', 'shop today', 'get yours', "don't miss out", 'don’t miss out', 'perfect time to buy'],
      },
      researchEnabled: false,
    },
  },
]
export const TENDERBITES_INVENTORIES: SeedInventory[] = [{ slug: 'blog-articles', name: 'Published blog articles', kind: 'articles' }]

// ── The Watch Store PH ───────────────────────────────────────────────────────────────────────

export const TWS_TEMPLATES: SeedTemplate[] = [
  {
    slug: 'product-faq',
    name: 'Product FAQ',
    kind: 'faq',
    config: {
      kind: 'faq',
      selectors: [],
      writerPrompt: P.TWS_FAQ_PROMPT,
      writerMaxTokens: 2000,
      markers: [],
      assembly: 'raw',
      blogCleanup: false,
      defaultWordCount: '600',
      hooks: [{ id: 'product-page', options: { urlInput: 'itemUrl' } }],
      values: {
        ITEM_NAME: { from: 'article', field: 'title' },
        ITEM_URL: { from: 'input', key: 'itemUrl' },
      },
      inputs: [
        { key: 'title', label: 'Item', required: true, aliases: ['Item', 'Item (A)'] },
        { key: 'itemUrl', label: 'Item URL', required: true, aliases: ['Item URL', 'Item URL (B)'] },
      ],
      checks: { questions: { level: 2, min: 8, max: 8 }, wordCountTolerance: 0.1, links: { max: 0, label: 'links' }, proximity: SWISS_RULES },
      researchEnabled: false,
    },
  },
  {
    slug: 'blog',
    name: 'Blog',
    kind: 'blog',
    config: {
      kind: 'blog',
      selectors: [
        {
          id: 'links',
          prompt: P.TWS_SELECTOR_PROMPT,
          maxTokens: 800,
          output: 'SELECTED_URLS',
          format: 'sections',
          candidates: ['PUBLISHED_ARTICLES', 'PRODUCT_URLS'],
        },
      ],
      writerPrompt: P.TWS_WRITER_PROMPT,
      writerMaxTokens: 6000,
      markers: TWS_MARKERS,
      assembly: 'tws-blog',
      blogCleanup: true,
      defaultWordCount: '1500-2500',
      hooks: [],
      values: {
        ...ideationValues({ title: 'BLOG_TITLE', brief: 'BLOG_PROMPT', keywords: 'SEO_KEYWORDS', wordCount: 'WORD_COUNT' }),
        PUBLISHED_ARTICLES: { from: 'inventory', inventory: 'blog-articles', format: '{title}-{url}' },
        PRODUCT_URLS: { from: 'inventory', inventory: 'products', format: '{url}' },
      },
      inputs: IDEATION_INPUTS,
      ctaUrls: ['https://thewatchstore.ph/pages/contact'],
      checks: {
        ...BLOG_META_CHECKS,
        h2: { min: 4, max: 6 },
        h3: { min: 0, max: 0 },
        questions: { level: 3, min: 4, max: 5, section: 'FAQ_SECTION' },
        lists: [{ section: 'KEY_TAKEAWAYS', label: 'Key Takeaways', min: 4, max: 5 }],
        onlySuppliedUrls: true,
        proximity: SWISS_RULES,
      },
      researchEnabled: false,
    },
  },
]
export const TWS_INVENTORIES: SeedInventory[] = [
  { slug: 'blog-articles', name: 'Published blog articles', kind: 'articles' },
  { slug: 'products', name: 'Products', kind: 'products' },
]

// ── Nevada Corporate Headquarters ────────────────────────────────────────────────────────────

export const NCH_TEMPLATES: SeedTemplate[] = [
  {
    slug: 'blog',
    name: 'Grail blog',
    kind: 'blog',
    config: {
      kind: 'blog',
      selectors: [
        { id: 'links', prompt: P.NCH_SELECTOR_PROMPT, maxTokens: 300, output: 'SELECTED_URLS', format: 'urls', candidates: ['PUBLISHED_ARTICLES'] },
        { id: 'youtube', prompt: P.NCH_YOUTUBE_PROMPT, maxTokens: 300, output: 'YOUTUBE_URL', format: 'single-url', candidates: ['YOUTUBE_VIDEOS'] },
      ],
      writerPrompt: P.NCH_WRITER_PROMPT,
      writerMaxTokens: 6000,
      markers: NCH_MARKERS,
      assembly: 'nch-blog',
      blogCleanup: true,
      defaultWordCount: '1500-2500',
      hooks: [],
      values: {
        ...ideationValues({ title: 'TITLE', brief: 'PROMPT', keywords: 'SEO_KEYWORDS', wordCount: 'WORD_COUNT' }),
        CURRENT_YEAR: { from: 'currentYear' },
        PUBLISHED_ARTICLES: { from: 'inventory', inventory: 'blog-articles', format: '{title}-{url}' },
        YOUTUBE_VIDEOS: { from: 'inventory', inventory: 'youtube', format: '{title}-{url}' },
      },
      inputs: IDEATION_INPUTS,
      ctaUrls: ['https://nchinc.com/contact-nch'],
      checks: {
        ...BLOG_META_CHECKS,
        questions: { level: 3, min: 10, max: 10, section: 'FAQ_SECTION' },
        lists: [
          { section: 'KEY_TAKEAWAYS', label: 'Key Takeaways', min: 3, max: 5 },
          { section: 'EXPERT_TIPS_FROM_NCH', label: 'Expert Tips', min: 3, max: 5 },
        ],
        onlySuppliedUrls: true,
        bannedPhrases: [...NCH_COMPETITORS, '250k', 'cheap'],
        h2Questions: true,
      },
      researchEnabled: false,
    },
  },
]
export const NCH_INVENTORIES: SeedInventory[] = [
  { slug: 'blog-articles', name: 'Published articles', kind: 'articles' },
  { slug: 'youtube', name: 'YouTube videos', kind: 'videos' },
]

// ── United Tribes ────────────────────────────────────────────────────────────────────────────

export const UT_TEMPLATES: SeedTemplate[] = [
  {
    slug: 'blog',
    name: 'Heritage blog',
    kind: 'blog',
    config: {
      kind: 'blog',
      selectors: [{ id: 'links', prompt: P.UT_SELECTOR_PROMPT, maxTokens: 300, output: 'SELECTED_URLS', format: 'urls', candidates: ['AGGREGATED_URLS'] }],
      writerPrompt: P.UT_WRITER_PROMPT,
      writerMaxTokens: 6000,
      markers: BLOG_MARKERS,
      assembly: 'meta-blog',
      blogCleanup: true,
      defaultWordCount: '1500-2500',
      hooks: [{ id: 'ut-tribe-links', options: { inventory: 'blog-articles' } }, { id: 'ut-cta-style' }],
      values: ideationValues({ title: 'TITLE', brief: 'PROMPT', keywords: 'SEO_KEYWORDS', wordCount: 'WORD_COUNT' }),
      inputs: IDEATION_INPUTS,
      ctaUrls: ['https://unitedtribes.com/community'],
      // The DIRECT-ACTION CTA style opens with "Check out", so it isn't banned here.
      leadIns: ['click here', 'learn more about', 'read our guide on'],
      checks: {
        ...BLOG_META_CHECKS,
        h2: { min: 4, max: 8 },
        onlySuppliedUrls: true,
        bannedPhrases: ['Visit United Tribes today and find out more about'],
      },
      researchEnabled: false,
    },
  },
  {
    slug: 'fifa-blog',
    name: 'FIFA World Cup blog',
    kind: 'blog',
    config: {
      kind: 'blog',
      selectors: [{ id: 'links', prompt: P.FIFA_SELECTOR_PROMPT, maxTokens: 300, output: 'SELECTED_URLS', format: 'urls', candidates: ['AGGREGATED_URLS'] }],
      writerPrompt: P.FIFA_WRITER_PROMPT,
      writerMaxTokens: 6000,
      markers: BLOG_MARKERS,
      assembly: 'meta-blog',
      blogCleanup: true,
      defaultWordCount: '1500-2000',
      hooks: [{ id: 'fifa-links', options: { inventory: 'fifa-blog-articles' } }, { id: 'fifa-city-directory', options: { inventory: 'city-directory' } }],
      values: ideationValues({ title: 'TITLE', brief: 'PROMPT', keywords: 'SEO_KEYWORDS', wordCount: 'WORD_COUNT' }),
      inputs: IDEATION_INPUTS,
      ctaUrls: ['https://unitedtribes.com/community'],
      leadIns: ['click here', 'learn more about', 'read our guide on'],
      checks: { ...BLOG_META_CHECKS, onlySuppliedUrls: true, noEmDash: true },
      researchEnabled: false,
    },
  },
  {
    slug: 'tribe-page',
    name: 'Tribe community page',
    kind: 'page',
    config: {
      kind: 'page',
      selectors: [],
      writerPrompt: P.TRIBE_WRITER_PROMPT,
      writerMaxTokens: 3000,
      markers: [],
      assembly: 'tribe-page',
      blogCleanup: false,
      defaultWordCount: '520-620',
      hooks: [],
      values: {
        TRIBE_LABEL: { from: 'input', key: 'label', fallback: '' },
        PAGE_URL: { from: 'input', key: 'pageUrl' },
        KEYWORDS: { from: 'keywords', empty: '(none)' },
        CURRENT_YEAR: { from: 'currentYear' },
      },
      inputs: [
        { key: 'label', label: 'Community label' },
        { key: 'pageUrl', label: 'Page URL', required: true },
        { key: 'keywords', label: 'Keywords' },
      ],
      titlePlaceholder: 'TRIBE_LABEL',
      checks: { requiredMarkers: [], noEmDash: true, bannedPhrases: UT_FILLER_PHRASES.filter((p) => p !== 'diverse traditions') },
      researchEnabled: false,
    },
  },
]
export const UT_INVENTORIES: SeedInventory[] = [
  { slug: 'blog-articles', name: 'Published blog articles', kind: 'articles' },
  { slug: 'fifa-blog-articles', name: 'FIFA campaign blog articles', kind: 'articles' },
  { slug: 'city-directory', name: 'Links by city', kind: 'directory' },
]

/** Template + inventory sets per client slug (matches CLIENT_GUIDELINE_SETS). */
export const CLIENT_TEMPLATE_SETS: Record<string, { templates: SeedTemplate[]; inventories: SeedInventory[] }> = {
  'levittown-ford-parts': { templates: LFP_TEMPLATES, inventories: AUTO_PARTS_INVENTORIES },
  'subaru-parts-pros': { templates: SPP_TEMPLATES, inventories: AUTO_PARTS_INVENTORIES },
  tenderbites: { templates: TENDERBITES_TEMPLATES, inventories: TENDERBITES_INVENTORIES },
  'the-watch-store-ph': { templates: TWS_TEMPLATES, inventories: TWS_INVENTORIES },
  'united-tribes': { templates: UT_TEMPLATES, inventories: UT_INVENTORIES },
  nch: { templates: NCH_TEMPLATES, inventories: NCH_INVENTORIES },
}
