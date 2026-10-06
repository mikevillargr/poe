// TenderBites (doc: "TenderBites: FAQ and blog"). Facts are written exactly as the prompts state them.

import { NO_LINK_LEAD_INS, type ClientGuidelineSet } from '../guideline-types'

export const TENDERBITES_GUIDELINES: ClientGuidelineSet = {
  slug: 'tenderbites',
  name: 'TenderBites',
  website: 'https://tenderbites.ph',
  templates: ['product-faq', 'blog'],
  guidelines: [
    {
      category: 'brand',
      title: 'Brand voice',
      weight: 8,
      rule: 'Write as TenderBites, a premium meat retailer in the Philippines that values quality, freshness, proper aging and customer service. Be practical, expert and specific to the cut or product.',
    },
    {
      category: 'brand',
      title: 'Audience',
      weight: 5,
      rule: 'Write for Filipino home cooks and meat enthusiasts. Reference Filipino food culture (fiesta, handaan, pulutan) where it fits naturally.',
    },
    {
      category: 'client',
      title: 'Products and cuts',
      weight: 7,
      rule: 'Only mention products from the TenderBites range: premium beef (striploin, ribeye, tenderloin, brisket, wagyu, USDA Prime); pork and lamb (pork kasim, pork belly, lamb shoulder, leg cuts); specialty and ready-to-cook items (sukiyaki cuts, herbed roasts, chori burgers, specialty steaks). Services: custom butcher cuts, butcher advice, meat aging where applicable, slicing thickness on request.',
    },
    {
      category: 'client',
      title: 'Delivery facts',
      weight: 8,
      rule: 'State delivery facts exactly: same-day delivery within Metro Manila for orders paid by 4:00pm; FREE delivery for orders of P2,000 and up; P150 flat fee for orders under P2,000; insulated packaging with ice packs, cold chain and vacuum-packing.',
    },
    {
      category: 'client',
      title: 'Hours and payment',
      weight: 5,
      rule: 'Operating hours are 8:30 AM to 5:30 PM, Monday to Sunday. Payment methods: Visa, Mastercard, GCash, GrabPay, BPI, UnionBank, RCBC.',
    },
    {
      category: 'client',
      title: 'Food safety',
      weight: 6,
      rule: 'When food safety comes up, reassure with NMIS compliance, hygiene protocols and cold chain maintenance.',
    },
    {
      category: 'client',
      title: 'Custom cuts',
      weight: 5,
      rule: 'Customers can request custom cuts: bone-in or boneless, trimming or fat-cap removal, specific portion sizes and thickness.',
    },
    { ...NO_LINK_LEAD_INS },

    // Product FAQ
    {
      category: 'structure',
      title: 'FAQ format',
      weight: 9,
      template: 'product-faq',
      rule: 'No H1. Exactly 5 questions, each an H3 holding only the question text (no numbering or prefixes), followed by its answer as a plain paragraph.',
    },
    {
      category: 'structure',
      title: 'FAQ length',
      weight: 8,
      template: 'product-faq',
      rule: 'The whole FAQ is 400–500 words. Each question is 8–12 words; each answer is 2–3 sentences (about 60–80 words).',
    },
    {
      category: 'structure',
      title: 'Product-specific questions',
      weight: 9,
      template: 'product-faq',
      rule: 'Every question names the actual product, meat type and source (local or imported), cut, and special features (dry-aged, vacuum-packed, bone-in, marbling, thickness). Write "Will this USDA Prime Ribeye Steak 300g deliver good sear and flavor when grilled?", never "Will this product taste good?".',
    },
    {
      category: 'seo',
      title: 'Product keyword',
      weight: 7,
      template: 'product-faq',
      rule: 'Use the main product keyword naturally in at least one question and its answer, and include semantic variations of it.',
    },
    {
      category: 'client',
      title: 'Topics to cover',
      weight: 6,
      template: 'product-faq',
      rule: 'Cover cut characteristics, cooking methods (with internal temperatures and resting time), freshness and storage, delivery and packaging, custom cut options, origin and sourcing, marbling and quality, usage ideas, value, and food safety.',
    },
    {
      category: 'client',
      title: 'No links in FAQs',
      weight: 5,
      template: 'product-faq',
      rule: 'Product FAQs contain no links.',
    },

    // Blog
    {
      category: 'brand',
      title: 'Editorial, not sales',
      weight: 9,
      template: 'blog',
      rule: 'Blogs are informational and editorial, never sales-driven. Mention TenderBites naturally as a helpful option, not a pushy recommendation. The article must be valuable even if the reader buys nothing.',
    },
    {
      category: 'blacklist',
      title: 'Sales phrases',
      weight: 9,
      template: 'blog',
      rule: 'Never use "order now", "shop today", "get yours", "don\'t miss out" or "perfect time to buy", and no promotional CTAs in the body.',
    },
    {
      category: 'client',
      title: 'Single CTA',
      weight: 8,
      template: 'blog',
      rule: 'Exactly one call to action, in the conclusion: [Visit TenderBites](https://tenderbites.ph).',
    },
    {
      category: 'structure',
      title: 'Blog structure',
      weight: 8,
      template: 'blog',
      rule: 'An intro paragraph, then 4–6 H2 sections. Use H3 only when necessary (1–2 in total), never H4. Bold for emphasis, numbered lists for steps, bullets for features, benefits, ingredients or tips. Close with a 3–7 word conclusion header and 2 short paragraphs.',
    },
    {
      category: 'structure',
      title: 'Blog length',
      weight: 8,
      template: 'blog',
      rule: 'Keep the whole article within 800–1100 words. Prefer depth on fewer sections over shallow coverage of many.',
    },
    {
      category: 'client',
      title: 'Practical content',
      weight: 6,
      template: 'blog',
      rule: 'Give practical, actionable guidance: cooking temperatures, techniques and storage best practices.',
    },
    {
      category: 'client',
      title: 'Internal links',
      weight: 6,
      template: 'blog',
      rule: 'Use 3–5 internal links in total, only from the supplied TenderBites articles, as [anchor](URL) inside sentences.',
    },
    {
      category: 'seo',
      title: 'Meta title and description',
      weight: 6,
      template: 'blog',
      rule: 'Write an SEO meta title of 60 characters or fewer and a compelling meta description of 155 characters or fewer.',
    },
  ],
}
