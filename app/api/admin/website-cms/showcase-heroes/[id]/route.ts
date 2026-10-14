import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { HeroConflictError } from '@/lib/server/website-heroes'
import { readShowcaseState, changeShowcaseHero } from '@/lib/server/showcase-heroes'
import { isShowcaseHeroId } from '@/lib/showcase-heroes'
import { HeroValidationError, type HeroAction } from '@/lib/website-heroes'
type Context = { params: Promise<{ id: string }> }
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(_request: Request, { params }: Context) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const { id } = await params
  if (!isShowcaseHeroId(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers })
  try { return NextResponse.json({ state: await readShowcaseState(id), canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load hero.' }, { status: 503, headers }) }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const { id } = await params
  if (!isShowcaseHeroId(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers })
  let body: { action: HeroAction; revision: number; content?: unknown }
  try {
    const raw = await request.text()
    if (raw.length > 24000) throw new Error()
    body = JSON.parse(raw)
    if (!body || !['save-draft', 'publish', 'unpublish', 'restore'].includes(body.action) || !Number.isSafeInteger(body.revision) || body.revision < 0) throw new Error()
  } catch { return NextResponse.json({ error: 'Invalid hero request.' }, { status: 400, headers }) }
  try { return NextResponse.json({ state: await changeShowcaseHero(id, body.action, body.revision, body.content) }, { headers }) }
  catch (error) {
    if (error instanceof HeroConflictError) return NextResponse.json({ error: error.message }, { status: 409, headers })
    if (error instanceof HeroValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers })
    return NextResponse.json({ error: 'Could not save hero.' }, { status: 503, headers })
  }
}
