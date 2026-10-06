// Nevada Corporate Headquarters (doc: "Nevada Corporate Headquarters: blog"). NCH already has 26 legacy
// rules in production; the seed adds these beside them and flags likely overlaps (see lib/guidelines/overlap.ts).

import { NO_LINK_LEAD_INS, type ClientGuidelineSet } from '../guideline-types'

export const NCH_COMPETITORS = [
  'Anderson Business Advisors',
  'ZenBusiness',
  'LegalZoom',
  'Bizee',
  'Tailor Brands',
  'Inc Authority',
  'Prime Corporate Services',
  'Better Legal',
]

export const NCH_GUIDELINES: ClientGuidelineSet = {
  slug: 'nch',
  name: 'NCH Inc.',
  website: 'https://nchinc.com',
  templates: ['blog'],
  guidelines: [
    {
      category: 'brand',
      title: 'Brand voice',
      weight: 9,
      rule: 'Authoritative, reassuring, clear and professional. Speak with confidence backed by facts and real implications; never hedge ("might", "could possibly") or use weak positioning ("one option is…"). Acknowledge the reader\'s concerns, then solve them. Plain English, short sentences, define terms like "piercing the corporate veil". No slang, hype ("super easy", "no-brainer") or generic SEO tone.',
    },
    {
      category: 'brand',
      title: 'Proof points',
      weight: 8,
      rule: 'Work these in naturally (never as a bare list): 32+ years in business; 250,000+ businesses formed (always written this way); the only 5-star rated business formation company in the U.S.; 24-Hour LLC or it\'s FREE.',
    },
    {
      category: 'brand',
      title: 'Differentiators',
      weight: 7,
      rule: 'Three-step document verification (lawyer-reviewed, CPA-approved, formation-expert validated); lifetime post-formation support (business coach, compliance specialist, tax expert); all-inclusive, transparent pricing with no hidden fees.',
    },
    {
      category: 'brand',
      title: 'State positioning',
      weight: 9,
      rule: 'Nevada is the gold standard for asset protection and serious investors (high bar to pierce the veil, no state income tax, strong privacy, no residency requirement). Wyoming is the efficient, cost-effective alternative (annual renewal about $150 vs about $450 for Nevada) with a newer, less court-tested framework. When both appear, sell Nevada first and present Wyoming as the smart alternative, never in conflict. Delaware is built for corporations, not asset protection or small business owners. Expand any two-state comparison to three states.',
    },
    {
      category: 'client',
      title: 'Services',
      weight: 5,
      rule: 'NCH services: Business Formation, Registered Agent Service, Tax ID/EIN, Legal Services, Start-up Coach, Taxes and Bookkeeping, Business Credit.',
    },
    {
      category: 'client',
      title: 'Entity doctrine',
      weight: 7,
      rule: 'When relevant: the LLC is the foundation entity for almost every client; separate active and passive income into different entities; S-Corps only for active-income optimization, never asset holding; C-Corps are rare (typically $10M+ revenue); use multiple entities to isolate risk; structure for protection first, then taxes.',
    },
    {
      category: 'blacklist',
      title: 'Competitors',
      weight: 10,
      rule: `Never name a competitor: ${NCH_COMPETITORS.join(', ')}, or any other formation company.`,
    },
    {
      category: 'blacklist',
      title: 'Off-limits topics',
      weight: 10,
      rule: 'Never cover Series, Family or Anonymous LLCs; tax avoidance or anything suggesting bypassing the law; holding rental properties in S-Corps or C-Corps; insurance or legal services beyond formation; or deep charging-order or case-law analysis.',
    },
    {
      category: 'blacklist',
      title: 'Banned wording',
      weight: 8,
      rule: 'Never write "250k" (use "250,000+") and never call Wyoming "cheap".',
    },
    {
      category: 'sourcing',
      title: 'Statutes',
      weight: 8,
      rule: 'Cite Nevada Revised Statutes or Wyoming statutes where they help (e.g. "Under NRS 86.401, Nevada LLC members are not personally liable for the company\'s debts"), but give a section number only when you are certain it is correct; otherwise describe the rule without one.',
    },
    {
      category: 'client',
      title: 'Closing CTA',
      weight: 8,
      rule: 'End with: "[Contact NCH](https://nchinc.com/contact-nch) today to discover how our expert team can [specific benefit]. With 32+ years of experience and over 250,000 businesses formed, we\'ll make sure your LLC is set up right — the first time."',
    },
    { ...NO_LINK_LEAD_INS },

    // Blog ("grail content" structure)
    {
      category: 'structure',
      title: 'Question-led headings',
      weight: 10,
      template: 'blog',
      rule: 'The title is the H1 and contains the highest-volume keyword variant verbatim. Every H2 is phrased as a question ("What Are the Benefits of Forming an LLC?", never "Benefits of an LLC"). The first sentence after each H2 answers it directly, and the title question is answered in the first paragraph.',
    },
    {
      category: 'structure',
      title: 'Required elements',
      weight: 9,
      template: 'blog',
      rule: 'Include: a comparison or fee table in the top half; a "Who Should…?" or "Is … Right for You?" H2 in the first half; a verdict section that names the best option for the use case; 2–3 "**Expert Tip:**" callouts; a 2–3 sentence TL;DR; 3–5 Key Takeaways; exactly 10 FAQ questions with 1–2 sentence answers; and 3–5 Expert Tips From NCH.',
    },
    {
      category: 'structure',
      title: 'Templates by topic',
      weight: 7,
      template: 'blog',
      rule: 'State comparisons: "[Superlative]: [State A], [State B], or [State C]?" with a table of formation costs, annual fees, privacy, tax treatment and registered agent requirements. Investment, trading or professional LLCs: cover tax benefits, liability protection, setup costs and formation in NV or WY, with a "Who Should Form a [Type] LLC?" H2. Costs and fees: "How Much Does a [State] LLC Cost? Complete Fee Guide for [current year]" with a fee table, a hidden-costs H2 and a multi-state fee comparison.',
    },
    {
      category: 'seo',
      title: 'Verb variants',
      weight: 8,
      template: 'blog',
      rule: 'Use every natural verb variant of the target keyword (start, open, form, create, set up) 2–3 times each without stuffing, and phrase FAQ questions as different variants and angles.',
    },
    {
      category: 'seo',
      title: 'Meta title and description',
      weight: 7,
      template: 'blog',
      rule: 'Meta title of 60 characters or fewer, with the state name where it applies. Meta description of 155 characters or fewer that directly answers the intent question; it is not a tease.',
    },
    {
      category: 'client',
      title: 'Links and video',
      weight: 6,
      template: 'blog',
      rule: 'Link the parent pillar page and related NCH articles from the supplied list only. Place the supplied YouTube URL as a raw URL on its own line.',
    },
    {
      category: 'structure',
      title: 'Blog length',
      weight: 7,
      template: 'blog',
      rule: 'Stay within the word count given in the brief (1500–2500 words when none is set). Never exceed it; prefer depth on fewer sections.',
    },
  ],
}
