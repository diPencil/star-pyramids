import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { navigationKinds, type NavigationKind } from '@/lib/navigation'
import { recordNavigationOptions, staticNavigationOptions } from '@/lib/server/navigation'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  const params = new URL(request.url).searchParams; const kind = params.get('kind') ?? 'page'; const query = (params.get('q') ?? '').trim().slice(0,100)
  if (kind !== 'page' && !navigationKinds.includes(kind as NavigationKind)) return NextResponse.json({ error: 'Invalid content source.' }, { status: 400, headers })
  try {
    const options = kind === 'page' ? staticNavigationOptions().filter(row => `${row.label} ${row.href}`.toLowerCase().includes(query.toLowerCase())) : await recordNavigationOptions(kind as NavigationKind, undefined, query)
    return NextResponse.json({ options, truncated: options.length === 120 }, { headers })
  } catch { return NextResponse.json({ error: 'Published links could not be loaded.' }, { status: 503, headers }) }
}
