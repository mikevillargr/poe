import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appAssets, appSettings } from '@/lib/db/schema'
import { DEFAULT_BRANDING, type Branding } from './branding-defaults'

export { DEFAULT_BRANDING, type Branding } from './branding-defaults'

// DR-021: the agency branding shown on shared article pages (super admin, Settings → Branding).

export const LOGO_KEY = 'branding.logo'
export const LOGO_MAX_BYTES = 512 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] as const

export async function getBranding(): Promise<Branding> {
  const [[row], [logo]] = await Promise.all([
    db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'branding')).limit(1),
    db.select({ updatedAt: appAssets.updatedAt }).from(appAssets).where(eq(appAssets.key, LOGO_KEY)).limit(1),
  ])
  const v = (row?.value ?? {}) as Partial<Branding>
  return {
    agencyName: v.agencyName?.trim() || DEFAULT_BRANDING.agencyName,
    website: v.website?.trim() || DEFAULT_BRANDING.website,
    about: v.about?.trim() || DEFAULT_BRANDING.about,
    logoUrl: logo ? `/api/public/branding/logo?v=${logo.updatedAt.getTime()}` : null,
  }
}

export async function saveBranding(patch: Partial<Omit<Branding, 'logoUrl'>>, userId: string) {
  const current = await getBranding()
  const value = {
    agencyName: patch.agencyName ?? current.agencyName,
    website: patch.website ?? current.website,
    about: patch.about ?? current.about,
  }
  await db
    .insert(appSettings)
    .values({ key: 'branding', value, updatedBy: userId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: userId, updatedAt: new Date() } })
  return getBranding()
}

export async function saveLogo(mime: string, data: Buffer) {
  await db
    .insert(appAssets)
    .values({ key: LOGO_KEY, mime, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appAssets.key, set: { mime, data, updatedAt: new Date() } })
}

export async function deleteLogo() {
  await db.delete(appAssets).where(eq(appAssets.key, LOGO_KEY))
}

export async function getLogo(): Promise<{ mime: string; data: Buffer } | null> {
  const [row] = await db.select({ mime: appAssets.mime, data: appAssets.data }).from(appAssets).where(eq(appAssets.key, LOGO_KEY)).limit(1)
  return row ?? null
}
