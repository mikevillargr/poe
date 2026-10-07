import type { NextRequest } from 'next/server'
import { errorResponse } from './errors'

// DR-021: handlers reachable without a session (shared article links). They never trust the caller beyond a
// valid share token, and every response carries no-index / no-referrer headers.

export const PUBLIC_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
} as const

export function publicRoute<P>(handler: (args: { req: NextRequest; params: P }) => Promise<Response> | Response) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    let res: Response
    try {
      res = await handler({ req, params: await ctx.params })
    } catch (err) {
      res = errorResponse(err)
    }
    for (const [k, v] of Object.entries(PUBLIC_HEADERS)) if (!res.headers.has(k)) res.headers.set(k, v)
    return res
  }
}
