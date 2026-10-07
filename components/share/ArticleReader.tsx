'use client'

import { forwardRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { tableExtensions } from '@/lib/tiptap/table'

// DR-021: the article on a shared page, rendered read-only through the editor's schema, so only known
// nodes and marks reach the page (no raw HTML).
export const ArticleReader = forwardRef<HTMLDivElement, { html: string }>(function ArticleReader({ html }, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      ...tableExtensions,
    ],
    content: html,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose prose-lg max-w-none focus:outline-none' } },
  })
  return (
    <div ref={ref} className="min-h-[200px]">
      {editor ? <EditorContent editor={editor} /> : <div className="space-y-3 animate-pulse">{[90, 100, 95, 70].map((w, i) => <div key={i} className="h-4 rounded bg-[var(--color-gauge-bg)]" style={{ width: `${w}%` }} />)}</div>}
    </div>
  )
})
