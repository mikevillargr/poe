// Mock SSE round trip: provider → toSSEResponse → readSSE. Run with:
//   AI_MOCK=1 npx tsx --conditions=react-server scripts/dev/sse-roundtrip.ts
import { createMockProvider } from '@/lib/ai/providers/mock'
import { toSSEResponse } from '@/lib/ai/sse'
import { readSSE } from '@/lib/ai/client/readSSE'

async function main() {
  const p = createMockProvider('anthropic')
  const counts: Record<string, number> = {}
  let text = ''
  for (const [label, events] of [
    ['generate', p.streamText('mock', { messages: [{ role: 'user', content: 'Title: Best CRM for startups' }] })],
    ['research', p.research('mock', { messages: [{ role: 'user', content: 'crm for startups' }] })],
  ] as const) {
    const res = toSSEResponse(events, { onDone: async () => [{ type: 'saved', articleId: 'test' }] })
    for await (const ev of readSSE(res)) {
      counts[`${label}:${ev.type}`] = (counts[`${label}:${ev.type}`] ?? 0) + 1
      if (label === 'generate' && ev.type === 'delta') text += ev.text
    }
  }
  console.log(counts)
  console.log('generate text starts:', text.slice(0, 50))
  if (!counts['generate:done'] || !counts['generate:saved'] || counts['research:citation'] !== 2) process.exit(1)
}
main()
