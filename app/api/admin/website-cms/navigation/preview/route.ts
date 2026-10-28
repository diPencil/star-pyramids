import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { resolveNavigation } from '@/lib/server/navigation'
import { NavigationValidationError } from '@/lib/navigation'
import { readNavigationBody } from '@/lib/server/navigation-request'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  try { const body = await readNavigationBody(request); return NextResponse.json({ navigation: await resolveNavigation(body.content as Parameters<typeof resolveNavigation>[0]) }, { headers }) }
  catch (error) { return NextResponse.json({ error: error instanceof NavigationValidationError ? error.message : 'Preview unavailable.' }, { status: error instanceof NavigationValidationError ? 400 : 503, headers }) }
}
