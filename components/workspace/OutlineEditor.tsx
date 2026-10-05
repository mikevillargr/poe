'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Heading2, Heading3, List, Pilcrow } from 'lucide-react'

// Small TipTap instance for the research outline (H2/H3 items). Same editor stack as the draft.
export function OutlineEditor({
  html,
  onChange,
  disabled,
}: {
  html: string
  onChange: (html: string) => void
  disabled?: boolean
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, blockquote: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: 'Outline headings, one per line (H2 for sections, H3 for sub-points)…' }),
    ],
    content: html,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'focus:outline-none px-4 py-3', 'aria-label': 'Outline' } },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  const btn = (active: boolean) =>
    `p-1.5 rounded transition-colors ${active ? 'bg-accent text-white' : 'text-muted hover:text-heading hover:bg-surface-hover'}`

  return (
    <div
      className={`rounded-card border border-border bg-[var(--color-editor-bg)] overflow-hidden
        [&_.ProseMirror]:min-h-[160px] [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:leading-7 [&_.ProseMirror_h2]:mt-2 [&_.ProseMirror_h2]:mb-1
        [&_.ProseMirror_h3]:font-sans [&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-body [&_.ProseMirror_h3]:pl-4 [&_.ProseMirror_h3]:my-1
        [&_.ProseMirror_p]:text-sm [&_.ProseMirror_p]:mb-1 [&_.ProseMirror_li]:text-sm [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:list-decimal`}
    >
      {editor && !disabled && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-surface/60">
          <button type="button" title="Section (H2)" aria-label="Section heading" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Sub-point (H3)" aria-label="Sub-point heading" className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Note" aria-label="Paragraph" className={btn(editor.isActive('paragraph'))} onClick={() => editor.chain().focus().setParagraph().run()}>
            <Pilcrow className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Bullet list" aria-label="Bullet list" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
