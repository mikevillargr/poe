import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'
import type { Citation } from '@/lib/ai/types'
import type { WorkspaceCitation, WorkspaceResearch } from './schemas'
import { sanitizeHtml, stripTags, unwrapModelHtml } from './html'

function section(text: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`, 'i').exec(text)
  return m ? m[1].trim() : null
}

function paragraphs(text: string): string {
  return stripTags(text)
    .split(/\n\s*\n|\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Keeps only heading/list structure from an outline; falls back to headings found anywhere. */
function cleanOutline(html: string): string {
  const s = sanitizeHtml(unwrapModelHtml(html))
  const items = s.match(/<(h2|h3)[^>]*>[\s\S]*?<\/\1>/gi)
  if (items?.length) return items.map((h) => h.replace(/<(h[23])[^>]*>/i, '<$1>')).join('\n')
  // Lists (some models answer with <ul>/<ol>), or plain lines → <h2> per line.
  if (/<(ul|ol)\b/i.test(s)) return s
  const lines = stripTags(s)
    .split('\n')
    .map((l) => l.replace(/^[-*#\d.)\s]+/, '').trim())
    .filter(Boolean)
  return lines.map((l) => `<h2>${escapeHtml(l)}</h2>`).join('\n')
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** `[n] Title — https://url` lines → citations (used when the provider returns none). */
function parseSourcesList(text: string): Citation[] {
  const out: Citation[] = []
  for (const line of text.split('\n')) {
    const m = /^\s*\[?(\d+)\]?[.)]?\s*(.*?)\s*(?:[—–-]\s*)?(https?:\/\/\S+?)[).,]?\s*$/.exec(line)
    if (!m) continue
    out.push({ id: m[1], url: m[3], title: m[2].replace(/[—–-]\s*$/, '').trim() || undefined })
  }
  return out
}

const urlKey = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '')

/**
 * The summary's inline [n] markers follow the model's own <sources> list, so that list's numbering
 * wins. Provider-structured citations (Anthropic/OpenAI) only enrich it with title/snippet by URL;
 * they're used on their own only when the model wrote no parseable source list.
 */
export function mergeCitations(listed: Citation[], provider: Citation[]): Citation[] {
  if (!listed.length) return provider
  const byUrl = new Map(provider.map((c) => [urlKey(c.url), c]))
  return listed.map((c) => {
    const p = byUrl.get(urlKey(c.url))
    return { ...c, title: c.title || p?.title, snippet: c.snippet || p?.snippet }
  })
}

function dedupeCitations(list: Citation[]): WorkspaceCitation[] {
  const seen = new Set<string>()
  const out: WorkspaceCitation[] = []
  for (const c of list) {
    if (!c?.url) continue
    try {
      new URL(c.url)
    } catch {
      continue
    }
    const key = c.url.replace(/#.*$/, '').replace(/\/$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: c.id || String(out.length + 1),
      url: c.url,
      ...(c.title ? { title: c.title.slice(0, 500) } : {}),
      ...(c.snippet ? { snippet: c.snippet.slice(0, 2000) } : {}),
    })
  }
  return out
}

/**
 * Turns the research model's final text into the persisted research brief. Expected shape is the
 * <summary>/<outline>/<sources> sections from lib/prompts/research.ts; falls back to "Summary" /
 * "Outline" headings (the mock provider) and finally to "whole text = summary, headings = outline".
 */
export function parseResearchOutput(
  text: string,
  providerCitations: Citation[],
  queries: string[],
): WorkspaceResearch {
  let summary = section(text, 'summary')
  let outline = section(text, 'outline')
  const sources = section(text, 'sources')

  if (summary === null && outline === null) {
    const split = /<h[1-3][^>]*>\s*outline\s*<\/h[1-3]>/i.exec(text)
    if (split) {
      summary = text.slice(0, split.index).replace(/<h[1-3][^>]*>\s*summary\s*<\/h[1-3]>/i, '')
      outline = text.slice(split.index + split[0].length)
    } else {
      summary = text.replace(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi, '')
      outline = (text.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi) ?? []).join('\n')
    }
  }

  const citations = dedupeCitations(mergeCitations(parseSourcesList(sources ?? ''), providerCitations))
  return {
    summary: paragraphs(summary ?? '').slice(0, 50000),
    outlineHtml: outline ? cleanOutline(outline).slice(0, 200000) : '',
    citations: citations.slice(0, 200),
    queries: [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 100),
  }
}

type ResearchState = 'idle' | 'running' | 'ready' | 'error'

/** researchStatus/researchModel aren't in the frozen article patch, so the pipeline writes them directly. */
export async function setResearchState(
  tenantId: string,
  articleId: string,
  state: ResearchState,
  extra: { researchModel?: string } = {},
) {
  await db
    .update(articles)
    .set({ researchStatus: state, ...extra, updatedAt: new Date() })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
}

/** Normalizes stored research (fixtures, older rows) to the workspace shape. */
export function readResearch(raw: unknown): WorkspaceResearch | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<WorkspaceResearch>
  return {
    summary: typeof r.summary === 'string' ? r.summary : '',
    outlineHtml: typeof r.outlineHtml === 'string' ? r.outlineHtml : '',
    citations: Array.isArray(r.citations) ? r.citations.filter((c) => c && typeof c.url === 'string') : [],
    queries: Array.isArray(r.queries) ? r.queries.filter((q) => typeof q === 'string') : [],
  }
}

/** Raw jsonb write that keeps citation `excluded` flags (the frozen article patch strips them). */
export async function writeResearch(tenantId: string, articleId: string, research: WorkspaceResearch, userId: string | null) {
  const [row] = await db
    .update(articles)
    .set({ research, updatedAt: new Date(), updatedBy: userId })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
    .returning()
  return row
}
