import { getLogo } from '@/lib/branding'
import { Errors } from '@/lib/api/errors'
import { publicRoute } from '@/lib/api/public'

export const dynamic = 'force-dynamic'

// GET → the agency logo (DR-021). Versioned by `?v=` from getBranding(), so it can be cached hard.
export const GET = publicRoute(async () => {
  const logo = await getLogo()
  if (!logo) throw Errors.notFound('Logo')
  return new Response(new Uint8Array(logo.data), {
    headers: {
      'Content-Type': logo.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      // An uploaded SVG must never run script.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
