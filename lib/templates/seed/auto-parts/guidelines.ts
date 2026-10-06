// Levittown Ford Parts (LFP) and Subaru Parts Pros (SPP): the same product-FAQ template with different
// brand text (doc: "Levittown Ford Parts and Subaru Parts Pros: product FAQs").

import { NO_LINK_LEAD_INS, type ClientGuidelineSet } from '../guideline-types'

interface AutoPartsBrand {
  slug: string
  name: string
  make: string
  /** "2024 Mustang GT Spoiler"-style examples from the prompt. */
  exampleQuestion: string
  genericQuestion: string
}

function autoPartsGuidelines(b: AutoPartsBrand): ClientGuidelineSet {
  return {
    slug: b.slug,
    name: b.name,
    templates: ['product-faq'],
    guidelines: [
      {
        category: 'brand',
        title: 'Brand voice',
        weight: 8,
        rule: `Write as ${b.name}, a retailer of genuine ${b.make} parts and accessories. Professional parts-retailer voice: clear, actionable answers that name the actual product, vehicle and part.`,
      },
      {
        category: 'brand',
        title: `Genuine ${b.make} parts`,
        weight: 7,
        rule: `Present parts as genuine, OEM-quality ${b.make} parts that meet ${b.make} specifications. Emphasize authenticity, correct fit, warranty and long-term value compared with non-OEM parts.`,
      },
      {
        category: 'client',
        title: 'Products and services',
        weight: 5,
        rule: `${b.name} sells genuine ${b.make} parts (engine, transmission, brake and electrical components), ${b.make} accessories (floor mats, seat covers, cargo management, exterior accessories) and maintenance items (filters, spark plugs, fluids, belts). Services: parts identification, technical consultation, installation guidance and warranty support.`,
      },
      {
        category: 'client',
        title: 'Internal links',
        weight: 7,
        rule: 'Link only to the pages and products supplied for this article, inside answer text as [anchor](URL). Never place links in headings, and never link to the product being written about.',
      },
      { ...NO_LINK_LEAD_INS },
      {
        category: 'seo',
        title: 'Product keyword',
        weight: 7,
        template: 'product-faq',
        rule: 'Use the main product keyword naturally in at least one question and its answer, and include semantic variations of it.',
      },
      {
        category: 'structure',
        title: 'FAQ format',
        weight: 9,
        template: 'product-faq',
        rule: 'No H1. Exactly 10 questions, each an H2 holding only the question text (no numbering or prefixes), followed by its answer as a plain paragraph.',
      },
      {
        category: 'structure',
        title: 'FAQ length',
        weight: 8,
        template: 'product-faq',
        rule: 'The whole FAQ is 600–700 words. Each question is 8–12 words; each answer is 50–60 words (2–4 sentences).',
      },
      {
        category: 'structure',
        title: 'Product-specific questions',
        weight: 9,
        template: 'product-faq',
        rule: `Every question names the actual product, vehicle model and year, part category or feature. Generic questions are not allowed: write "${b.exampleQuestion}", never "${b.genericQuestion}".`,
      },
      {
        category: 'client',
        title: 'Topics to cover',
        weight: 6,
        template: 'product-faq',
        rule: 'Cover fitment and compatibility (model year, trim, engine), installation and tools, warranty and authenticity, shipping and delivery, maintenance and care, returns and exchanges, performance and benefits, materials and build quality, safety and compliance, and price and value.',
      },
      {
        category: 'client',
        title: 'Link set',
        weight: 6,
        template: 'product-faq',
        rule: 'Use the 2 supplied page links (for example returns or payment pages that fit the question) and 2–3 supplied product links.',
      },
    ],
  }
}

export const LFP_GUIDELINES = autoPartsGuidelines({
  slug: 'levittown-ford-parts',
  name: 'Levittown Ford Parts',
  make: 'Ford',
  exampleQuestion: 'Will this 2024 Ford Mustang GT Spoiler fit my Premium Fastback trim?',
  genericQuestion: 'Will this part fit my vehicle?',
})

export const SPP_GUIDELINES = autoPartsGuidelines({
  slug: 'subaru-parts-pros',
  name: 'Subaru Parts Pros',
  make: 'Subaru',
  exampleQuestion: 'Will this 2024 Subaru WRX Spoiler fit my Premium trim?',
  genericQuestion: 'Will this part fit my vehicle?',
})
