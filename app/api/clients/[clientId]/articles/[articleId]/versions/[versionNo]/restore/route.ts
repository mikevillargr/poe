import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { restoreVersion } from '@/lib/pipeline/versions'

export const dynamic = 'force-dynamic'

type P = { clientId: string; articleId: string; versionNo: string }

// POST → { article, version, snapshot }. Saves the current draft as a version first, then makes
// version N the draft again (recorded as a `restore` version).
export const POST = withRoute<P>(async ({ params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const versionNo = Number(params.versionNo)
  if (!Number.isInteger(versionNo) || versionNo < 1) throw Errors.notFound('Version')
  return json(await restoreVersion(client.id, params.articleId, versionNo, user))
})
