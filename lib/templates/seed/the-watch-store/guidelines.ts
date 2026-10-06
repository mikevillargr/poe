// The Watch Store PH (doc: "The Watch Store PH: FAQ and blog").

import { NO_LINK_LEAD_INS, type ClientGuidelineSet } from '../guideline-types'

export const TWS_GUIDELINES: ClientGuidelineSet = {
  slug: 'the-watch-store-ph',
  name: 'The Watch Store PH',
  website: 'https://thewatchstore.ph',
  templates: ['product-faq', 'blog'],
  guidelines: [
    {
      category: 'brand',
      title: 'Brand voice',
      weight: 8,
      rule: 'Write as The Watch Store PH, a retailer of quality timepieces at affordable prices: helpful, knowledgeable and passionate about watches. Educate rather than oversell.',
    },
    {
      category: 'brand',
      title: 'Swiss wording',
      weight: 10,
      rule: 'Only Tissot, Alpina, Frederique Constant and Sandoz may be called Swiss, Swiss-made, Swiss craftsmanship or Swiss precision. Never use Swiss wording for Tommy Hilfiger, Calvin Klein or Coach (American), Cerruti 1881 (Italian), Bering (Danish) or Seiko (Japanese). Use their own heritage instead: "Japanese precision" (Seiko), "Danish design" (Bering), "Italian style" (Cerruti 1881), "American style" (Tommy Hilfiger, Calvin Klein, Coach).',
    },
    {
      category: 'blacklist',
      title: 'Luxury wording',
      weight: 9,
      rule: 'Never use "luxury" or "luxurious" except about Frederique Constant watches.',
    },
    {
      category: 'brand',
      title: 'Brands carried',
      weight: 5,
      rule: 'Premium: Tissot, Alpina, Frederique Constant. Lifestyle and fashion: Tommy Hilfiger, Calvin Klein, Cerruti 1881, Coach. Contemporary: Bering, Seiko, Sandoz.',
    },
    {
      category: 'client',
      title: 'Store policies',
      weight: 8,
      rule: 'All watches are authentic, sourced from authorized distributors. All sales are final, but breach-of-warranty cases may be eligible for return and refund. Refunds go to the original payment method (bank transfer for COD). Returns need the original packaging, warranty cards, user manual and extra links. Delivery is Philippines-wide with unattended delivery options; delivery timeframes are estimates.',
    },
    { ...NO_LINK_LEAD_INS },

    // Product FAQ
    {
      category: 'structure',
      title: 'FAQ format',
      weight: 9,
      template: 'product-faq',
      rule: 'No H1. Exactly 8 questions, each an H2 holding only the question text (no numbering or prefixes), followed by its answer as a plain paragraph.',
    },
    {
      category: 'structure',
      title: 'FAQ length',
      weight: 8,
      template: 'product-faq',
      rule: 'The whole FAQ is about 600 words. Each question is 8–12 words; each answer is 60–80 words.',
    },
    {
      category: 'sourcing',
      title: 'Use the product page',
      weight: 9,
      template: 'product-faq',
      rule: 'Build every answer from the product page details (gender, case colour and material, strap, movement, glass, case shape, diameter in mm, clasp, ATM water-resistance rating, warranty). Never invent a specification; use the exact ATM rating and warranty period given.',
    },
    {
      category: 'seo',
      title: 'Item name and brand',
      weight: 7,
      template: 'product-faq',
      rule: 'Use the item name naturally in at least 2 questions and answers, with semantic variations, and name the brand prominently.',
    },
    {
      category: 'client',
      title: 'Topics to cover',
      weight: 6,
      template: 'product-faq',
      rule: 'Cover key features, case size and thickness, water resistance, dial and strap design, strap adjustment, movement type (and what it means for accuracy and maintenance), delivery timeframe, and authenticity and warranty.',
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
      category: 'structure',
      title: 'Blog structure',
      weight: 9,
      template: 'blog',
      rule: 'Key Takeaways first ("## Key Takeaways", 4–5 one-sentence bullets of at most ~25 words, bold key phrase first, primary keyword included, no links), then an intro and 4–6 H2 sections with no H3 inside the main content, then the FAQ, a 3–7 word conclusion header and a 2–3 paragraph conclusion.',
    },
    {
      category: 'structure',
      title: 'Blog FAQ',
      weight: 8,
      template: 'blog',
      rule: 'The FAQ heading is exactly "## Frequently Asked Questions" with 4–5 questions, each its own H3 (never bold or numbered). Answer directly beneath in 2–3 sentences (40–70 words), answering in the first sentence. Link to at most one TWS product or article in the FAQ.',
    },
    {
      category: 'client',
      title: 'Product mentions',
      weight: 7,
      template: 'blog',
      rule: 'Feature 2–3 of the supplied products, named by brand + model (+ a key feature only if essential): drop sizes, materials, gender, specs, non-iconic colours and SKU codes. Link as [Clean Product Name](full product URL), e.g. "Tissot Le Locle Rose Gold".',
    },
    {
      category: 'client',
      title: 'Closing CTA',
      weight: 8,
      template: 'blog',
      rule: 'End the conclusion with the soft CTA: "[Visit The Watch Store PH](https://thewatchstore.ph/pages/contact) today to explore our collection and discover how our team can [specific service benefit related to the topic]."',
    },
    {
      category: 'seo',
      title: 'Keywords and meta',
      weight: 7,
      template: 'blog',
      rule: 'Integrate the SEO keywords naturally with variations and related watch terminology; bold important keywords. Meta title 60 characters or fewer, meta description 155 characters or fewer.',
    },
    {
      category: 'structure',
      title: 'Blog length',
      weight: 7,
      template: 'blog',
      rule: 'Stay within the word count given in the brief (1500–2500 words when none is set). Never exceed it.',
    },
  ],
}
