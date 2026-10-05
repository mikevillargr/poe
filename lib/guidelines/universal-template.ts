// The agency Universal guidelines template (DR-006). New clients get a copy via createClient().
// Loaded into `universal_guidelines` by scripts/db/seed-universal.ts (prod-safe, idempotent) and
// scripts/db/dev-fixtures.ts (local dev). Blacklist rules are compiled from published lists of
// AI-writing tells; sources are cited in .agents/design/DR-006-guidelines.md (appendix).
//
// Editing rules: keep `rule` text imperative — it is injected verbatim into generation prompts and
// used by the optimize check. Brand rows are placeholders: they ship inactive so they never reach a
// prompt until someone edits and enables them per client.

export interface UniversalTemplateRule {
  category: 'seo' | 'structure' | 'readability' | 'sourcing' | 'brand' | 'blacklist'
  title: string
  rule: string
  weight: number
  active?: boolean
}

export const UNIVERSAL_TEMPLATE: UniversalTemplateRule[] = [
  // --- SEO ---
  { category: 'seo', title: 'Primary keyword placement', weight: 9, rule: 'Use the primary keyword in the H1, within the first 100 words, and in at least one H2.' },
  { category: 'seo', title: 'Secondary keywords', weight: 8, rule: 'Work every secondary keyword in naturally at least once where it is relevant. Never force an exact-match phrase into a sentence where it reads awkwardly.' },
  { category: 'seo', title: 'No keyword stuffing', weight: 8, rule: 'Keep primary keyword density under about 2%. Prefer close variants and synonyms over repetition.' },
  { category: 'seo', title: 'Topical depth', weight: 6, rule: 'Cover the subtopics and related entities a reader searching the primary keyword would expect, so the article satisfies the search intent completely.' },
  { category: 'seo', title: 'Meta description', weight: 6, rule: 'Provide a 140–160 character meta description that includes the primary keyword and a clear benefit.' },
  { category: 'seo', title: 'Links', weight: 6, rule: 'Include 2–5 external links to authoritative, relevant sources, plus internal links when the client provides them. Link naturally, on descriptive anchor text.' },

  // --- Structure ---
  { category: 'structure', title: 'Answer first (AIO)', weight: 8, rule: 'Answer the core question directly in the first two sentences, so the article can be quoted by AI overviews and featured snippets.' },
  { category: 'structure', title: 'Scannable headings', weight: 7, rule: 'Break the article into H2 sections every 200–300 words, with H3s for sub-points. Headings describe what the section delivers; never tease or clickbait.' },
  { category: 'structure', title: 'Heading hierarchy', weight: 6, rule: 'Exactly one H1, then H2s and H3s with no skipped levels. Use sentence case for all headings.' },
  { category: 'structure', title: 'Short paragraphs', weight: 6, rule: 'Keep paragraphs to 2–4 sentences. One idea per paragraph.' },
  { category: 'structure', title: 'Hit the target length', weight: 7, rule: 'Land within ±10% of the target word count. Cut filler before cutting substance.' },
  { category: 'structure', title: 'Every section earns its place', weight: 6, rule: 'Each section must add information the reader does not yet have. No filler sections, no "Conclusion" that merely restates the article.' },
  { category: 'structure', title: 'Lists where they genuinely help', weight: 5, rule: 'Use bullet or numbered lists for genuinely enumerable content (steps, options, checklists). Keep the surrounding prose as prose.' },

  // --- Readability ---
  { category: 'readability', title: 'Plain language', weight: 6, rule: 'Write at roughly an 8th–9th grade reading level. Prefer short, concrete words over abstract ones.' },
  { category: 'readability', title: 'Speak to the reader', weight: 6, rule: 'Address the reader as "you". Write like a knowledgeable person explaining something to a colleague, not like a report.' },
  { category: 'readability', title: 'Varied sentence rhythm', weight: 6, rule: 'Vary sentence and paragraph length. Avoid metronome-uniform sentences and perfectly parallel paragraphs — that rhythm is a known AI tell.' },
  { category: 'readability', title: 'Active voice', weight: 5, rule: 'Use active voice by default. Passive voice only when the actor is unknown or irrelevant.' },
  { category: 'readability', title: 'Concrete over abstract', weight: 5, rule: 'Prefer specific examples, numbers and named things over generalities. Every claim should be checkable or clearly an opinion.' },
  { category: 'readability', title: 'Define jargon', weight: 4, rule: 'Explain technical terms on first use, or use a plainer word.' },

  // --- Sourcing ---
  { category: 'sourcing', title: 'No invented specifics', weight: 10, rule: 'Never invent statistics, quotes, studies, customer names, dates or prices. If a fact cannot be sourced, remove it.' },
  { category: 'sourcing', title: 'Cite claims', weight: 8, rule: 'Every statistic and factual claim needs a credible, linked source, published within the last three years where possible.' },
  { category: 'sourcing', title: 'Named sources only', weight: 8, rule: 'Attribute claims to named people, publications or studies — never to "experts say", "studies show", "industry reports" or "observers note".' },
  { category: 'sourcing', title: 'Link the primary source', weight: 6, rule: 'Link the original study, report or dataset, not another article covering it.' },

  // --- Brand voice (placeholders — ship inactive, edit and enable per client) ---
  { category: 'brand', title: '(Placeholder) Voice & tone', weight: 6, active: false, rule: 'Replace this with the client\'s voice in one or two sentences (e.g. "warm, plain-spoken expert; never salesy"). Until then, write in a clear, professional, conversational tone.' },
  { category: 'brand', title: '(Placeholder) Terminology', weight: 5, active: false, rule: 'Replace with the client\'s preferred terms, spellings, product names and capitalizations (e.g. "clients, not customers"; "always lowercase the in product names").' },
  { category: 'brand', title: '(Placeholder) Topics & claims to avoid', weight: 7, active: false, rule: 'Replace with anything the client must not say: competitor mentions, unverified performance claims, regulated claims (medical, legal, financial), banned topics.' },
  { category: 'brand', title: '(Placeholder) CTAs & internal links', weight: 5, active: false, rule: 'Replace with the client\'s preferred call-to-action phrasing and the pages articles should link to.' },

  // --- Blacklist: words, phrases and patterns that make text sound AI-written ---
  // Compiled from the sources cited in DR-006 (Wikipedia "Signs of AI writing", Kobak et al.,
  // Juzek & Ward, Matsui, Pangram, GPTZero, The Atlantic, The Conversation, Forbes, Prowlo).
  { category: 'blacklist', title: 'AI verbs', weight: 9, rule: 'Never use these verbs: delve (into), underscore, showcase, boast(s), garner(ed), foster(ing), leverage, utilize, facilitate, embark (on), navigate (the complexities of), streamline, elevate, unlock, comprehend. Use plain alternatives: dig into, show, has, use, improve, start, handle.' },
  { category: 'blacklist', title: 'AI adjectives and nouns', weight: 9, rule: 'Never use these words: intricate, intricacies, meticulous(ly), pivotal, crucial, robust, seamless, tapestry, realm, landscape (figurative), testament, nuanced, multifaceted, groundbreaking, innovative, invaluable, profound, transformative, commendable, myriad, vibrant, enduring, bustling, cutting-edge, state-of-the-art, game-changer.' },
  { category: 'blacklist', title: 'Intensifier crutches', weight: 7, rule: 'Avoid "quiet/quietly" and "genuinely" as mood-setters ("quiet confidence", "genuinely transformative"), and "comprehensive" as a default modifier for guides and overviews.' },
  { category: 'blacklist', title: 'Sentence-initial transitions', weight: 7, rule: 'Do not start sentences with "Additionally", "Moreover", "Furthermore", "Notably" or "Importantly". Rewrite without the crutch.' },
  { category: 'blacklist', title: 'Stock openers', weight: 9, rule: 'Never open with: "In today\'s fast-paced world", "In today\'s digital age", "In an ever-evolving landscape", "When it comes to…", "In the realm of…", "It\'s important to note that…", "It is worth noting that…", "Did you know…?".' },
  { category: 'blacklist', title: 'Importance inflation', weight: 9, rule: 'Never write: "plays a crucial/pivotal/vital role", "a stark reminder", "a pivotal moment", "a significant milestone/step forward", "left an indelible mark", "stands as a testament", "mark a turning point", "the transformative power of", "setting the stage for", "reflects broader trends".' },
  { category: 'blacklist', title: 'Depth theater', weight: 8, rule: 'Never write: "take a deep dive", "delve deeper", "gain a deeper understanding", "shed light on", "the complex interplay", "address the root cause", "navigate the challenges", "explore the nuances".' },
  { category: 'blacklist', title: 'Value padding', weight: 8, rule: 'Never write: "provide/offer valuable insights", "a comprehensive overview/guide", "offer a valuable opportunity", "broad/far-reaching implications", "pave the way", "an unwavering commitment", "the relentless pursuit", "a unique blend", "a delicate balance", "a multifaceted approach", "an ongoing dialogue", "the path ahead", "a wealth of".' },
  { category: 'blacklist', title: 'Analysis clichés', weight: 7, rule: 'Avoid: "at the end of the day", "that being said", "a double-edged sword", "the key takeaway is", "when all is said and done".' },
  { category: 'blacklist', title: 'Announcement phrases and fake candor', weight: 8, rule: 'Never write: "Here\'s the kicker", "The best part?", "But here\'s the thing", "Here\'s the part most people miss", "Here\'s the breakdown", "Honestly?", "Let\'s dive in", "As mentioned above".' },
  { category: 'blacklist', title: 'Chat residue and sign-offs', weight: 10, rule: 'Never include chatbot artifacts: "I hope this helps", "Great question!", "Let me know if you have any questions", "Happy to help!", "Certainly!", "Of course!", "You\'re absolutely right!", "Would you like…", "as an AI", "as of my last update". An article never addresses the reader as if it were a chat assistant.' },
  { category: 'blacklist', title: 'The contrast formula', weight: 8, rule: 'Avoid "It\'s not X — it\'s Y" and "not just A, but B" constructions. State the point directly.' },
  { category: 'blacklist', title: 'Forced rule of three', weight: 7, rule: 'Do not pad prose with reflexive three-part lists ("clear, concise, and compelling"). Use three items only when there genuinely are three.' },
  { category: 'blacklist', title: 'Rhetorical-question hooks', weight: 7, rule: 'Do not open articles or sections with a rhetorical question ("Ever wondered why…?"). Lead with the answer.' },
  { category: 'blacklist', title: 'Claim escalation and truisms', weight: 8, rule: 'Do not inflate modest claims ("fundamentally changes how we think about…") and do not state safe truisms that teach the reader nothing ("Consistency is important", "Success takes hard work").' },
  { category: 'blacklist', title: 'Therapist mode', weight: 8, rule: 'Outside genuinely sensitive topics, never address the reader with "You\'re not alone", "You\'re not imagining it", "You\'re not broken" or coaching questions like "Are you ready to go deeper?".' },
  { category: 'blacklist', title: 'Summary endings and -ing tail clauses', weight: 8, rule: 'No "In conclusion" / "In summary" sections that restate the article, and no superficial trailing "-ing" clauses ("…underscoring its importance", "…reflecting its commitment", "…contributing to the broader landscape").' },
  { category: 'blacklist', title: 'Vague attribution', weight: 9, rule: 'Never attribute claims to "experts say", "studies show", "industry reports", "observers note" or "some critics argue" without naming and linking the source.' },
  { category: 'blacklist', title: 'Copula avoidance and puffery', weight: 8, rule: 'Use plain "is" and "has" instead of "serves as", "stands as", "boasts", "features" or "represents". No brochure puffery: "nestled in the heart of", "rich cultural heritage", "coastal charm", "captivates visitors and locals alike".' },
  { category: 'blacklist', title: 'Em dashes', weight: 7, rule: 'Avoid em dashes. Use commas, parentheses or a new sentence instead. At most one per 500 words.' },
  { category: 'blacklist', title: 'Formatting tells', weight: 7, rule: 'No emoji in headings or bullets (✅, ❌, 🚀, keycap numbers), no bolded-label bullet lists ("**Label:** text") as the default list format, no mechanically bolded key terms, no unusual Unicode (─, ≈, →, box-drawing characters).' },
  { category: 'blacklist', title: 'Markdown artifacts', weight: 8, rule: 'Output clean HTML only. No "**bold**" or "#" markers, no "---" dividers between sections, no title repeated as a heading above the article.' },
  { category: 'blacklist', title: 'Over-hedging', weight: 7, rule: 'Do not stack hedges ("may potentially", "can vary depending on the specific…", "it\'s worth considering"). State the position; qualify only when genuinely uncertain.' },
]
