import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/guards'
import { createVersion, getArticle, updateArticle } from '@/lib/articles/repo'
import { countWords } from '@/lib/articles/text'
import { Errors } from '@/lib/api/errors'
import { cleanGeneratedHtml } from './html'
import { revisionLabel } from '@/lib/prompts/revision'

/**
 * Persists a finished generation: the draft, a `generated` version, the draft model, queued → draft
 * (forced, the one automatic status move), and a `generated` event. Returns the new version number.
 */
export async function persistGeneratedDraft(
  tenantId: string,
  articleId: string,
  rawText: string,
  model: string,
  user: AppUser,
  opts: { usedResearch: boolean; snapshotVersionNo: number | null },
) {
  const html = cleanGeneratedHtml(rawText)
  if (countWords(html) === 0) throw Errors.badRequest('The model returned an empty draft.')

  const current = await getArticle(tenantId, articleId)
  const version = await createVersion(articleId, html, 'generated', user, 'Generated draft')
  const updated = await updateArticle(
    tenantId,
    articleId,
    { draftHtml: html, ...(current.status === 'queued' ? { status: 'draft' as const } : {}) },
    user,
    {
      force: true,
      eventType: 'generated',
      eventPayload: {
        model,
        versionNo: version.versionNo,
        wordCount: version.wordCount,
        usedResearch: opts.usedResearch,
        snapshotVersionNo: opts.snapshotVersionNo,
      },
    },
  )
  // draftModel isn't part of the frozen article patch.
  await db
    .update(articles)
    .set({ draftModel: model })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
  return { versionNo: version.versionNo, wordCount: updated.wordCount ?? 0, status: updated.status }
}

/**
 * Persists a finished revision: the new draft, a `generated` version labelled with the feedback, the
 * draft model, and a `revised` event carrying the full feedback text (article_events.payload). Status
 * is untouched. Returns the new version number.
 */
export async function persistRevisedDraft(
  tenantId: string,
  articleId: string,
  rawText: string,
  model: string,
  user: AppUser,
  opts: { feedback: string; usedResearch: boolean; snapshotVersionNo: number | null },
) {
  const html = cleanGeneratedHtml(rawText)
  if (countWords(html) === 0) throw Errors.badRequest('The model returned an empty draft.')
  const version = await createVersion(articleId, html, 'generated', user, revisionLabel(opts.feedback))
  const updated = await updateArticle(tenantId, articleId, { draftHtml: html }, user, {
    eventType: 'revised',
    eventPayload: {
      model,
      versionNo: version.versionNo,
      wordCount: version.wordCount,
      feedback: opts.feedback,
      usedResearch: opts.usedResearch,
      snapshotVersionNo: opts.snapshotVersionNo,
    },
  })
  await db
    .update(articles)
    .set({ draftModel: model })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
  return { versionNo: version.versionNo, wordCount: updated.wordCount ?? 0 }
}
