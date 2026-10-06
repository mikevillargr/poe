import 'server-only'
import { getGuidelinesForPrompt, type GuidelineGroup } from '@/lib/guidelines/prompt'

export type { PromptGuideline, GuidelineGroup } from '@/lib/guidelines'

/**
 * The client's active guidelines, grouped by category, heaviest first within a group: client-wide
 * rules plus those scoped to the article's content template. Delegates to lib/guidelines.
 */
export async function getActiveGuidelines(tenantId: string, contentTemplateId?: string | null): Promise<GuidelineGroup[]> {
  return getGuidelinesForPrompt(tenantId, contentTemplateId)
}
