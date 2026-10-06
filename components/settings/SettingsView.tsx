'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound, Cpu, Eye, EyeOff, Loader2, Check, X, ChevronRight, Globe } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import { GoogleSheetsCard } from './GoogleSheetsCard'
import { MODEL_ROLES, PROVIDER_LABELS, ROLE_LABELS, type ModelInfo, type ModelRole, type ProviderId } from '@/lib/ai/types'

interface ProviderStatus {
  provider: ProviderId
  configured: boolean
  source: 'db' | 'env' | null
  last4: string | null
  baseUrl: string | null
}
interface RoleSetting {
  provider: ProviderId
  modelId: string
  params: { temperature?: number; maxTokens?: number; maxSearches?: number }
}
type Options = Record<ProviderId, { configured: boolean; models: ModelInfo[]; warning?: string }>

const PROVIDERS: ProviderId[] = ['anthropic', 'openai', 'moonshot']
const ROLES: ModelRole[] = MODEL_ROLES
const ROLE_HINTS: Record<ModelRole, string> = {
  generation: 'Writes the article drafts.',
  research: 'Only models that can search the web are listed.',
  utility: 'A fast, low-cost model for small steps such as picking internal links. Uses the text generation model until set.',
}
const MOONSHOT_REGIONS = [
  { label: 'International (api.moonshot.ai)', value: 'https://api.moonshot.ai/v1' },
  { label: 'China (api.moonshot.cn)', value: 'https://api.moonshot.cn/v1' },
]

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}
const inputCls =
  'w-full bg-surface border border-border rounded-input px-4 py-2.5 text-sm text-heading focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all'

// DR-007 option A: AI providers + Models on one page (super admin only).
export function SettingsView({ initialProviders }: { initialProviders: ProviderStatus[] }) {
  const { toast } = useToast()
  const [providers, setProviders] = useState(initialProviders)
  const [editing, setEditing] = useState<ProviderId | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [baseUrl, setBaseUrl] = useState(MOONSHOT_REGIONS[0].value)
  const [busy, setBusy] = useState<string | null>(null)
  const [tests, setTests] = useState<Partial<Record<ProviderId, { ok: boolean; message: string }>>>({})
  const [removing, setRemoving] = useState<ProviderId | null>(null)

  const [options, setOptions] = useState<Options | null>(null)
  const [roles, setRoles] = useState<Partial<Record<ModelRole, RoleSetting>>>({})
  const [saved, setSaved] = useState<string>('')
  const [advanced, setAdvanced] = useState(false)

  async function loadModels() {
    try {
      const d = await apiFetch<{ roles: Partial<Record<ModelRole, RoleSetting>>; options: Options }>('/api/admin/model-roles', {
        errorTitle: 'Couldn’t load models',
      })
      setOptions(d.options)
      setRoles(d.roles)
      setSaved(JSON.stringify(d.roles))
    } catch {}
  }
  useEffect(() => {
    loadModels()
  }, [])

  const status = (p: ProviderId) => providers.find((s) => s.provider === p)
  const replaceStatus = (s: ProviderStatus) => setProviders((list) => list.map((x) => (x.provider === s.provider ? s : x)))

  async function saveKey(p: ProviderId) {
    setBusy(`save-${p}`)
    try {
      const { provider } = await apiFetch<{ provider: ProviderStatus }>(`/api/admin/providers/${p}`, {
        method: 'PUT',
        errorTitle: `Couldn’t save the ${PROVIDER_LABELS[p]} key`,
        body: { apiKey: keyInput, baseUrl: p === 'moonshot' ? baseUrl : null },
      })
      replaceStatus(provider)
      setEditing(null)
      setKeyInput('')
      setTests((t) => ({ ...t, [p]: undefined }))
      toast.success(`${PROVIDER_LABELS[p]} key saved`, `Stored encrypted. Ends in ${provider.last4}.`)
      loadModels()
    } catch {
    } finally {
      setBusy(null)
    }
  }

  async function test(p: ProviderId) {
    setBusy(`test-${p}`)
    try {
      const r = await apiFetch<{ ok: boolean; message: string }>(`/api/admin/providers/${p}/test`, {
        method: 'POST',
        errorTitle: 'Test failed',
      })
      setTests((t) => ({ ...t, [p]: r }))
    } catch {
    } finally {
      setBusy(null)
    }
  }

  async function confirmRemove() {
    const p = removing
    setRemoving(null)
    if (!p) return
    try {
      const { provider } = await apiFetch<{ provider: ProviderStatus }>(`/api/admin/providers/${p}`, {
        method: 'DELETE',
        errorTitle: 'Couldn’t remove the key',
      })
      replaceStatus(provider)
      setTests((t) => ({ ...t, [p]: undefined }))
      toast.info(
        `${PROVIDER_LABELS[p]} key removed`,
        provider.configured ? 'Now using the server environment key.' : 'This provider is no longer configured.',
      )
      loadModels()
    } catch {}
  }

  function setRole(role: ModelRole, patch: Partial<RoleSetting>) {
    setRoles((r) => {
      const current = r[role] ?? { provider: 'anthropic' as ProviderId, modelId: '', params: {} }
      const next = { ...current, ...patch, params: { ...current.params, ...(patch.params ?? {}) } }
      if (patch.provider && patch.provider !== current.provider) next.modelId = ''
      return { ...r, [role]: next }
    })
  }

  const dirty = JSON.stringify(roles) !== saved
  const rolesValid = ROLES.every((r) => !roles[r] || roles[r]!.modelId)

  async function saveRoles() {
    setBusy('roles')
    try {
      const d = await apiFetch<{ roles: Partial<Record<ModelRole, RoleSetting>> }>('/api/admin/model-roles', {
        method: 'PUT',
        errorTitle: 'Couldn’t save models',
        body: Object.fromEntries(ROLES.filter((r) => roles[r]?.modelId).map((r) => [r, roles[r]])),
      })
      setRoles(d.roles)
      setSaved(JSON.stringify(d.roles))
      toast.success('Models saved', 'They apply to the next research or generation run.')
    } catch {
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-10 max-w-4xl mx-auto">
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-3xl font-display text-heading mb-2">Settings</h1>
        <p className="text-muted">AI providers, the models Poe uses for research and writing, and Google Sheets. Only super admins can see this page.</p>
      </motion.div>

      {/* AI providers */}
      <motion.div variants={itemVariants} className="glass-card mb-6">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <KeyRound className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-display text-heading">AI providers</h2>
        </div>
        <div className="divide-y divide-border">
          {PROVIDERS.map((p) => {
            const s = status(p)
            const t = tests[p]
            const isEditing = editing === p
            return (
              <div key={p} className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-heading">{PROVIDER_LABELS[p]}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {s?.configured ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-green-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
                          </span>
                          <span className="text-muted">
                            · {s.source === 'env' ? 'from the server environment' : 'saved in Poe'} ·{' '}
                            <span className="font-mono">••••••••{s.last4}</span>
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#64748B]" /> Not configured
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t && (
                      <span
                        title={t.message}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border max-w-[220px] truncate ${
                          t.ok ? 'bg-success/10 text-green-500 border-success/20' : 'bg-danger/10 text-red-400 border-danger/20'
                        }`}
                      >
                        {t.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {t.ok ? 'Working' : t.message}
                      </span>
                    )}
                    {s?.configured && (
                      <button
                        type="button"
                        onClick={() => test(p)}
                        disabled={busy === `test-${p}`}
                        className="px-4 py-2 bg-surface border border-border hover:bg-surface-hover text-heading rounded-input text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        {busy === `test-${p}` && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Test
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(isEditing ? null : p)
                        setKeyInput('')
                        setShowKey(false)
                        setBaseUrl(s?.baseUrl ?? MOONSHOT_REGIONS[0].value)
                      }}
                      className="px-4 py-2 bg-surface border border-border hover:bg-surface-hover text-heading rounded-input text-sm font-medium transition-colors"
                    >
                      {s?.source === 'db' ? 'Replace' : 'Set key'}
                    </button>
                    {s?.source === 'db' && (
                      <button
                        type="button"
                        onClick={() => setRemoving(p)}
                        aria-label={`Remove ${PROVIDER_LABELS[p]} key`}
                        className="p-2 text-muted hover:text-danger hover:bg-surface-hover rounded-input transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isEditing && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (keyInput.trim().length >= 8) saveKey(p)
                      }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input
                              autoFocus
                              type={showKey ? 'text' : 'password'}
                              value={keyInput}
                              onChange={(e) => setKeyInput(e.target.value)}
                              placeholder={`Paste your ${PROVIDER_LABELS[p]} API key`}
                              autoComplete="off"
                              spellCheck={false}
                              className={`${inputCls} font-mono pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey((v) => !v)}
                              aria-label={showKey ? 'Hide key' : 'Show key'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading transition-colors"
                            >
                              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button
                            type="submit"
                            disabled={keyInput.trim().length < 8 || busy === `save-${p}`}
                            className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {busy === `save-${p}` && <Loader2 className="w-4 h-4 animate-spin" />} Save
                          </button>
                        </div>
                        {p === 'moonshot' && (
                          <label className="flex items-center gap-3 text-sm text-muted">
                            <Globe className="w-4 h-4" /> API region
                            <select value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={`${inputCls} max-w-xs py-1.5 cursor-pointer`}>
                              {MOONSHOT_REGIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <p className="text-xs text-muted">The key is encrypted on the server and can’t be viewed again. Only its last four characters are shown.</p>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Models */}
      <motion.div variants={itemVariants} className="glass-card mb-6">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Cpu className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-display text-heading">Models</h2>
        </div>
        <div className="p-6 space-y-6">
          {!options ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
            </div>
          ) : (
            <>
              {ROLES.map((role) => (
                <RoleRow key={role} role={role} setting={roles[role]} options={options} onChange={(patch) => setRole(role, patch)} />
              ))}

              <div>
                <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex items-center gap-1 text-sm text-muted hover:text-heading transition-colors">
                  <ChevronRight className={`w-4 h-4 transition-transform ${advanced ? 'rotate-90' : ''}`} /> Advanced
                </button>
                {advanced && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <label className="block">
                      <span className="block text-sm font-medium text-heading mb-2">Generation temperature</span>
                      <input
                        type="number"
                        step={0.1}
                        min={0}
                        max={2}
                        placeholder="Provider default"
                        value={roles.generation?.params.temperature ?? ''}
                        onChange={(e) => setRole('generation', { params: { temperature: e.target.value === '' ? undefined : Number(e.target.value) } })}
                        disabled={!roles.generation}
                        className={`${inputCls} font-mono tabular-nums disabled:opacity-50`}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-medium text-heading mb-2">Max web searches per research run</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        placeholder="5"
                        value={roles.research?.params.maxSearches ?? ''}
                        onChange={(e) => setRole('research', { params: { maxSearches: e.target.value === '' ? undefined : Number(e.target.value) } })}
                        disabled={!roles.research}
                        className={`${inputCls} font-mono tabular-nums disabled:opacity-50`}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-xs text-muted">Changes apply to the next research or generation run.</p>
                <button
                  type="button"
                  onClick={saveRoles}
                  disabled={!dirty || !rolesValid || busy === 'roles'}
                  className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {busy === 'roles' && <Loader2 className="w-4 h-4 animate-spin" />} Save models
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <GoogleSheetsCard />

      <ConfirmModal
        isOpen={!!removing}
        title="Remove API key"
        message={`Poe will stop using the saved ${removing ? PROVIDER_LABELS[removing] : ''} key. If the server has an environment key for this provider, Poe falls back to it; otherwise research and generation with this provider stop working.`}
        confirmLabel="Remove key"
        confirmVariant="danger"
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </motion.div>
  )
}

function RoleRow({
  role,
  setting,
  options,
  onChange,
}: {
  role: ModelRole
  setting?: RoleSetting
  options: Options
  onChange: (patch: Partial<RoleSetting>) => void
}) {
  const provider = setting?.provider
  const models = useMemo(() => {
    if (!provider) return []
    const all = options[provider]?.models ?? []
    return role === 'research' ? all.filter((m) => m.supportsWebSearch) : all
  }, [options, provider, role])
  const warning = provider ? options[provider]?.warning : undefined

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="block text-sm font-medium text-heading">{ROLE_LABELS[role]}</label>
        <span className="text-xs text-muted">
          {ROLE_HINTS[role]}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
        <select
          value={provider ?? ''}
          onChange={(e) => onChange({ provider: e.target.value as ProviderId })}
          className={`${inputCls} cursor-pointer`}
          aria-label={`${ROLE_LABELS[role]} provider`}
        >
          <option value="" disabled>
            Choose a provider
          </option>
          {PROVIDERS.map((p) => (
            <option key={p} value={p} disabled={!options[p]?.configured}>
              {PROVIDER_LABELS[p]}
              {options[p]?.configured ? '' : ' (add a key first)'}
            </option>
          ))}
        </select>
        <select
          value={setting?.modelId ?? ''}
          onChange={(e) => onChange({ modelId: e.target.value })}
          disabled={!provider}
          className={`${inputCls} cursor-pointer disabled:opacity-50`}
          aria-label={`${ROLE_LABELS[role]} model`}
        >
          <option value="" disabled>
            {provider ? (models.length ? 'Choose a model' : 'No suitable models') : 'Choose a provider first'}
          </option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.supportsWebSearch ? ' · web search' : ''}
              {m.deprecated ? ' (deprecated)' : ''}
            </option>
          ))}
        </select>
      </div>
      {warning && <p className="text-xs text-orange-500 mt-2">{warning}</p>}
    </div>
  )
}
