// App navigation (DR-001). FROZEN after foundation: change only via INITIATIVE §7.
// Client-scoped items are built from the active client's slug; admin items are super-admin only.
import type { LucideIcon } from 'lucide-react'
import { Home, Upload, BookOpen, Users, Library, Settings, Link2 } from 'lucide-react'

export interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  href: string
  /** Also active for nested routes (e.g. article pages under Home). */
  match: (pathname: string) => boolean
}

export function clientNav(slug: string): NavItem[] {
  const base = `/c/${slug}`
  return [
    {
      key: 'home',
      label: 'Home',
      icon: Home,
      href: base,
      match: (p) => p === base || p.startsWith(`${base}/articles`),
    },
    { key: 'import', label: 'Import', icon: Upload, href: `${base}/import`, match: (p) => p.startsWith(`${base}/import`) },
    // D-002 DR-011 (approved nav change): link lists and Google Sheets.
    { key: 'sources', label: 'Sources', icon: Link2, href: `${base}/sources`, match: (p) => p.startsWith(`${base}/sources`) },
    {
      key: 'guidelines',
      label: 'Guidelines',
      icon: BookOpen,
      href: `${base}/guidelines`,
      match: (p) => p.startsWith(`${base}/guidelines`),
    },
  ]
}

export const ADMIN_NAV: NavItem[] = [
  { key: 'users', label: 'Users', icon: Users, href: '/admin/users', match: (p) => p.startsWith('/admin/users') },
  {
    key: 'universal',
    label: 'Universal guidelines',
    icon: Library,
    href: '/admin/universal-guidelines',
    match: (p) => p.startsWith('/admin/universal-guidelines'),
  },
  { key: 'settings', label: 'Settings', icon: Settings, href: '/settings', match: (p) => p.startsWith('/settings') },
]

/** Same section, different client: /c/old/guidelines → /c/new/guidelines (article pages → Home). */
export function switchClientPath(pathname: string, newSlug: string): string {
  const m = /^\/c\/[^/]+(\/[^/]+)?/.exec(pathname)
  const section = m?.[1]
  if (!section || section === '/articles') return `/c/${newSlug}`
  return `/c/${newSlug}${section}`
}

export const LAST_CLIENT_COOKIE = 'poe_last_client'
