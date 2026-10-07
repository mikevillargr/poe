import { withRoute, json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { deleteLogo, getBranding, LOGO_MAX_BYTES, LOGO_TYPES, saveLogo } from '@/lib/branding'

export const dynamic = 'force-dynamic'

// POST multipart `file` (PNG, JPG, SVG or WebP, ≤ 512 KB) → Branding.
export const POST = withRoute(async ({ req }) => {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw Errors.badRequest('Choose an image file.')
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) throw Errors.badRequest('Use a PNG, JPG, SVG or WebP image.')
  if (file.size > LOGO_MAX_BYTES) throw Errors.badRequest('The logo must be 512 KB or smaller.')
  await saveLogo(file.type, Buffer.from(await file.arrayBuffer()))
  return json(await getBranding())
}, { admin: true })

// DELETE → Branding (back to the agency name in text).
export const DELETE = withRoute(async () => {
  await deleteLogo()
  return json(await getBranding())
}, { admin: true })
