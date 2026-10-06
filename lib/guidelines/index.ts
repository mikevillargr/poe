// Barrel for the guidelines domain. Server-only runtime pieces (repo, prompt queries) are NOT
// re-exported here so client components can safely import categories, schemas and types.
export * from './categories'
export * from './schemas'
export type { PromptGuideline, GuidelineGroup, GuidelineTier } from './render'
export { renderGuidelineTiers, TIER_HEADINGS } from './render'
