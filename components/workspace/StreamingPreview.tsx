'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { cleanGeneratedHtml } from '@/lib/pipeline/html'
import { tableExtensions } from '@/lib/tiptap/table'

// Read-only TipTap view of a draft while it streams in. TipTap's schema renders only known nodes,
// so partial or unexpected HTML from the model can't execute.
export function StreamingPreview({ html }: { html: string }) {
  const lastApplied = useRef(0)
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Link.configure({ openOnClick: false }), ...tableExtensions],
    content: '',
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose prose-lg max-w-none px-6 py-4', 'aria-live': 'polite', 'aria-busy': 'true' } },
  })

  // Throttle re-parsing: at most every 120 ms.
  useEffect(() => {
    if (!editor) return
    const apply = () => {
      lastApplied.current = Date.now()
      editor.commands.setContent(cleanGeneratedHtml(html), false)
    }
    const wait = 120 - (Date.now() - lastApplied.current)
    if (wait <= 0) {
      apply()
      return
    }
    const t = setTimeout(apply, wait)
    return () => clearTimeout(t)
  }, [editor, html])

  return <EditorContent editor={editor} />
}
