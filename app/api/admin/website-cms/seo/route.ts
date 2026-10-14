import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { seoInventory } from '@/lib/server/seo-inventory'
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await getCurrentUser()
  if (!user || !hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: user ? 403 : 401, headers })
  try { return NextResponse.json({ pages: await seoInventory(), languageUrls: 'cookie-only', googleConnected: false, canEdit: hasPermission(user, 'settings.edit') }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load the complete SEO inventory. No totals have been estimated.' }, { status: 503, headers }) }
}
