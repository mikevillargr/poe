import 'server-only'
import { AIError, type AIProvider, type ProviderId } from '../types'

// Real provider factories. OWNED BY WS-ai: replace each stub with lib/ai/providers/<id>.ts.
// Factories are called per request so keys rotated in Settings take effect immediately.

function notImplemented(id: ProviderId): AIProvider {
  const fail = () => {
    throw new AIError('PROVIDER_NOT_IMPLEMENTED', `The ${id} provider is not implemented yet (WS-ai). Set AI_MOCK=1 to use the mock.`)
  }
  return {
    id,
    listModels: async () => fail(),
    generateText: async () => fail(),
    testKey: async () => fail(),
    // eslint-disable-next-line require-yield
    streamText: async function* () {
      fail()
    },
    // eslint-disable-next-line require-yield
    research: async function* () {
      fail()
    },
  }
}

export const providerFactories: Record<ProviderId, () => Promise<AIProvider>> = {
  anthropic: async () => notImplemented('anthropic'),
  openai: async () => notImplemented('openai'),
  moonshot: async () => notImplemented('moonshot'),
}
