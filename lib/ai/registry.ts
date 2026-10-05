import 'server-only'
import type { AIProvider, ProviderId } from './types'
import { createMockProvider } from './providers/mock'
import { providerFactories } from './providers'

export const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'moonshot']

export function isMockMode(): boolean {
  return process.env.AI_MOCK === '1'
}

export async function getProvider(id: ProviderId): Promise<AIProvider> {
  if (isMockMode()) return createMockProvider(id)
  return providerFactories[id]()
}
