import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { googleCredentials } from '@/lib/db/schema'
import { decryptSecret, encryptSecret } from '@/lib/ai/secrets'
import type { AppUser } from '@/lib/auth/guards'
import { parseServiceAccountJson, SheetsError, type ServiceAccount } from './sheets'

// The agency's Google service account for reading Sheets: the key file (JSON) is stored AES-256-GCM
// encrypted (google_credentials, one row), with GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON or base64) as the
// environment fallback. Only the client email is ever shown.

const ID = 'service_account'

export async function getServiceAccount(): Promise<ServiceAccount & { source: 'db' | 'env' }> {
  const [row] = await db.select().from(googleCredentials).where(eq(googleCredentials.id, ID)).limit(1)
  if (row) return { ...parseServiceAccountJson(decryptSecret(row)), source: 'db' }
  const env = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (env?.trim()) return { ...parseServiceAccountJson(env), source: 'env' }
  throw new SheetsError('SHEETS_NOT_CONFIGURED', 'Google Sheets isn’t connected yet: add the service-account key in Settings.')
}

export async function serviceAccountStatus(): Promise<{ configured: boolean; clientEmail: string | null; source: 'db' | 'env' | null }> {
  try {
    const sa = await getServiceAccount()
    return { configured: true, clientEmail: sa.clientEmail, source: sa.source }
  } catch {
    return { configured: false, clientEmail: null, source: null }
  }
}

export async function saveServiceAccount(json: string, user: AppUser) {
  const sa = parseServiceAccountJson(json) // validate before storing
  const enc = encryptSecret(json.trim())
  const values = { id: ID, clientEmail: sa.clientEmail, keyCiphertext: enc.keyCiphertext, keyIv: enc.keyIv, keyTag: enc.keyTag, updatedBy: user.id, updatedAt: new Date() }
  await db.insert(googleCredentials).values(values).onConflictDoUpdate({ target: googleCredentials.id, set: values })
  return serviceAccountStatus()
}

export async function removeServiceAccount() {
  await db.delete(googleCredentials).where(eq(googleCredentials.id, ID))
  return serviceAccountStatus()
}
