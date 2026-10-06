// The "Standard article" preset (DR-010 "New template → Standard article"): Poe's generic SEO article as an
// editable template. Client guidelines come in through {{GUIDELINES}}; research is on.
import type { TemplateConfig } from './types'

export const STANDARD_WRITER_PROMPT = `Write an SEO article.

Title: {{TITLE}} (use exactly as provided)
Brief: {{BRIEF}}
Keywords: {{KEYWORDS}} (the first is the primary keyword: use it in the title, in the first 100 words and in at least one H2; use the others naturally)
Target length: {{WORD_COUNT}} words

Follow these client guidelines:
{{GUIDELINES}}

Structure your response with these exact section markers, written as plain text:

ARTICLE_TITLE:
{{TITLE}}
META_TITLE:
[SEO title, 60 characters max]
META_DESCRIPTION:
[Meta description, 155 characters max, answering the reader's question]
MAIN_CONTENT:
[An introduction, then H2 (##) sections with H3 (###) only where useful. Use Markdown: **bold**, bullet and numbered lists, and [links](URL) only to URLs given to you.]
CONCLUSION_HEADER:
[A 3-7 word heading]
CONCLUSION:
[One or two short paragraphs]

Do not include --- anywhere. End your response after the CONCLUSION section.`

export const STANDARD_TEMPLATE: { name: string; kind: TemplateConfig['kind']; config: TemplateConfig } = {
  name: 'Standard article',
  kind: 'blog',
  config: {
    kind: 'blog',
    selectors: [],
    writerPrompt: STANDARD_WRITER_PROMPT,
    writerMaxTokens: 8000,
    markers: ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'MAIN_CONTENT', 'CONCLUSION_HEADER', 'CONCLUSION'],
    assembly: 'meta-blog',
    blogCleanup: true,
    defaultWordCount: '1200',
    hooks: [],
    values: {
      TITLE: { from: 'article', field: 'title' },
      BRIEF: { from: 'article', field: 'brief' },
      KEYWORDS: { from: 'keywords', empty: '(none)' },
      WORD_COUNT: { from: 'wordCount' },
    },
    inputs: [
      { key: 'title', label: 'Title', required: true, aliases: ['Title'] },
      { key: 'brief', label: 'Brief', aliases: ['Brief', 'Prompt'] },
      { key: 'keywords', label: 'SEO keywords', aliases: ['Keywords', 'SEO Keywords'] },
      { key: 'wordcount', label: 'Word count', aliases: ['Word count', 'Number of Words'] },
    ],
    checks: { metaTitleMax: 60, metaDescriptionMax: 155, conclusionHeaderWords: { min: 3, max: 7 }, wordCountTolerance: 0.1 },
    researchEnabled: true,
  },
}
