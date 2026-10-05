// Live smoke test for the real AI providers (WS-ai). Reads keys from the environment only (never
// the DB), never prints them, and makes a few small paid calls.
//
//   npx tsx --conditions=react-server scripts/ai-smoke.ts --provider anthropic|openai|moonshot \
//     [--model <id>] [--role generation|research]
//
// Without --provider it runs all three. A provider whose key isn't set prints "skipped: no key".
// Env: ANTHROPIC_API_KEY, OPENAI_API_KEY, MOONSHOT_API_KEY (+ optional MOONSHOT_BASE_URL,
// MOONSHOT_WEB_SEARCH=rest). Exit code 1 if any step that ran failed.
import { createAnthropicProvider } from '@/lib/ai/providers/anthropic'
import { createOpenAIProvider } from '@/lib/ai/providers/openai'
import { createMoonshotProvider } from '@/lib/ai/providers/moonshot'
import { curatedModels } from '@/lib/ai/models/curated'
import type { AIProvider, ModelRole, ProviderId } from '@/lib/ai/types'

const ENV: Record<ProviderId, string> = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', moonshot: 'MOONSHOT_API_KEY' }
const ALL: ProviderId[] = ['anthropic', 'openai', 'moonshot']

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function build(id: ProviderId, apiKey: string): AIProvider {
  const load = async () => ({ apiKey, baseUrl: id === 'moonshot' ? process.env.MOONSHOT_BASE_URL : undefined })
  if (id === 'anthropic') return createAnthropicProvider(load)
  if (id === 'openai') return createOpenAIProvider(load)
  return createMoonshotProvider(load)
}

async function step(label: string, fn: () => Promise<string>): Promise<boolean> {
  const t = Date.now()
  try {
    const out = await fn()
    console.log(`  ✓ ${label} (${Date.now() - t} ms)${out ? `\n${out.replace(/^/gm, '      ')}` : ''}`)
    return true
  } catch (err) {
    const code = (err as { code?: string }).code
    console.log(`  ✗ ${label}: ${code ? `[${code}] ` : ''}${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function smoke(id: ProviderId, modelArg: string | undefined, role: ModelRole | undefined): Promise<boolean> {
  console.log(`\n${id}`)
  const key = process.env[ENV[id]]
  if (!key) {
    console.log(`  skipped: no key (set ${ENV[id]})`)
    return true
  }
  const p = build(id, key)
  const curated = curatedModels(id)
  const genModel = modelArg ?? curated[0].id
  const researchModel = modelArg ?? curated.find((m) => m.supportsWebSearch)!.id
  let ok = true

  ok = (await step('testKey', async () => {
    const r = await p.testKey()
    if (!r.ok) throw new Error(r.message ?? 'key rejected')
    return r.message ?? ''
  })) && ok
  if (!ok) return false

  ok = (await step('listModels', async () => {
    const models = await p.listModels()
    const live = models.filter((m) => m.source === 'live').length
    const sample = models.slice(0, 6).map((m) => `${m.id}${m.supportsWebSearch ? ' [search]' : ''}${m.deprecated ? ' (deprecated)' : ''}`)
    return `${models.length} models (${live} live): ${sample.join(', ')}${models.length > 6 ? ', …' : ''}`
  })) && ok

  if (role !== 'research') {
    ok = (await step(`streamText ${genModel}`, async () => {
      let text = ''
      let usage = ''
      for await (const ev of p.streamText(genModel, {
        system: 'You are terse.',
        messages: [{ role: 'user', content: 'In one sentence, what is a content brief?' }],
        maxTokens: 300,
      })) {
        if (ev.type === 'delta') text += ev.text
        if (ev.type === 'usage') usage = `in ${ev.usage.inputTokens} / out ${ev.usage.outputTokens} tokens`
      }
      if (!text.trim()) throw new Error('empty response')
      return `${text.trim().slice(0, 300)}\n${usage}`
    })) && ok
  }

  if (role !== 'generation') {
    ok = (await step(`research ${researchModel}`, async () => {
      const queries: string[] = []
      let text = ''
      let citations: { id: string; url: string; title?: string }[] = []
      for await (const ev of p.research(researchModel, {
        system:
          'Research with the web search tool. Answer in 2-3 sentences citing sources as [n], then a <sources> block with one line per source: [n] Title — https://url',
        messages: [{ role: 'user', content: 'What changed in the latest stable Node.js LTS release?' }],
        maxTokens: 2000,
        maxSearches: 2,
      })) {
        if (ev.type === 'search') queries.push(ev.query)
        if (ev.type === 'delta') text += ev.text
        if (ev.type === 'done') citations = ev.citations ?? []
      }
      if (!citations.length) throw new Error(`no citations returned. Text: ${text.slice(0, 200)}`)
      return [
        `queries: ${queries.length ? queries.join(' | ') : '(none reported)'}`,
        ...citations.slice(0, 8).map((c) => `[${c.id}] ${c.title ?? '(no title)'} — ${c.url}`),
      ].join('\n')
    })) && ok
  }
  return ok
}

async function main() {
  const provider = arg('provider') as ProviderId | undefined
  const role = arg('role') as ModelRole | undefined
  if (provider && !ALL.includes(provider)) throw new Error(`--provider must be one of ${ALL.join(', ')}`)
  if (role && role !== 'generation' && role !== 'research') throw new Error('--role must be generation or research')
  let ok = true
  for (const id of provider ? [provider] : ALL) ok = (await smoke(id, arg('model'), role)) && ok
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
