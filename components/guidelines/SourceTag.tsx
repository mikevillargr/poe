'use client'

import type { GuidelineDTO } from '@/lib/guidelines'

// DR-006 sub-decision 6: rows that came from the Universal template or an import show a small
// muted tag so a client can see what they customized vs. what shipped.
export function SourceTag({ source }: { source: GuidelineDTO['source'] }) {
  if (source !== 'template_copy' && source !== 'ingested') return null
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] border border-border text-muted bg-surface whitespace-nowrap shrink-0">
      {source === 'template_copy' ? 'Template' : 'Imported'}
    </span>
  )
}
