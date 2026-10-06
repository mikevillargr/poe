import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getTemplate } from '@/lib/templates/repo'
import { validateConfig } from '@/lib/templates/manage'
import { dryRunTemplate } from '@/lib/templates/dry-run'
import { TemplateRunError } from '@/lib/templates/execute'
import { ApiError } from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const body = z.object({
  mode: z.enum(['prompt', 'links', 'draft']),
  /** The editor's unsaved config (validated); omitted = the saved one. */
  config: z.unknown().optional(),
  sample: z
    .object({
      articleId: z.string().uuid().optional(),
      title: z.string().max(300).optional(),
      brief: z.string().max(10000).optional(),
      keywords: z.array(z.string().max(120)).max(50).optional(),
      wordCount: z.number().int().min(50).max(20000).nullable().optional(),
      inputs: z.record(z.string().max(60), z.string().max(5000)).optional(),
    })
    .default({}),
})

// POST { mode: prompt | links | draft, config?, sample } → preview (nothing is saved) (DR-010 dry run)
export const POST = withRoute<{ clientId: string; templateId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const b = body.parse(await req.json())
  const saved = await getTemplate(client.id, params.templateId)
  const config = b.config === undefined ? saved.config : validateConfig(b.config)
  try {
    return json(await dryRunTemplate(client, saved.id, config, b.sample, b.mode, user))
  } catch (err) {
    if (err instanceof TemplateRunError) throw new ApiError(400, err.code, err.message)
    throw err
  }
})
