'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNowStrict } from 'date-fns'
import { UserCheck, Search, MoreVertical, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import type { AdminUserDTO } from '@/lib/admin/users'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}
const ago = (iso: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : '—')

function Avatar({ u }: { u: AdminUserDTO }) {
  return u.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={u.image} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-border shrink-0" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-surface-hover border border-border flex items-center justify-center text-xs font-bold text-heading shrink-0">
      {u.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
    </div>
  )
}

type Confirm = { user: AdminUserDTO; kind: 'deny' | 'disable' } | null

// DR-008 option A: approval queue card + people table.
export function UsersView({ initialUsers, currentUserId }: { initialUsers: AdminUserDTO[]; currentUserId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [menu, setMenu] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const pending = users.filter((u) => u.status === 'pending')
  const activeAdmins = users.filter((u) => u.role === 'super_admin' && u.status === 'active').length
  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter(
      (u) =>
        u.status !== 'pending' &&
        (statusFilter === 'all' || u.status === statusFilter) &&
        (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
    )
  }, [users, query, statusFilter])

  async function change(u: AdminUserDTO, body: { status?: 'active' | 'disabled'; role?: 'super_admin' | 'member' }, done: string) {
    setBusy(u.id)
    setMenu(null)
    try {
      const { user } = await apiFetch<{ user: AdminUserDTO }>(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body,
        errorTitle: `Couldn’t update ${u.name}`,
      })
      setUsers((list) => list.map((x) => (x.id === user.id ? user : x)))
      toast.success(done)
      router.refresh() // refreshes the sidebar's pending badge
    } catch {
    } finally {
      setBusy(null)
    }
  }

  // Why a menu item is unavailable (DR-008 guards), mirrored from the server so the UI explains itself.
  function guard(u: AdminUserDTO, action: 'demote' | 'disable'): string | null {
    if (u.id === currentUserId) return action === 'demote' ? 'You can’t demote yourself.' : 'You can’t disable yourself.'
    if (u.role === 'super_admin' && u.status === 'active' && activeAdmins <= 1) return 'Poe needs at least one active super admin.'
    return null
  }

  const pill = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap'

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-8 xl:p-10 max-w-[1200px] mx-auto">
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-3xl font-display text-heading mb-2">Users</h1>
        <p className="text-muted">
          Anyone with a @growth-rocket.com Google account can request access. Approved people can see every client.
        </p>
      </motion.div>

      <AnimatePresence>
        {pending.length > 0 && (
          <motion.section
            variants={itemVariants}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card mb-8 border-l-[3px] border-l-accent overflow-hidden"
          >
            <div className="p-5 border-b border-border flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-display text-heading">
                Waiting for approval <span className="font-mono tabular-nums text-accent">({pending.length})</span>
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {pending.map((u) => (
                <li key={u.id} className="px-5 py-3 flex items-center gap-4">
                  <Avatar u={u} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-heading truncate">{u.name}</div>
                    <div className="text-xs text-muted truncate">{u.email}</div>
                  </div>
                  <span className="text-xs text-muted font-mono whitespace-nowrap">requested {ago(u.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => change(u, { status: 'active' }, `${u.name} approved`)}
                    disabled={busy === u.id}
                    className="bg-accent hover:bg-accent/90 text-white px-4 py-1.5 rounded-input text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ user: u, kind: 'deny' })}
                    disabled={busy === u.id}
                    className="px-4 py-1.5 rounded-input text-sm text-muted hover:text-heading border border-border hover:bg-surface-hover disabled:opacity-50"
                  >
                    Deny
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-display text-heading">People</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className="w-64 pl-9 pr-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-sm text-heading cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        <div className="glass-card p-0 overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Last sign-in', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((u) => {
                const demoteBlock = guard(u, 'demote')
                const disableBlock = guard(u, 'disable')
                return (
                  <tr key={u.id} className="group hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 pl-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar u={u} />
                        <span className="text-sm font-medium text-heading truncate">
                          {u.name}
                          {u.id === currentUserId && <span className="text-muted font-normal"> (you)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-body truncate max-w-[260px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`${pill} ${u.role === 'super_admin' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface text-body border-border'}`}>
                        {u.role === 'super_admin' ? 'Super admin' : 'Member'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`${pill} ${u.status === 'active' ? 'bg-success/10 text-green-500 border-success/20' : 'bg-[#64748B]/10 text-muted border-[#64748B]/20'}`}>
                        {u.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted font-mono whitespace-nowrap">{ago(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-sm text-muted font-mono whitespace-nowrap">{ago(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right relative">
                      {busy === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted inline" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMenu(menu === u.id ? null : u.id)}
                          aria-label={`Actions for ${u.name}`}
                          className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      )}
                      {menu === u.id && (
                        <div className="absolute right-4 top-11 z-20 w-56 rounded-card border border-border bg-surface shadow-xl py-1 text-left" onMouseLeave={() => setMenu(null)}>
                          {u.role === 'member' ? (
                            <MenuItem
                              label="Make super admin"
                              disabled={u.status !== 'active' ? 'Re-enable them first.' : null}
                              onClick={() => change(u, { role: 'super_admin' }, `${u.name} is now a super admin`)}
                            />
                          ) : (
                            <MenuItem label="Make member" disabled={demoteBlock} onClick={() => change(u, { role: 'member' }, `${u.name} is now a member`)} />
                          )}
                          {u.status === 'active' ? (
                            <MenuItem label="Disable access" danger disabled={disableBlock} onClick={() => setConfirm({ user: u, kind: 'disable' })} />
                          ) : (
                            <MenuItem label="Re-enable access" disabled={null} onClick={() => change(u, { status: 'active' }, `${u.name} re-enabled`)} />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {people.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    No one matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.kind === 'deny' ? 'Deny access' : 'Disable access'}
        message={
          confirm?.kind === 'deny'
            ? `${confirm.user.name} (${confirm.user.email}) won’t be able to use Poe. You can re-enable them later from the People list.`
            : `${confirm?.user.name ?? ''} will be signed out of Poe on their next request and won’t be able to sign back in until re-enabled.`
        }
        confirmLabel={confirm?.kind === 'deny' ? 'Deny access' : 'Disable access'}
        confirmVariant="danger"
        onConfirm={() => {
          const c = confirm
          setConfirm(null)
          if (c) change(c.user, { status: 'disabled' }, c.kind === 'deny' ? `${c.user.name} denied` : `${c.user.name} disabled`)
        }}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  )
}

function MenuItem({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled: string | null; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={disabled ?? undefined}
      aria-disabled={!!disabled}
      className={`w-full px-4 py-2 text-sm text-left transition-colors ${
        disabled ? 'text-muted/60 cursor-not-allowed' : danger ? 'text-red-400 hover:bg-danger/10' : 'text-body hover:bg-surface-hover hover:text-heading'
      }`}
    >
      {label}
      {disabled && <span className="block text-[11px] text-muted">{disabled}</span>}
    </button>
  )
}
