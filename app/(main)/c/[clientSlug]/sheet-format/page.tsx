import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { listTemplates } from '@/lib/templates/repo'
import { calendarFormat, linkListFormat, templateFormat } from '@/lib/import/sheet-format'
import { SheetFormatCard } from '@/components/import/SheetFormatCard'

export const dynamic = 'force-dynamic'

// DR-015: every sheet shape this client's imports accept, on one page to share with whoever fills the sheet.
// The import screens link here with #<format id>.
export default async function SheetFormatPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()

  const templates = (await listTemplates(client.id)).filter((t) => t.enabled)
  const formats = [
    calendarFormat(),
    ...templates.map((t) => templateFormat({ id: t.id, name: t.name, kind: t.kind, inputs: t.config.inputs })),
    linkListFormat(),
  ]

  return (
    <div className="p-8 xl:p-10 max-w-[960px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display text-heading">Sheet formats</h1>
        <p className="text-sm text-muted mt-1">
          How to lay out a sheet for {client.name}. Use the template’s format when the rows are for that template; the content calendar for standard
          articles; the link list for internal-link lists.
        </p>
      </div>
      {formats.map((f) => (
        <SheetFormatCard key={f.id} format={f} clientId={client.id} clientSlug={client.slug} standalone />
      ))}
    </div>
  )
}
