import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { changeSeo, readSeoState } from '@/lib/server/seo-manager'
import { HeroConflictError } from '@/lib/server/website-heroes'
import { isSeoPage, SEO_PAGES, type SeoAction } from '@/lib/seo-manager'
import { validateSeoContent } from '@/lib/seo-content'
import { cmsPageRegistry } from '@/lib/cms-coverage'
import { HeroValidationError } from '@/lib/website-heroes'
const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ pageKey: string }> }
export async function GET(_request: Request, { params }: Context) {
  const { pageKey } = await params
  if (!isSeoPage(pageKey)) return NextResponse.json({ error: 'Unknown SEO page.' }, { status: 404, headers })
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  try { return NextResponse.json({ state: await readSeoState(pageKey), canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load SEO.' }, { status: 503, headers }) }
}
export async function PATCH(request: Request, { params }: Context) {
  const { pageKey } = await params
  if (!isSeoPage(pageKey)) return NextResponse.json({ error: 'Unknown SEO page.' }, { status: 404, headers })
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  let body: { revision: number; action: SeoAction; content?: unknown }
  try {
    const reader = request.body?.getReader()
    if (!reader) throw new Error()
    let size = 0; const chunks: Uint8Array[] = []
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); throw new Error() } chunks.push(value) } }
    finally { reader.releaseLock() }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['save-draft', 'publish', 'restore'].includes(body.action)) throw new Error()
    if (body.action === 'save-draft') body.content = validateSeoContent(body.content)
    const canonical = (body.content as { canonical?: string } | undefined)?.canonical
    if (canonical && !cmsPageRegistry.some(page => page.route === canonical && !page.route.includes('['))) throw new Error('Choose a registered public canonical path.')
  } catch { return NextResponse.json({ error: 'Invalid SEO request (maximum 16 KB).' }, { status: 400, headers }) }
  try {
    const state = await changeSeo(pageKey, body.revision, body.action, body.content)
    if (body.action !== 'save-draft') { revalidatePath(SEO_PAGES[pageKey]!.route); revalidatePath('/sitemap.xml'); revalidatePath('/', 'layout') }
    return NextResponse.json({ state }, { headers })
  } catch (error) { return NextResponse.json({ error: error instanceof HeroConflictError || error instanceof HeroValidationError ? error.message : 'SEO could not be saved. Reload and retry.' }, { status: error instanceof HeroConflictError ? 409 : error instanceof HeroValidationError ? 400 : 503, headers }) }
}
