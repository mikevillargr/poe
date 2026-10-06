import 'server-only'
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/guards'
import { getArticle } from '@/lib/articles/repo'
import { startTemplateGeneration } from './run'

// "Generate queued" for templated articles: an in-process queue, two generations at a time, each one
// the same detached run the Generate button starts. Like runs, the queue lives in this process: after a
// restart, start it again; it only picks articles that aren't already generated or running.

const CONCURRENCY = 2

interface ClientLike {
  id: string
  name: string
  website: string | null
}

export type BatchItemState = 'queued' | 'running' | 'done' | 'needs-review' | 'failed'

interface BatchItem {
  articleId: string
  title: string
  state: BatchItemState
  message?: string
}

interface ClientBatch {
  items: BatchItem[]
  startedAt: string
  startedBy: string
}

interface Job {
  client: ClientLike
  item: BatchItem
  user: AppUser
}

interface BatchState {
  batches: Map<string, ClientBatch>
  queue: Job[]
  active: number
}
const g = globalThis as unknown as { __poeTemplateBatch?: BatchState }
const state: BatchState = (g.__poeTemplateBatch ??= { batches: new Map<string, ClientBatch>(), queue: [], active: 0 })

const isFinished = (b: ClientBatch) => b.items.every((i) => i.state !== 'queued' && i.state !== 'running')

/**
 * Queues the client's templated articles that are still `queued` with nothing generated or running.
 * `articleIds` narrows the selection. Returns what was queued and what was skipped.
 */
export async function startBatch(client: ClientLike, user: AppUser, articleIds?: string[]) {
  const current = state.batches.get(client.id)
  if (current && !isFinished(current)) {
    return { queued: 0, skipped: [], alreadyRunning: true }
  }
  const rows = await db
    .select({ id: articles.id, title: articles.title, status: articles.status, generationStatus: articles.generationStatus })
    .from(articles)
    .where(and(eq(articles.tenantId, client.id), isNotNull(articles.templateId), articleIds?.length ? inArray(articles.id, articleIds) : undefined))
    .orderBy(asc(articles.position))

  const skipped: { articleId: string; title: string; reason: string }[] = []
  const items: BatchItem[] = []
  for (const r of rows) {
    if (r.status !== 'queued') skipped.push({ articleId: r.id, title: r.title, reason: 'Already past Queued' })
    else if (r.generationStatus === 'running') skipped.push({ articleId: r.id, title: r.title, reason: 'Already generating' })
    else items.push({ articleId: r.id, title: r.title, state: 'queued' })
  }
  if (articleIds?.length) {
    for (const id of articleIds) {
      if (!rows.some((r) => r.id === id)) skipped.push({ articleId: id, title: '', reason: 'Not a templated article for this client' })
    }
  }
  state.batches.set(client.id, { items, startedAt: new Date().toISOString(), startedBy: user.email ?? user.id })
  for (const item of items) state.queue.push({ client, item, user })
  pump()
  return { queued: items.length, skipped, alreadyRunning: false }
}

export function batchStatus(tenantId: string) {
  const b = state.batches.get(tenantId)
  if (!b) return null
  const counts = { queued: 0, running: 0, done: 0, 'needs-review': 0, failed: 0 } as Record<BatchItemState, number>
  for (const i of b.items) counts[i.state]++
  return { startedAt: b.startedAt, startedBy: b.startedBy, finished: isFinished(b), counts, items: b.items }
}

function pump() {
  while (state.active < CONCURRENCY && state.queue.length) {
    const job = state.queue.shift()!
    state.active++
    runJob(job)
      .catch((err) => {
        job.item.state = 'failed'
        job.item.message = err instanceof Error ? err.message : 'Generation failed.'
      })
      .finally(() => {
        state.active--
        pump()
      })
  }
}

async function runJob({ client, item, user }: Job) {
  item.state = 'running'
  const article = await getArticle(client.id, item.articleId)
  const run = await startTemplateGeneration(client, article, user)
  await run.whenDone()
  const error = run.events.find((e) => e.type === 'error')
  if (error && error.type === 'error') {
    item.state = 'failed'
    item.message = error.message
    return
  }
  const last = [...run.events].reverse().find((e) => e.type === 'step')
  item.state = last && last.type === 'step' && last.step === 'needs-review' ? 'needs-review' : 'done'
  if (last && last.type === 'step') item.message = last.label
}
