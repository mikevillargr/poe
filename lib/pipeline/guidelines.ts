import 'server-only'
import { getGuidelinesForPrompt, type GuidelineGroup } from '@/lib/guidelines/prompt'

export type { PromptGuideline, GuidelineGroup } from '@/lib/guidelines'

/**
 * The client's active guidelines, grouped by category, heaviest first within a group.
 * Delegates to lib/guidelines (WS-guidelines); the exported shape is unchanged.
 */
export async function getActiveGuidelines(tenantId: string): Promise<GuidelineGroup[]> {
  return getGuidelinesForPrompt(tenantId)
}
