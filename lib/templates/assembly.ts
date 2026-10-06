// Parse → clean → assemble: turns one writer response into the Markdown document the n8n workflows
// queued, per recipe (doc: each client's "Assembly and output"). The [CENTER] wrapper the Apps Script
// needed is dropped; meta lines stay in the body (as in the Google Doc) and are also returned separately.

import { blogCleanup, sharedCleanup, stripCodeFence, tightenAfterHeadings } from './cleanup'
import { parseMarkers } from './markers'
import type { AssembledOutput, AssemblyRecipe } from './types'

export interface AssembleInput {
  recipe: AssemblyRecipe
  response: string
  markers: string[]
  blogCleanup: boolean
  /** Title from the row (product name, ideation title, tribe label); used when the model gives none. */
  fallbackTitle: string
}

const KEY_TAKEAWAYS = '## Key Takeaways'
const FAQ_HEADING = '## Frequently Asked Questions'
const EXPERT_TIPS = '## Expert Tips From NCH'

const join = (parts: (string | undefined | false)[]) => parts.filter((p): p is string => !!p && !!p.trim()).join('\n\n')

function metaLines(metaTitle: string, metaDescription: string, summary?: string) {
  return join([
    metaTitle && `**Meta Title:** ${metaTitle}`,
    metaDescription && `**Meta Description:** ${metaDescription}`,
    summary && `**Blog Summary:** ${summary}`,
  ])
}

/** Puts `heading` on top of a block unless the model already wrote it. */
function withHeading(block: string, heading: string): string {
  const b = block.trim()
  if (!b) return ''
  return b.split('\n')[0].trim().toLowerCase() === heading.toLowerCase() ? b : `${heading}\n${b}`
}

/** TWS FAQ safety net: a bold-only line ending in "?" becomes an H3 question. */
function boldQuestionsToH3(block: string): string {
  return block.replace(/^\s*\*\*([^*\n]+\?)\*\*\s*$/gm, '### $1')
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

export function assemble(input: AssembleInput): AssembledOutput {
  const { recipe, markers, fallbackTitle } = input
  const response = sharedCleanup(input.response)

  if (recipe === 'raw') {
    return { markdown: response, title: fallbackTitle, sections: {} }
  }

  if (recipe === 'tribe-page') {
    let body = stripCodeFence(input.response)
    const at = body.search(/^##\s+Summary\b/im)
    if (at > 0) body = body.slice(at)
    const title = `${fallbackTitle} Community Page`
    // No shared cleanup for this workflow (doc), only the fence/preamble removal.
    return { markdown: `# ${title}\n\n${body.trim()}`, title, sections: {} }
  }

  const s = parseMarkers(response, markers)
  const title = oneLine(s.ARTICLE_TITLE ?? '') || fallbackTitle
  const metaTitle = oneLine(s.META_TITLE ?? '')
  const metaDescription = oneLine(s.META_DESCRIPTION ?? '')
  const conclusion = join([s.CONCLUSION_HEADER && `## ${oneLine(s.CONCLUSION_HEADER)}`, s.CONCLUSION])

  let markdown: string
  let tldr: string | undefined
  if (recipe === 'tws-blog') {
    markdown = join([
      `# ${title}`,
      metaLines(metaTitle, metaDescription),
      withHeading(s.KEY_TAKEAWAYS ?? '', KEY_TAKEAWAYS),
      s.MAIN_CONTENT,
      withHeading(boldQuestionsToH3(s.FAQ_SECTION ?? ''), FAQ_HEADING),
      conclusion,
    ])
  } else if (recipe === 'nch-blog') {
    tldr = oneLine(s.TLDR_SUMMARY ?? '') || undefined
    markdown = join([
      `# ${title}`,
      metaLines(metaTitle, metaDescription, tldr),
      withHeading(s.KEY_TAKEAWAYS ?? '', KEY_TAKEAWAYS),
      s.MAIN_CONTENT,
      s.VERDICT_SECTION,
      withHeading(s.FAQ_SECTION ?? '', FAQ_HEADING),
      withHeading(s.EXPERT_TIPS_FROM_NCH ?? '', EXPERT_TIPS),
      conclusion,
    ])
  } else {
    markdown = join([`# ${title}`, metaLines(metaTitle, metaDescription), s.MAIN_CONTENT, conclusion])
  }

  if (input.blogCleanup) markdown = blogCleanup(markdown)
  markdown = sharedCleanup(tightenAfterHeadings(markdown, [KEY_TAKEAWAYS, FAQ_HEADING, EXPERT_TIPS]))
  return { markdown, title, metaTitle: metaTitle || undefined, metaDescription: metaDescription || undefined, tldr, sections: s }
}
