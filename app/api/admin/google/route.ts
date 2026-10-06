import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { removeServiceAccount, saveServiceAccount, serviceAccountStatus } from '@/lib/google/credentials'
import { sheetsApiError } from '@/lib/templates/http'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ serviceAccountJson: z.string().min(50).max(20000) })

// GET → { configured, clientEmail, source } — the Google service account Poe reads Sheets with (D-002).
export const GET = withRoute(async () => json(await serviceAccountStatus()), { admin: true })

// PUT { serviceAccountJson } → status. The key file is validated, then stored encrypted; never returned.
export const PUT = withRoute(async ({ req, user }) => {
  const { serviceAccountJson } = bodySchema.parse(await req.json())
  try {
    return json(await saveServiceAccount(serviceAccountJson, user))
  } catch (err) {
    sheetsApiError(err)
  }
}, { admin: true })

// DELETE → status (falls back to GOOGLE_SERVICE_ACCOUNT_JSON if the server has it).
export const DELETE = withRoute(async () => json(await removeServiceAccount()), { admin: true })
