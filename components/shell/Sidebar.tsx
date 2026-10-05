'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Feather, Sun, Moon, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useTheme } from '@/components/ThemeProvider'
import { ADMIN_NAV, clientNav, type NavItem } from '@/lib/nav'
import type { ClientSummary } from '@/lib/clients/schemas'
import { ClientSwitcher } from './ClientSwitcher'

export interface ShellUser {
  name: string
  email: string
  image: string | null
  isSuperAdmin: boolean
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.match(pathname)
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all relative group ${
        isActive ? 'text-[#F1F5F9]' : 'text-[#64748B] hover:text-[#CBD5E1]'
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full shadow-glow-accent" />
      )}
      <item.icon
        className={`w-4 h-4 transition-colors ${isActive ? 'text-accent drop-shadow-[0_0_4px_rgba(232,69,10,0.3)]' : 'group-hover:text-[#CBD5E1]'}`}
      />
      {item.label}
    </Link>
  )
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

// Visual language unchanged from the original Sidebar; the sidebar is dark in both themes.
export function Sidebar({ user, clients }: { user: ShellUser; clients: ClientSummary[] }) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const activeSlug = /^\/c\/([^/]+)/.exec(pathname)?.[1] ?? null

  return (
    <div className="w-[240px] bg-gradient-to-b from-[#0D0D14] to-[#0A0A12] border-r border-white/[0.06] h-screen fixed left-0 top-0 flex flex-col z-50">
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <Feather className="w-5 h-5 text-accent mr-2 drop-shadow-[0_0_8px_rgba(232,69,10,0.5)]" />
        <span className="text-[#F1F5F9] font-display italic font-semibold text-2xl tracking-tight">Poe</span>
      </div>

      <div className="p-4 border-b border-white/[0.06]">
        <ClientSwitcher clients={clients} activeSlug={activeSlug} />
      </div>

      <nav className="flex-1 py-6 flex flex-col gap-1 px-3 overflow-y-auto">
        {activeSlug && clientNav(activeSlug).map((item) => <NavLink key={item.key} item={item} pathname={pathname} />)}

        {user.isSuperAdmin && (
          <>
            <div className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]/70">Admin</div>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.key} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      <div className="px-4 pb-4 border-b border-white/[0.06]">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.06] rounded-input p-2.5 transition-colors group"
        >
          <span className="text-sm font-medium text-[#CBD5E1] group-hover:text-[#F1F5F9]">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <motion.div animate={{ rotate: theme === 'light' ? 180 : 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}>
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#64748B] group-hover:text-accent transition-colors" />
            ) : (
              <Sun className="w-4 h-4 text-accent" />
            )}
          </motion.div>
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-white/[0.1]" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-[#F1F5F9]">
                {initials(user.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#F1F5F9] truncate">{user.name}</div>
              <div className="text-xs text-[#64748B] truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectTo: '/login' })}
            className="text-[#64748B] hover:text-danger transition-colors shrink-0"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
