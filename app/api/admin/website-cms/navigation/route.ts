import { readNavigationBody } from '@/lib/server/navigation-request'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { readNavigation, changeNavigation, navigationDefaults } from '@/lib/server/navigation'
import { NavigationValidationError } from '@/lib/navigation'
import { HeroConflictError } from '@/lib/server/website-heroes'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
export async function GET() {
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  try { return NextResponse.json({ state: await readNavigation(), defaults: await navigationDefaults(), canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Navigation could not be loaded. No settings were changed.' }, { status: 503, headers }) }
}
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view') || !hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  try {
    const body = await readNavigationBody(request)
    const state = await changeNavigation(body.revision, body.action, body.content)
    if (body.action === 'publish' || body.action === 'restore') revalidatePath('/', 'layout')
    return NextResponse.json({ state, ...(state.published === null && state.draft === null ? { defaults: await navigationDefaults() } : {}) }, { headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof NavigationValidationError || error instanceof HeroConflictError ? error.message : 'Navigation could not be saved. Reload and retry.' }, { status: error instanceof HeroConflictError ? 409 : error instanceof NavigationValidationError ? 400 : 503, headers })
  }
}
