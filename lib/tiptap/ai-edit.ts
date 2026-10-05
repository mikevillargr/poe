// TipTap glue for inline AI edits (DR-009): a tracked range that follows document changes, the
// decorations that mark it, and the ⌘J / "/" triggers. Decorations only: nothing ends up in the HTML.
import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export type AiRangeKind = 'rewrite' | 'insert' | 'flash'
export interface AiRange {
  from: number
  to: number
  kind: AiRangeKind
}

export const aiEditKey = new PluginKey<AiRange | null>('aiEditRange')

type Meta = { type: 'set'; range: AiRange } | { type: 'clear' }

export function getAiRange(editor: Editor): AiRange | null {
  return editor.isDestroyed ? null : (aiEditKey.getState(editor.state) ?? null)
}

/** Sets the tracked range in `tr` (use inside a command or via setAiRange). */
export function setAiRange(editor: Editor, range: AiRange | null) {
  if (editor.isDestroyed) return
  const meta: Meta = range ? { type: 'set', range } : { type: 'clear' }
  editor.view.dispatch(editor.state.tr.setMeta(aiEditKey, meta).setMeta('addToHistory', false))
}

export interface AiEditTriggers {
  /** ⌘J / Ctrl+J. Return true when handled. */
  onShortcut: () => boolean
  /** "/" typed on an empty paragraph. Return true to swallow the keystroke. */
  onSlash: () => boolean
}

export function isEmptyParagraphSelection(editor: Editor): boolean {
  const { selection } = editor.state
  const { $from } = selection
  return selection.empty && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
}

export const AiEditExtension = Extension.create<{ triggers: () => AiEditTriggers | null }>({
  name: 'aiEdit',
  addOptions: () => ({ triggers: () => null }),
  addKeyboardShortcuts() {
    return { 'Mod-j': () => this.options.triggers()?.onShortcut() ?? false }
  },
  addProseMirrorPlugins() {
    const triggers = this.options.triggers
    return [
      new Plugin<AiRange | null>({
        key: aiEditKey,
        state: {
          init: () => null,
          apply(tr, old) {
            const meta = tr.getMeta(aiEditKey) as Meta | undefined
            if (meta) return meta.type === 'set' ? meta.range : null
            if (!old || !tr.docChanged) return old
            // Text typed at either edge stays outside the range; deleting it all collapses it.
            const from = tr.mapping.map(old.from, 1)
            const to = tr.mapping.map(old.to, -1)
            return { ...old, from, to: Math.max(from, to) }
          },
        },
        props: {
          decorations(state) {
            const r = aiEditKey.getState(state)
            if (!r) return null
            const max = state.doc.content.size
            if (r.from < 0 || r.to > max) return null
            if (r.kind === 'insert') {
              const node = state.doc.nodeAt(r.from)
              return node ? DecorationSet.create(state.doc, [Decoration.node(r.from, r.from + node.nodeSize, { class: 'ai-edit-insert-anchor' })]) : null
            }
            if (r.to <= r.from) return null
            return DecorationSet.create(state.doc, [Decoration.inline(r.from, r.to, { class: r.kind === 'flash' ? 'ai-edit-flash' : 'ai-edit-range' })])
          },
          handleKeyDown(view, event) {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return false
            const { selection } = view.state
            const { $from } = selection
            // Only on an empty paragraph, so "/" in prose and URLs is never hijacked.
            if (!selection.empty || $from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) return false
            if (!triggers()?.onSlash()) return false
            event.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})
