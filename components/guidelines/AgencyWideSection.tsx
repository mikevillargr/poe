'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Globe, Loader2 } from 'lucide-react'
import { CATEGORY_SHORT_LABELS, GUIDELINE_CATEGORIES, type GuidelineCategory, type GuidelineDTO } from '@/lib/guidelines'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { CategoryBadge } from '@/components/CategoryBadge'

// DR-013 option A: the live Universal rules this client follows first (D-003). Read-only here; each rule
// has a switch for this client only. The text is edited on the Universal page.

type UniversalForClient = GuidelineDTO & { onForClient: boolean }

export function AgencyWideSection({
  clientId,
  clientName,
  defaultCollapsed,
  canEditUniversal,
}: {
  clientId: string
  clientName: string
  defaultCollapsed: boolean
  canEditUniversal: boolean
}) {
  const { toast } = useToast()
  const [rules, setRules] = useState<UniversalForClient[] | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    apiFetch<{ guidelines: UniversalForClient[] }>(`/api/clients/${clientId}/universal-guidelines`, { errorTitle: 'Couldn’t load the agency-wide rules' })
      .then((d) => setRules(d.guidelines))
      .catch(() => setRules([]))
  }, [clientId])

  const groups = useMemo(() => {
    const byCat = new Map<string, UniversalForClient[]>()
    for (const r of rules ?? []) {
      const key = (GUIDELINE_CATEGORIES as readonly string[]).includes(r.category) ? r.category : 'other'
      byCat.set(key, [...(byCat.get(key) ?? []), r])
    }
    return [...byCat.entries()]
  }, [rules])

  // Rules switched off on the Universal page apply to nobody, so they don't count here.
  const live = (rules ?? []).filter((r) => r.active)
  const onCount = live.filter((r) => r.onForClient).length

  async function toggle(rule: UniversalForClient) {
    const on = !rule.onForClient
    setRules((list) => list?.map((r) => (r.id === rule.id ? { ...r, onForClient: on } : r)) ?? null)
    try {
      await apiFetch(`/api/clients/${clientId}/universal-guidelines/${rule.id}`, { method: 'PUT', body: { on }, errorTitle: 'Failed to update rule' })
    } catch {
      setRules((list) => list?.map((r) => (r.id === rule.id ? { ...r, onForClient: !on } : r)) ?? null)
    }
  }

  return (
    <section className="glass-card overflow-hidden mb-8">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="w-full flex items-start gap-3 px-5 py-4 hover:bg-surface-hover transition-colors text-left"
      >
        <Globe className="w-4 h-4 text-accent shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-display text-heading">Agency-wide rules</h2>
          <p className="text-xs text-muted mt-0.5">
            Every client follows these first. {clientName}’s rules below win where they conflict.
          </p>
        </div>
        <span className="text-xs text-muted font-mono tabular-nums shrink-0 mt-1.5">
          {rules === null ? '…' : `${onCount} of ${live.length} on for ${clientName}`}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted shrink-0 mt-1.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="border-t border-border">
          {rules === null ? (
            <div className="px-5 py-4 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : rules.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">There are no agency-wide rules yet.</p>
          ) : (
            groups.map(([category, list]) => (
              <div key={category} className="border-b border-border last:border-b-0">
                <div className="px-5 pt-3 pb-1">
                  <CategoryBadge category={CATEGORY_SHORT_LABELS[category as GuidelineCategory] ?? 'Other'} />
                </div>
                <ul className="divide-y divide-border">
                  {list.map((r) => {
                    const offEverywhere = !r.active
                    const on = r.active && r.onForClient
                    return (
                      <li key={r.id} className={`flex items-start gap-3 px-5 py-3 ${on ? '' : 'opacity-50'}`}>
                        <div className="min-w-0 flex-1">
                          {r.title && <div className="text-sm font-semibold text-heading">{r.title}</div>}
                          <div className="text-sm text-body whitespace-pre-wrap break-words">{r.rule}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          {offEverywhere ? (
                            <span className="text-[11px] text-muted">Off for all clients</span>
                          ) : (
                            !r.onForClient && <span className="text-[11px] text-muted">Off for this client</span>
                          )}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`${on ? 'Turn off' : 'Turn on'} “${r.title ?? r.rule.slice(0, 40)}” for ${clientName}`}
                            disabled={offEverywhere}
                            onClick={() => toggle(r)}
                            title={offEverywhere ? 'Switched off on the Universal page' : on ? 'Turn off for this client' : 'Turn on for this client'}
                            className={`relative w-9 h-5 rounded-full transition-colors disabled:cursor-not-allowed ${
                              on ? 'bg-accent' : 'bg-surface-hover border border-border'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`}
                            />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
          <p className="px-5 py-3 text-xs text-muted border-t border-border">
            {canEditUniversal ? (
              <>
                The wording is shared by every client.{' '}
                <Link href="/admin/universal-guidelines" className="text-accent hover:underline">
                  Edit on the Universal page
                </Link>
                .
              </>
            ) : (
              'The wording is shared by every client and is edited by a super admin on the Universal page.'
            )}
          </p>
        </div>
      )}
    </section>
  )
}
