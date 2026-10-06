// Hook ids a template can reference. The logic lives in the modules next to this file; the runtime
// (tpl-runtime) wires each id to its data (inventories, client facts, page fetch). Staff pick from this
// list in the template editor; adding a hook is a code change.

export const TEMPLATE_HOOKS = {
  'product-page': {
    label: 'Read the live product page',
    description: 'Fetches the row’s product URL and fills {{PRODUCT_DETAILS}} from the description block. The row fails if the block is missing.',
  },
  'ut-tribe-links': {
    label: 'United Tribes: tribe-filtered links',
    description: 'Detects the tribe in the title and brief, filters published articles to that tribe, and fills {{AGGREGATED_URLS}} and {{CONTEXT_NOTE}}.',
  },
  'ut-cta-style': {
    label: 'United Tribes: rotating CTA style',
    description: 'Fills {{CTA_STYLE}} with one of the six CTA directions, assigned in queue order.',
  },
  'fifa-links': {
    label: 'FIFA: links for every team’s tribe',
    description: 'Filters published articles to every tribe in the match-up.',
  },
  'fifa-city-directory': {
    label: 'FIFA: host-city directory links',
    description: 'Detects the host city and fills {{CITY_DIRECTORY_LINKS}} and {{DETECTED_CITY}} from the Links by City inventory.',
  },
  'tribe-page-inputs': {
    label: 'United Tribes: community page inputs',
    description: 'Builds {{TRIBE_LABEL}}, {{PAGE_URL}} and {{KEYWORDS}} from the community-page sheet row.',
  },
} as const

export type TemplateHookId = keyof typeof TEMPLATE_HOOKS

export const isTemplateHook = (id: string): id is TemplateHookId => id in TEMPLATE_HOOKS
