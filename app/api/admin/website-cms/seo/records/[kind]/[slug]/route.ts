import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isRecordSeoKind, validateRecordSeoContent } from '@/lib/record-seo'
import { changeRecordSeo, readRecordSeo, listRecordSeo } from '@/lib/server/record-seo'
import { recordSeoAccess, canEditRecordSeo, SEO_PRIVATE_HEADERS, readRecordSeoBody } from '@/lib/server/record-seo-api'
import { HeroConflictError } from '@/lib/server/website-heroes'
import { SEO_PAGES } from '@/lib/seo-manager'
type Context = { params: Promise<{ kind: string; slug: string }> }
const invalidIdentity = (kind: string, slug: string) => !isRecordSeoKind(kind) || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)
export async function GET(_request: Request, { params }: Context) {
  const { kind, slug } = await params
  if (invalidIdentity(kind, slug) || !isRecordSeoKind(kind)) return NextResponse.json({ error: 'Unknown SEO record.' }, { status: 404, headers: SEO_PRIVATE_HEADERS })
  const access = await recordSeoAccess(kind)
  if (access.response) return access.response
  try { return NextResponse.json({ ...await readRecordSeo(kind, slug), canEdit: canEditRecordSeo(access.user!, kind) }, { headers: SEO_PRIVATE_HEADERS }) }
  catch (error) { return NextResponse.json({ error: 'Record SEO is unavailable.' }, { status: (error as { status?: number }).status === 404 ? 404 : 503, headers: SEO_PRIVATE_HEADERS }) }
}
export async function PATCH(request: Request, { params }: Context) {
  const { kind, slug } = await params
  if (invalidIdentity(kind, slug) || !isRecordSeoKind(kind)) return NextResponse.json({ error: 'Unknown SEO record.' }, { status: 404, headers: SEO_PRIVATE_HEADERS })
  const access = await recordSeoAccess(kind, request)
  if (access.response) return access.response
  let body: Awaited<ReturnType<typeof readRecordSeoBody>>
  try {
    body = await readRecordSeoBody(request)
    if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['save-draft', 'publish', 'restore'].includes(body.action)) throw new Error('Invalid SEO request.')
    if (body.action === 'save-draft') body.content = validateRecordSeoContent(body.content)
  } catch (error) { return NextResponse.json({ error: (error as Error).message || 'Invalid SEO request.' }, { status: 400, headers: SEO_PRIVATE_HEADERS }) }
  try {
    const before = await readRecordSeo(kind, slug)
    const content = body.action === 'publish' ? before.state.draft : body.content as ReturnType<typeof validateRecordSeoContent> | undefined
    if (body.action === 'publish' && !content) return NextResponse.json({ error: 'Save an SEO draft before publishing.' }, { status: 400, headers: SEO_PRIVATE_HEADERS })
    if (content?.canonical) {
      const target = content.canonical
      const staticTarget = Object.values(SEO_PAGES).some(page => page?.route === target)
      const ownTarget = before.record.canonicalPaths.includes(target)
      const dynamicTarget = !staticTarget && !ownTarget && (await listRecordSeo()).some(entry => entry.record.published && entry.record.canonicalPaths.includes(target))
      if (!staticTarget && !ownTarget && !dynamicTarget) return NextResponse.json({ error: 'Canonical target must identify an existing public page.' }, { status: 400, headers: SEO_PRIVATE_HEADERS })
    }
    const result = await changeRecordSeo(kind, slug, body.action, body.revision, body.content)
    if (body.action !== 'save-draft') {
      for (const path of result.record.canonicalPaths) revalidatePath(path)
      revalidatePath('/sitemap.xml'); revalidatePath('/', 'layout')
    }
    return NextResponse.json({ ...result, canEdit: true }, { headers: SEO_PRIVATE_HEADERS })
  } catch (error) { return NextResponse.json({ error: error instanceof HeroConflictError ? error.message : 'Could not save record SEO. Reload and retry.' }, { status: error instanceof HeroConflictError ? 409 : (error as { status?: number }).status === 404 ? 404 : 503, headers: SEO_PRIVATE_HEADERS }) }
}
