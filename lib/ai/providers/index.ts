import 'server-only'
import type { AIProvider, ProviderId } from '../types'
import { getProviderCredentials } from '../secrets'
import type { CredentialsLoader } from './shared'
import { createAnthropicProvider } from './anthropic'
import { createOpenAIProvider } from './openai'
import { createMoonshotProvider } from './moonshot'

// Real provider factories (WS-ai). Factories are called per request, and each provider instance
// resolves its credentials lazily (DB row → env) once, so keys rotated in Settings take effect on
// the next request. listModels() works without a key (curated list); every other call throws
// AIError('PROVIDER_NOT_CONFIGURED') when no key is set.

function loader(id: ProviderId): CredentialsLoader {
  let p: ReturnType<CredentialsLoader> | null = null
  return () => (p ??= getProviderCredentials(id))
}

export const providerFactories: Record<ProviderId, () => Promise<AIProvider>> = {
  anthropic: async () => createAnthropicProvider(loader('anthropic')),
  openai: async () => createOpenAIProvider(loader('openai')),
  moonshot: async () => createMoonshotProvider(loader('moonshot')),
}
