// Link-selector output: the cheap model returns URLs as a comma list, as ARTICLE_URLS / PRODUCT_URLS
// blocks, or as a single URL. Anything it returns that wasn't in the candidate list is dropped (n8n
// passed the raw text through, so a hallucinated URL could reach the article).

const URL_RE = /https?:\/\/[^\s,<>"'`)\]]+/g

export function extractUrls(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.;:!?*]+$/, '')
    const key = urlKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
  }
  return out
}

export function urlKey(url: string): string {
  return url
    .trim()
    .replace(/#.*$/, '')
    .replace(/\/+$/, '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .toLowerCase()
}

export interface SectionedUrls {
  articles: string[]
  products: string[]
}

/** `ARTICLE_URLS:` / `PRODUCT_URLS:` blocks (optionally bolded) → two URL lists. */
export function parseSectionedUrls(text: string): SectionedUrls {
  const idxA = text.search(/article[_ ]urls/i)
  const idxP = text.search(/product[_ ]urls/i)
  const slice = (from: number, to: number) => (from < 0 ? '' : text.slice(from, to < 0 || to < from ? undefined : to))
  return {
    articles: extractUrls(slice(idxA, idxP)),
    products: extractUrls(slice(idxP, idxA > idxP ? idxA : -1)),
  }
}

export interface Filtered {
  kept: string[]
  dropped: string[]
}

/**
 * Keeps URLs that are in the candidate list. Candidate lists that hold no URLs at all (e.g. LFP's product
 * list, which can be slugs) can't be checked, so everything is kept.
 */
export function filterToCandidates(urls: string[], candidates: string[]): Filtered {
  const allowed = new Set(candidates.flatMap(extractUrls).map(urlKey))
  if (!allowed.size) return { kept: urls, dropped: [] }
  const kept: string[] = []
  const dropped: string[] = []
  for (const u of urls) (allowed.has(urlKey(u)) ? kept : dropped).push(u)
  return { kept, dropped }
}

export function formatUrlList(urls: string[]): string {
  return urls.join(', ')
}

export function formatSectioned(s: SectionedUrls): string {
  return `ARTICLE_URLS:\n${formatUrlList(s.articles)}\n\nPRODUCT_URLS:\n${formatUrlList(s.products)}`
}
