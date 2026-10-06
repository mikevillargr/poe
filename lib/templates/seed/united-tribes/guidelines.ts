// United Tribes (doc: "United Tribes: standard blog", "FIFA World Cup 2026 blog", "tribe community page").

import type { ClientGuidelineSet } from '../guideline-types'

export const UT_FILLER_PHRASES = [
  'rich tapestry',
  'vibrant',
  'melting pot',
  'rich heritage',
  'deeply rooted',
  'time-honored',
  'plays a vital role',
  'treasure trove',
  'boasts',
  'when it comes to',
  'nestled',
  'diverse traditions',
]

export const UT_GUIDELINES: ClientGuidelineSet = {
  slug: 'united-tribes',
  name: 'United Tribes',
  website: 'https://unitedtribes.com',
  templates: ['blog', 'fifa-blog', 'tribe-page'],
  guidelines: [
    {
      category: 'brand',
      title: 'Brand voice',
      weight: 8,
      rule: 'United Tribes is a directory and editorial platform for multicultural heritage communities connected to the U.S. Write in a helpful, knowledgeable, clear and accessible voice that is culturally respectful. Educate about the community; do not oversell United Tribes.',
    },
    {
      category: 'brand',
      title: 'One tribe per article',
      weight: 9,
      rule: 'Stay on the one country or culture named in the title and brief. Countries that share a language or region are separate tribes: Spain is not Latin America, and Colombia is not Ecuador. The American tribe covers the broad U.S. multicultural story rather than one heritage. For an unfamiliar tribe, be accurate, respectful and specific to that country\'s traditions, cuisine, celebrations and U.S. diaspora experience.',
    },
    {
      category: 'sourcing',
      title: 'Accuracy',
      weight: 10,
      rule: 'State only facts you are confident are correct and current. When unsure of a date, venue, statistic or named event, describe it in general terms instead. Never invent or assume details about a business: name one only if you are certain it exists and still operates, and never state its hours, address, prices or menu items.',
    },
    {
      category: 'client',
      title: 'Same-tribe links',
      weight: 8,
      rule: 'Link only to the supplied URLs, and only to articles about the same tribe, unless the topic is American culture broadly or the links are flagged as general. When told no internal links are available, include none.',
    },
    {
      category: 'client',
      title: 'Community CTA',
      weight: 7,
      rule: 'Calls to action link to https://unitedtribes.com/community (or a supplied tribe or city directory page).',
    },
    {
      category: 'blacklist',
      title: 'No link lead-ins in the body',
      weight: 6,
      rule: 'In the body, never introduce a link with "learn more about", "read our guide on" or "click here"; work it into the sentence. (The closing CTA may open with an action verb such as "Head to" or "Check out".)',
    },

    // Standard blog
    {
      category: 'structure',
      title: 'Blog structure',
      weight: 8,
      template: 'blog',
      rule: 'An intro paragraph, then 4–8 H2 sections. Use H3 only for substantial subsections (no colons, periods or question marks in H3 text) and never H4. Bold only short emphasis phrases and inline labels, never to fake a subsection. Close with a 3–7 word conclusion header and 2–3 paragraphs.',
    },
    {
      category: 'client',
      title: 'Varied closing CTA',
      weight: 8,
      template: 'blog',
      rule: 'End with one soft-sell CTA sentence in the style assigned to the article, tied to something concrete from it (a dish, tradition, event or business type), with anchor text that fits the context, e.g. "Discover more Brazilian businesses on United Tribes".',
    },
    {
      category: 'blacklist',
      title: 'Stock CTA',
      weight: 9,
      template: 'blog',
      rule: 'Never write "Visit United Tribes today and find out more about [X] culture and community" or close with a generic "culture and community" phrase.',
    },
    {
      category: 'seo',
      title: 'Keywords and meta',
      weight: 7,
      template: 'blog',
      rule: 'Integrate the SEO keywords naturally, with variations and community terminology; bold important culture-related phrases; no stuffing. Meta title 60 characters or fewer, meta description 155 characters or fewer.',
    },
    {
      category: 'structure',
      title: 'Blog length',
      weight: 7,
      template: 'blog',
      rule: 'Stay within the word count given in the brief (1500–2500 words when none is set). Never exceed it.',
    },

    // FIFA World Cup blog
    {
      category: 'brand',
      title: 'Match-day voice',
      weight: 8,
      template: 'fifa-blog',
      rule: 'Enthusiastic, community-first, inclusive, and knowledgeable about both the sport and the cultures. Each piece is a hype piece and a community guide at once.',
    },
    {
      category: 'structure',
      title: 'Pre-match sections',
      weight: 9,
      template: 'fifa-blog',
      rule: 'Cover, with headings adapted to the match: introduction, the nations involved, where to watch in the host city, the community behind the team, match preview, and cultural traditions around match day, then any extras. H2 sections, H3 for substantial subsections (no colons, periods or question marks), no H4.',
    },
    {
      category: 'client',
      title: 'Directory links',
      weight: 8,
      template: 'fifa-blog',
      rule: 'Spread the supplied city or tribe directory links through the "Where to Watch" and "Community Behind the Team" sections, never in one block. If none are supplied, still point readers to the tribe page. End with "[Visit the [Tribe] community on United Tribes](https://unitedtribes.com/community)" plus a sentence about local businesses, events and match-day essentials, using the city directory URL instead when one exists.',
    },
    {
      category: 'blacklist',
      title: 'No em dashes',
      weight: 8,
      template: 'fifa-blog',
      rule: 'Never use em dashes (—). Use a comma or colon, or restructure the sentence.',
    },
    {
      category: 'seo',
      title: 'Match keywords',
      weight: 7,
      template: 'fifa-blog',
      rule: 'Include FIFA, World Cup 2026, the host city, and tribe or nationality terms naturally.',
    },
    {
      category: 'structure',
      title: 'FIFA blog length',
      weight: 7,
      template: 'fifa-blog',
      rule: 'Stay within the word count given in the brief (1500–2000 words when none is set). Never exceed it.',
    },

    // Tribe community page
    {
      category: 'structure',
      title: 'Page sections',
      weight: 9,
      template: 'tribe-page',
      rule: 'Start at "## Summary" (60–75 words). Then "## Community at a Glance" with six bold labels (Diaspora, Primary Language, Major Holiday/s, Cultural Religions, Religious Diversity, Civilization), 8–12 words each; "## Key Definitions" with exactly 3 Q&A (20–30 word answers); "## Cultural Heritage" with H3 Cuisine, Arts & Music and Celebrations, each one intro sentence (max 18 words) and 3 bullets of 12–16 words; "## FAQ" with exactly 4 Q&A (18–28 word answers) that don\'t overlap the definitions.',
    },
    {
      category: 'structure',
      title: 'Page length',
      weight: 8,
      template: 'tribe-page',
      rule: '520–600 words in total, hard cap 620. If over, shorten the FAQ and bullets first.',
    },
    {
      category: 'sourcing',
      title: 'Concrete specifics',
      weight: 9,
      template: 'tribe-page',
      rule: 'Every sentence must be something that could only be written about this community: named dishes, festivals and what happens at them, languages, religious composition, historical civilizations, diaspora hubs. For combined pages (e.g. Dominican and Haitian), cover both fairly.',
    },
    {
      category: 'readability',
      title: 'Varied openings',
      weight: 6,
      template: 'tribe-page',
      rule: 'No fixed opener: never start the summary with "[Community] culture is…", and no two sections may open with the same sentence pattern. No generic transitions or recap sentences.',
    },
    {
      category: 'blacklist',
      title: 'Filler phrases',
      weight: 9,
      template: 'tribe-page',
      rule: `Never use: ${UT_FILLER_PHRASES.map((p) => `"${p}"`).join(', ')} (the last when used emptily).`,
    },
    {
      category: 'blacklist',
      title: 'No em dashes',
      weight: 8,
      template: 'tribe-page',
      rule: 'Never use em dashes (—). Use commas or periods, or restructure the sentence.',
    },
  ],
}
