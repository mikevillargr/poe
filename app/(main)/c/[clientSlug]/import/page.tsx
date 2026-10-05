import { Placeholder } from '@/components/shell/Placeholder'

// OWNED BY WS import (DR-004): upload CSV/XLSX/XLS (title, brief, keywords, wordcount) → preview → queue.
export default function ImportPage() {
  return (
    <Placeholder
      title="Import"
      workstream="import"
      description="Upload a content calendar sheet (title, brief, keywords, wordcount) and add its rows to the queue."
    />
  )
}
