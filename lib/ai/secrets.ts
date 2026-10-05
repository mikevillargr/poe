import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiProviderCredentials } from '@/lib/db/schema'
import { AIError, type ProviderId } from './types'

// Provider API keys: AES-256-GCM with APP_ENCRYPTION_KEY (any string; hashed to 32 bytes).
// Lookup order: enabled DB row → environment variable. Keys never leave the server.

const ENV_KEYS: Record<ProviderId, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
}

export const DEFAULT_BASE_URLS: Partial<Record<ProviderId, string>> = {
  moonshot: 'https://api.moonshot.ai/v1',
}

function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw || raw.length < 16) {
    throw new AIError('PROVIDER_NOT_CONFIGURED', 'APP_ENCRYPTION_KEY must be set (at least 16 characters).')
  }
  return createHash('sha256').update(raw).digest()
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return {
    keyCiphertext: ciphertext.toString('base64'),
    keyIv: iv.toString('base64'),
    keyTag: cipher.getAuthTag().toString('base64'),
    keyLast4: plain.slice(-4),
  }
}

export function decryptSecret(row: { keyCiphertext: string; keyIv: string; keyTag: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.keyIv, 'base64'))
  decipher.setAuthTag(Buffer.from(row.keyTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(row.keyCiphertext, 'base64')), decipher.final()]).toString('utf8')
}

export interface ProviderCredentials {
  apiKey: string
  baseUrl?: string
  source: 'db' | 'env'
}

export async function getProviderCredentials(provider: ProviderId): Promise<ProviderCredentials> {
  const [row] = await db.select().from(aiProviderCredentials).where(eq(aiProviderCredentials.provider, provider)).limit(1)
  if (row?.enabled) {
    return { apiKey: decryptSecret(row), baseUrl: row.baseUrl ?? DEFAULT_BASE_URLS[provider], source: 'db' }
  }
  const env = process.env[ENV_KEYS[provider]]
  if (env) return { apiKey: env, baseUrl: DEFAULT_BASE_URLS[provider], source: 'env' }
  throw new AIError('PROVIDER_NOT_CONFIGURED', `No API key configured for ${provider}.`)
}

/** Safe status for the settings UI: never includes the key. */
export async function getProviderStatus(provider: ProviderId) {
  const [row] = await db.select().from(aiProviderCredentials).where(eq(aiProviderCredentials.provider, provider)).limit(1)
  if (row?.enabled) return { provider, configured: true, source: 'db' as const, last4: row.keyLast4, baseUrl: row.baseUrl }
  const env = process.env[ENV_KEYS[provider]]
  if (env) return { provider, configured: true, source: 'env' as const, last4: env.slice(-4), baseUrl: null }
  return { provider, configured: false, source: null, last4: null, baseUrl: null }
}
