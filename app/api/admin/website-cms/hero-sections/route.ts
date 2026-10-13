import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { changeHero, HeroConflictError, readHeroState } from '@/lib/server/website-heroes'
import { HeroValidationError, type HeroAction } from '@/lib/website-heroes'

const headers = { 'Cache-Control': 'private, no-store' }
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try { return NextResponse.json({ state: await readHeroState(), canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load hero content.' }, { status: 503, headers }) }
}
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  let body: { action?: unknown; revision?: unknown; content?: unknown }
  try {
    const raw = await request.text()
    if (raw.length > 24000) throw new Error()
    body = JSON.parse(raw)
    if (!body || typeof body !== 'object' || !['save-draft', 'publish', 'unpublish', 'restore'].includes(String(body.action)) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw new Error()
  } catch { return NextResponse.json({ error: 'Invalid hero request.' }, { status: 400, headers }) }
  try { return NextResponse.json({ state: await changeHero(body.action as HeroAction, body.revision as number, body.content) }, { headers }) }
  catch (error) {
    if (error instanceof HeroConflictError) return NextResponse.json({ error: error.message }, { status: 409, headers })
    if (error instanceof HeroValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers })
    return NextResponse.json({ error: 'Could not save hero content.' }, { status: 503, headers })
  }
}
