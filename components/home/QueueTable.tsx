'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import { GripVertical, Eye, Trash2 } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ArticleSummary } from '@/lib/articles/schemas'
import { StatusPill } from './StatusPill'

export interface Person {
  id: string
  name: string
  image: string | null
}

const nf = new Intl.NumberFormat('en-US')

function WordsCell({ actual, target }: { actual: number | null; target: number | null }) {
  const ratio = actual && target ? actual / target : 0
  const onTarget = ratio >= 0.9 && ratio <= 1.1
  return (
    <div className="min-w-[96px]">
      <div className="text-sm font-mono tabular-nums text-body">
        <span className={actual ? 'text-heading' : 'text-muted'}>{actual ? nf.format(actual) : '—'}</span>
        <span className="text-muted"> / {target ? nf.format(target) : '—'}</span>
      </div>
      {target ? (
        <div className="mt-1.5 h-1 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden">
          <div
            className={`h-full rounded-full ${onTarget ? 'bg-green-500' : 'bg-accent'}`}
            style={{ width: `${Math.min(ratio, 1) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

function Avatar({ person }: { person?: Person }) {
  if (!person) return <span className="text-xs text-muted">—</span>
  return person.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.image} alt={person.name} title={person.name} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full border border-border" />
  ) : (
    <div
      title={person.name}
      className="w-6 h-6 rounded-full bg-surface-hover border border-border flex items-center justify-center text-[10px] font-bold text-heading"
    >
      {person.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')}
    </div>
  )
}

function Row({
  article,
  index,
  people,
  draggable,
  onOpen,
  onDelete,
}: {
  article: ArticleSummary
  index: number
  people: Map<string, Person>
  draggable: boolean
  onOpen: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: article.id,
    disabled: !draggable,
  })
  const extra = article.keywords.length - 2
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onOpen}
      className={`group hover:bg-surface-hover transition-colors relative cursor-pointer ${
        isDragging ? 'z-10 bg-surface shadow-xl opacity-90' : ''
      }`}
    >
      <td className="pl-3 pr-1 py-4 w-8 relative">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent opacity-0 group-hover:opacity-100 transition-opacity shadow-glow-accent" />
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          disabled={!draggable}
          aria-label={`Reorder ${article.title}`}
          title={draggable ? 'Drag to reorder' : 'Clear filters to reorder'}
          className={`p-1 rounded text-muted ${draggable ? 'cursor-grab hover:text-heading active:cursor-grabbing' : 'opacity-30 cursor-not-allowed'}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>
      <td className="px-2 py-4 text-sm text-muted font-mono tabular-nums w-10">{index + 1}</td>
      <td className="px-4 py-4 min-w-0">
        <div className="text-sm font-medium text-heading truncate group-hover:text-accent transition-colors">{article.title}</div>
        {article.primaryKeyword && <div className="text-xs text-muted truncate mt-0.5">{article.primaryKeyword}</div>}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
          {article.keywords.slice(0, 2).map((k) => (
            <span key={k} className="px-2 py-0.5 rounded-full text-xs border border-border text-body bg-surface truncate max-w-[180px]">
              {k}
            </span>
          ))}
          {extra > 0 && <span className="text-xs text-muted self-center">+{extra}</span>}
          {article.keywords.length === 0 && <span className="text-xs text-muted">—</span>}
        </div>
      </td>
      <td className="px-4 py-4">
        <WordsCell actual={article.wordCount} target={article.targetWordCount} />
      </td>
      <td className="px-4 py-4">
        <StatusPill status={article.status} />
      </td>
      <td className="px-4 py-4">
        <Avatar person={article.assigneeId ? people.get(article.assigneeId) : undefined} />
      </td>
      <td
        className="px-4 py-4 text-sm text-muted font-mono truncate"
        title={formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true })}
      >
        {formatDistanceToNowStrict(new Date(article.updatedAt), { addSuffix: true })}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="text-muted hover:text-accent transition-colors p-1.5 rounded hover:bg-surface"
            title="Open article"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-muted hover:text-danger transition-colors p-1.5 rounded hover:bg-surface"
            title="Delete article"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export function QueueTable({
  articles,
  people,
  draggable,
  onOpen,
  onDelete,
  onReorder,
}: {
  articles: ArticleSummary[]
  people: Map<string, Person>
  draggable: boolean
  onOpen: (a: ArticleSummary) => void
  onDelete: (a: ArticleSummary) => void
  onReorder: (activeId: string, overId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onReorder(String(e.active.id), String(e.over.id))
  }

  const th = 'px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border'
  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <table className="w-full table-fixed text-left border-collapse">
          <colgroup>
            <col className="w-10" />
            <col className="w-10" />
            <col />
            <col className="w-[240px]" />
            <col className="w-[140px]" />
            <col className="w-[112px]" />
            <col className="w-14" />
            <col className="w-[152px]" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} pl-3 w-8`} />
              <th className={`${th} px-2 w-10`}>#</th>
              <th className={th}>Article</th>
              <th className={th}>Keywords</th>
              <th className={th}>Words</th>
              <th className={th}>Status</th>
              <th className={th}>Owner</th>
              <th className={th}>Updated</th>
              <th className={`${th} text-right`} />
            </tr>
          </thead>
          <SortableContext items={articles.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <tbody className="divide-y divide-border">
              {articles.map((a, i) => (
                <Row
                  key={a.id}
                  article={a}
                  index={i}
                  people={people}
                  draggable={draggable}
                  onOpen={() => onOpen(a)}
                  onDelete={() => onDelete(a)}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  )
}
