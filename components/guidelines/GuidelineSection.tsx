'use client'

import { useId } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CATEGORY_SHORT_LABELS, type GuidelineCategory, type GuidelineDTO } from '@/lib/guidelines'
import { CategoryBadge } from '@/components/CategoryBadge'
import { GuidelineRow } from './GuidelineRow'
import { GuidelineForm, type GuidelineFormValues } from './GuidelineForm'

// DR-006 option A: one collapsible glass-card section per category. Reorder is within the
// section only; "+ Add a rule" opens the inline form with the category preselected.
export function GuidelineSection({
  category,
  items,
  collapsed,
  editingId,
  addingHere,
  saving,
  showSource,
  onToggleCollapse,
  onStartAdd,
  onToggleActive,
  onEdit,
  onDelete,
  onSaveForm,
  onCancelForm,
  onReorder,
}: {
  category: GuidelineCategory
  items: GuidelineDTO[]
  collapsed: boolean
  editingId: string | null
  addingHere: boolean
  saving: boolean
  showSource: boolean
  onToggleCollapse: (c: GuidelineCategory) => void
  onStartAdd: (c: GuidelineCategory) => void
  onToggleActive: (g: GuidelineDTO) => void
  onEdit: (g: GuidelineDTO) => void
  onDelete: (g: GuidelineDTO) => void
  onSaveForm: (values: GuidelineFormValues, existing?: GuidelineDTO) => void
  onCancelForm: () => void
  onReorder: (category: GuidelineCategory, activeId: string, overId: string) => void
}) {
  // A stable id keeps dnd-kit's aria-describedby the same on server and client (hydration).
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onReorder(category, String(e.active.id), String(e.over.id))
  }

  const enabled = items.filter((g) => g.active).length
  const label = CATEGORY_SHORT_LABELS[category]

  return (
    <section className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => onToggleCollapse(category)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-hover transition-colors text-left"
      >
        <CategoryBadge category={label} />
        <span className="text-xs text-muted font-mono tabular-nums">
          {items.length} {items.length === 1 ? 'rule' : 'rules'} · {enabled} enabled
        </span>
        <ChevronDown className={`w-4 h-4 text-muted ml-auto transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      </button>

      {!collapsed && (
        <div className="border-t border-border">
          {category === 'blacklist' && (
            <p className="px-5 pt-3 text-xs text-muted">Words, phrases and patterns that make text sound AI-written.</p>
          )}
          {items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No {label} rules yet.</p>
          ) : (
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border">
                  {items.map((g) => (
                    <GuidelineRow
                      key={g.id}
                      guideline={g}
                      editing={editingId === g.id}
                      saving={saving}
                      showSource={showSource}
                      onToggleActive={onToggleActive}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onSaveForm={(values) => onSaveForm(values, g)}
                      onCancelForm={onCancelForm}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          {addingHere ? (
            <div className="border-t border-border bg-surface-hover/40">
              <GuidelineForm defaultCategory={category} saving={saving} onSave={(values) => onSaveForm(values)} onCancel={onCancelForm} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onStartAdd(category)}
              className="w-full flex items-center gap-2 px-5 py-3 text-sm text-muted hover:text-accent hover:bg-surface-hover transition-colors border-t border-border"
            >
              <Plus className="w-4 h-4" /> Add a rule
            </button>
          )}
        </div>
      )}
    </section>
  )
}
