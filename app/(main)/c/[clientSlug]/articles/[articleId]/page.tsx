import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requirePageUser } from '@/lib/auth/guards'
import { getClientBySlug } from '@/lib/tenancy'
import { getArticleReconciled } from '@/lib/pipeline/runs'
import { ApiError } from '@/lib/api/errors'
import { modelRef, resolveRole } from '@/lib/ai/roles'
import { WorkspaceView } from '@/components/workspace/WorkspaceView'
import { toWorkspaceArticle, type ModelsInUse } from '@/components/workspace/types'

export const dynamic = 'force-dynamic'

async function configuredModel(role: 'research' | 'generation'): Promise<string | null> {
  try {
    return modelRef(await resolveRole(role))
  } catch {
    return null
  }
}

// Article Workspace (WS workspace, DR-005 option A).
export default async function ArticleWorkspacePage({
  params,
}: {
  params: Promise<{ clientSlug: string; articleId: string }>
}) {
  const { clientSlug, articleId } = await params
  const user = await requirePageUser()
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()

  let row
  try {
    row = await getArticleReconciled(client.id, articleId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }

  const [people, research, generation] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image })
      .from(users)
      .where(eq(users.status, 'active'))
      .orderBy(asc(users.name)),
    configuredModel('research'),
    configuredModel('generation'),
  ])
  const models: ModelsInUse = { research, generation }

  return (
    <WorkspaceView
      key={row.id}
      client={{ id: client.id, slug: client.slug, name: client.name }}
      initialArticle={toWorkspaceArticle(JSON.parse(JSON.stringify(row)))}
      people={people}
      models={models}
      isSuperAdmin={user.role === 'super_admin'}
      googleClientId={process.env.AUTH_GOOGLE_ID ?? ''}
    />
  )
}
