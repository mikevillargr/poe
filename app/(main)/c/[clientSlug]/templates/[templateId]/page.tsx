import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { TemplateEditor } from '@/components/templates/TemplateEditor'

export const dynamic = 'force-dynamic'

// Template editor: prompt, link steps, checks, hooks, sources, history, dry runs (D-002, DR-010).
export default async function TemplateEditorPage({ params }: { params: Promise<{ clientSlug: string; templateId: string }> }) {
  const { clientSlug, templateId } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()
  return <TemplateEditor client={{ id: client.id, name: client.name, slug: client.slug }} templateId={templateId} />
}
