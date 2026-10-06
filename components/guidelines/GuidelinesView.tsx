'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Info, Plus, Upload } from 'lucide-react'
import { arrayMove } from '@dnd-kit/sortable'
import { GUIDELINE_CATEGORIES, type GuidelineCategory, type GuidelineDTO } from '@/lib/guidelines'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import { GuidelineSection } from './GuidelineSection'
import { GuidelineRow } from './GuidelineRow'
import { GuidelineForm, type GuidelineFormValues } from './GuidelineForm'
import { ImportFromDocumentModal } from './ImportFromDocumentModal'
import { TemplateScopeContext } from './TemplateScopeContext'
import { useClientTemplates } from '@/components/workspace/TemplatePicker'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}

export type GuidelinesScope =
  | { kind: 'client'; clientId: string; clientName: string; clientSlug: string }
  | { kind: 'universal' }

// DR-006 option A: categorized sections on one page, shared between the per-client editor and
// the admin Universal template editor.
export function GuidelinesView({
  scope,
  initialGuidelines,
}: {
  scope: GuidelinesScope
  initialGuidelines: GuidelineDTO[]
}) {
  const { toast } = useToast()
  const [guidelines, setGuidelines] = useState(initialGuidelines)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingInCategory, setAddingInCategory] = useState<GuidelineCategory | null>(null)
  const [addingTop, setAddingTop] = useState(false)
  const [collapsed, setCollapsed] = useState<Partial<Record<GuidelineCategory, boolean>>>({})
  const [deleting, setDeleting] = useState<GuidelineDTO | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => setGuidelines(initialGuidelines), [initialGuidelines])

  // D-002: rules can apply to the whole client or to one content template.
  const clientTemplates = useClientTemplates(scope.kind === 'client' ? scope.clientId : '')
  const scopeTemplates = useMemo(() => (scope.kind === 'client' ? (clientTemplates ?? []).map((t) => ({ id: t.id, name: t.name })) : []), [scope, clientTemplates])
  const [appliesTo, setAppliesTo] = useState('')
  const shown = useMemo(
    () =>
      guidelines.filter((g) =>
        !appliesTo ? true : appliesTo === 'client' ? !g.contentTemplateId : g.contentTemplateId === appliesTo,
      ),
    [guidelines, appliesTo],
  )

  const base = scope.kind === 'client' ? `/api/clients/${scope.clientId}/guidelines` : '/api/admin/universal-guidelines'

  const groups = useMemo(() => {
    const map = new Map<GuidelineCategory, GuidelineDTO[]>()
    for (const c of GUIDELINE_CATEGORIES) map.set(c, [])
    for (const g of shown) {
      const list = map.get(g.category as GuidelineCategory)
      if (list) list.push(g)
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)
    return map
  }, [shown])

  // Rules whose category isn't canonical (e.g. ingested before the canonical set). They are shown
  // so they're never hidden; editing one asks for a canonical category.
  const uncategorized = useMemo(
    () => shown.filter((g) => !(GUIDELINE_CATEGORIES as readonly string[]).includes(g.category)),
    [shown],
  )

  function closeForms() {
    setEditingId(null)
    setAddingInCategory(null)
    setAddingTop(false)
  }

  async function toggleActive(g: GuidelineDTO) {
    const next = !g.active
    setGuidelines((list) => list.map((x) => (x.id === g.id ? { ...x, active: next } : x)))
    try {
      const { guideline } = await apiFetch<{ guideline: GuidelineDTO }>(`${base}/${g.id}`, {
        method: 'PATCH',
        errorTitle: 'Couldn’t update the guideline',
        body: { active: next },
      })
      setGuidelines((list) => list.map((x) => (x.id === g.id ? guideline : x)))
    } catch {
      setGuidelines((list) => list.map((x) => (x.id === g.id ? g : x)))
    }
  }

  async function saveGuideline(values: GuidelineFormValues, existing?: GuidelineDTO) {
    if (saving) return
    setSaving(true)
    const body = {
      category: values.category,
      title: values.title.trim() || null,
      rule: values.rule.trim(),
      weight: values.weight,
      ...(scope.kind === 'client' ? { contentTemplateId: values.contentTemplateId } : {}),
    }
    try {
      if (existing) {
        const { guideline } = await apiFetch<{ guideline: GuidelineDTO }>(`${base}/${existing.id}`, {
          method: 'PATCH',
          errorTitle: 'Couldn’t save the guideline',
          body,
        })
        setGuidelines((list) => list.map((x) => (x.id === existing.id ? guideline : x)))
        toast.success('Guideline updated')
      } else {
        const { guideline } = await apiFetch<{ guideline: GuidelineDTO }>(base, {
          method: 'POST',
          errorTitle: 'Couldn’t add the guideline',
          body,
        })
        setGuidelines((list) => [...list, guideline])
        toast.success('Guideline added')
      }
      closeForms()
    } catch {
      // apiFetch already toasted
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    const target = deleting
    setDeleting(null)
    if (!target) return
    const previous = guidelines
    setGuidelines((list) => list.filter((x) => x.id !== target.id))
    try {
      await apiFetch(`${base}/${target.id}`, { method: 'DELETE', errorTitle: 'Delete failed' })
      toast.success('Guideline deleted')
    } catch {
      setGuidelines(previous)
    }
  }

  async function reorder(category: GuidelineCategory, activeId: string, overId: string) {
    const list = groups.get(category) ?? []
    const from = list.findIndex((g) => g.id === activeId)
    const to = list.findIndex((g) => g.id === overId)
    if (from < 0 || to < 0) return
    const previous = guidelines
    const nextList = arrayMove(list, from, to)
    const orders = list.map((g) => g.sortOrder) // ascending; reassigned to the new order
    const moved = new Map(nextList.map((g, i) => [g.id, orders[i]]))
    setGuidelines((gs) => gs.map((g) => (moved.has(g.id) ? { ...g, sortOrder: moved.get(g.id)! } : g)))
    try {
      await apiFetch(`${base}/reorder`, {
        method: 'POST',
        errorTitle: 'Couldn’t reorder guidelines',
        body: { category, orderedIds: nextList.map((g) => g.id) },
      })
    } catch {
      setGuidelines(previous)
    }
  }

  return (
    <TemplateScopeContext.Provider value={scopeTemplates}>
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-8 xl:p-10 max-w-[1200px] mx-auto">
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          {scope.kind === 'client' && (
            <Link href={`/c/${scope.clientSlug}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" /> {scope.clientName}
            </Link>
          )}
          <h1 className="text-3xl font-display text-heading">{scope.kind === 'client' ? 'Guidelines' : 'Universal guidelines'}</h1>
          <p className="text-sm text-muted mt-1">
            {scope.kind === 'client'
              ? `The rules generation and optimization follow for ${scope.clientName}.`
              : 'The agency template. New clients start with a copy of these rules.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scopeTemplates.length > 0 && (
            <select
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value)}
              aria-label="Filter by what the rules apply to"
              className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All rules</option>
              <option value="client">Whole client</option>
              {scopeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} only
                </option>
              ))}
            </select>
          )}
          {scope.kind === 'client' && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 border border-border text-body hover:text-heading hover:bg-surface-hover transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import from document
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              closeForms()
              setAddingTop(true)
            }}
            className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all hover:shadow-glow-accent-strong"
          >
            <Plus className="w-4 h-4" />
            Add guideline
          </button>
        </div>
      </motion.div>

      {scope.kind === 'universal' && (
        <motion.div variants={itemVariants} className="glass-card p-4 mb-8 flex items-start gap-3">
          <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            New clients start with a copy of this template. Editing it does not change existing clients.
          </p>
        </motion.div>
      )}

      {addingTop && (
        <motion.div variants={itemVariants} className="glass-card mb-6 overflow-hidden">
          <GuidelineForm defaultCategory="seo" saving={saving} onSave={(values) => saveGuideline(values)} onCancel={closeForms} />
        </motion.div>
      )}

      <div className="space-y-6">
        {GUIDELINE_CATEGORIES.map((c) => (
          <motion.div key={c} variants={itemVariants}>
            <GuidelineSection
              category={c}
              items={groups.get(c) ?? []}
              collapsed={!!collapsed[c]}
              editingId={editingId}
              addingHere={addingInCategory === c}
              saving={saving}
              showSource={scope.kind === 'client'}
              onToggleCollapse={(cat) => setCollapsed((m) => ({ ...m, [cat]: !m[cat] }))}
              onStartAdd={(cat) => {
                closeForms()
                setAddingInCategory(cat)
              }}
              onToggleActive={toggleActive}
              onEdit={(g) => {
                closeForms()
                setEditingId(g.id)
              }}
              onDelete={setDeleting}
              onSaveForm={saveGuideline}
              onCancelForm={closeForms}
              onReorder={reorder}
            />
          </motion.div>
        ))}
      </div>

      {uncategorized.length > 0 && (
        <motion.section variants={itemVariants} className="glass-card overflow-hidden mt-6">
          <div className="px-5 py-4">
            <h2 className="text-sm font-medium text-heading">Needs a category</h2>
            <p className="text-xs text-muted mt-1">
              <span className="font-mono tabular-nums">{uncategorized.length}</span> rules use a category that isn’t one of the standard ones. They still apply when generating. Edit a rule to give it a category.
            </p>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {uncategorized.map((g) => (
              <GuidelineRow
                key={g.id}
                guideline={g}
                editing={editingId === g.id}
                saving={saving}
                showSource={scope.kind === 'client'}
                onToggleActive={toggleActive}
                onEdit={(x) => {
                  closeForms()
                  setEditingId(x.id)
                }}
                onDelete={setDeleting}
                onSaveForm={(values) => saveGuideline(values, g)}
                onCancelForm={closeForms}
              />
            ))}
          </ul>
        </motion.section>
      )}

      {scope.kind === 'client' && (
        <ImportFromDocumentModal
          isOpen={importOpen}
          clientId={scope.clientId}
          onClose={() => setImportOpen(false)}
          onImported={(created) => setGuidelines((list) => [...list, ...created])}
        />
      )}

      <ConfirmModal
        isOpen={!!deleting}
        title="Delete guideline"
        message={`“${deleting?.title ?? deleting?.rule.slice(0, 80) ?? ''}” will be permanently deleted. This can’t be undone.`}
        confirmLabel="Delete guideline"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </motion.div>
    </TemplateScopeContext.Provider>
  )
}
