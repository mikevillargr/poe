'use client'

import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { GuidelineDTO } from '@/lib/guidelines'
import { SourceTag } from './SourceTag'
import { GuidelineForm, type GuidelineFormValues } from './GuidelineForm'

// DR-006 option A row: drag handle, title + rule, source tag, instant toggle, edit/delete.
export function GuidelineRow({
  guideline,
  editing,
  saving,
  showSource,
  onToggleActive,
  onEdit,
  onDelete,
  onSaveForm,
  onCancelForm,
}: {
  guideline: GuidelineDTO
  editing: boolean
  saving: boolean
  showSource: boolean
  onToggleActive: (g: GuidelineDTO) => void
  onEdit: (g: GuidelineDTO) => void
  onDelete: (g: GuidelineDTO) => void
  onSaveForm: (values: GuidelineFormValues) => void
  onCancelForm: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: guideline.id,
  })

  if (editing) {
    return (
      <li ref={setNodeRef} className="bg-surface-hover/40">
        <GuidelineForm initial={guideline} defaultCategory="seo" saving={saving} onSave={onSaveForm} onCancel={onCancelForm} />
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group flex items-start gap-2 px-3 py-3 hover:bg-surface-hover transition-colors relative ${
        isDragging ? 'z-10 bg-surface shadow-xl opacity-90' : ''
      } ${guideline.active ? '' : 'opacity-50'}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${guideline.title ?? 'guideline'}`}
        title="Drag to reorder"
        className="p-1 mt-0.5 rounded text-muted cursor-grab hover:text-heading active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="min-w-0 flex-1">
        {guideline.title && <div className="text-sm font-semibold text-heading">{guideline.title}</div>}
        <div className="text-sm text-body whitespace-pre-wrap break-words">{guideline.rule}</div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {showSource && <SourceTag source={guideline.source} />}
        <button
          type="button"
          role="switch"
          aria-checked={guideline.active}
          onClick={() => onToggleActive(guideline)}
          title={guideline.active ? 'Disable rule' : 'Enable rule'}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            guideline.active ? 'bg-accent' : 'bg-surface-hover border border-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              guideline.active ? 'translate-x-4' : ''
            }`}
          />
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onEdit(guideline)}
            title="Edit guideline"
            className="text-muted hover:text-accent transition-colors p-1.5 rounded hover:bg-surface"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(guideline)}
            title="Delete guideline"
            className="text-muted hover:text-danger transition-colors p-1.5 rounded hover:bg-surface"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  )
}
