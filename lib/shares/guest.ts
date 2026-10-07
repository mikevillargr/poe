import 'server-only'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ApiError, Errors } from '@/lib/api/errors'
import { allow, clientIp } from '@/lib/api/rate-limit'
import { resolveShareToken, type ShareRow } from './repo'

// DR-021: request helpers for guests on a shared link.

/** The share for this token, or 404 (unknown, malformed or revoked). */
export async function requireShare(token: string): Promise<ShareRow> {
  const share = await resolveShareToken(token)
  if (!share) throw Errors.notFound('Share link')
  return share
}

export function requireComments(share: ShareRow) {
  if (!share.showComments) throw new ApiError(403, 'COMMENTS_OFF', 'Comments are turned off for this link.')
}

/** The guest's browser key (sent as a header, so it never lands in URLs or logs). */
export function guestKey(req: NextRequest): string | null {
  const k = req.headers.get('x-poe-guest')
  return k && /^[A-Za-z0-9_-]{16,64}$/.test(k) ? k : null
}

export function rateLimit(req: NextRequest, token: string, bucket: string, max: number) {
  if (!allow(`${bucket}:${token}:${clientIp(req.headers)}`, max, 10 * 60_000)) {
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please wait a few minutes and try again.')
  }
}

export const guestNameSchema = z.string().trim().min(1, 'Add your name').max(80)
export const guestEmailSchema = z.union([z.literal(''), z.string().trim().email('Check the email address').max(200)]).optional()
export const commentBodySchema = z.string().trim().min(1, 'Write a comment').max(4000)
export const anchorSchema = z.object({ quote: z.string().trim().min(1).max(1000), prefix: z.string().max(64), suffix: z.string().max(64) })
