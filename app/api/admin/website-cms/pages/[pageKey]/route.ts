import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { changePageContent, readPageState } from '@/lib/server/page-sections'
import { HeroConflictError } from '@/lib/server/website-heroes'
import { HeroValidationError, type HeroAction } from '@/lib/website-heroes'
import { isPageDocumentId, PAGE_DOCUMENTS } from '@/lib/additional-page-content'
const headers = { 'Cache-Control': 'private, no-store' }
type Context = { params: Promise<{ pageKey: string }> }
class PageBodyTooLarge extends Error {}
async function readPageBody(request: Request): Promise<string> {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing request body.')
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 512000) { await reader.cancel(); throw new PageBodyTooLarge() }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally { reader.releaseLock() }
}
export async function GET(_request: Request, { params }: Context) {
  const { pageKey } = await params
  if (!isPageDocumentId(pageKey)) return NextResponse.json({ error: 'No page document editor is registered for this page.' }, { status: 404, headers })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try { return NextResponse.json({ state: await readPageState(pageKey), canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load page content.' }, { status: 503, headers }) }
}
export async function PATCH(request: Request, { params }: Context) {
  const { pageKey } = await params
  if (!isPageDocumentId(pageKey)) return NextResponse.json({ error: 'Unknown page editor.' }, { status: 404, headers })
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  let body: { action: HeroAction; revision: number; content?: unknown }
  try {
    const raw = await readPageBody(request)
    body = JSON.parse(raw)
    if (!body || !['save-draft', 'publish', 'unpublish', 'restore'].includes(body.action) || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error()
  } catch (error) { return NextResponse.json({ error: error instanceof PageBodyTooLarge ? 'Page request is too large.' : 'Invalid page request.' }, { status: error instanceof PageBodyTooLarge ? 413 : 400, headers }) }
  try {
    const state = await changePageContent(body.action, body.revision, body.content, pageKey)
    if (body.action !== 'save-draft') {
      const route = PAGE_DOCUMENTS[pageKey].route
      if (route.includes('[')) revalidatePath(route, 'page')
      else revalidatePath(route)
      revalidatePath('/', 'layout')
    }
    return NextResponse.json({ state }, { headers })
  } catch (error) {
    const status = error instanceof HeroConflictError ? 409 : error instanceof HeroValidationError ? 400 : 503
    return NextResponse.json({ error: status === 503 ? 'Could not save page content.' : (error as Error).message }, { status, headers })
  }
}
