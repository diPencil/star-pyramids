import { NextResponse } from 'next/server'
import { publishedNavigation } from '@/lib/server/navigation'
export const dynamic = 'force-dynamic'
export async function GET() {
  const headers = { 'Cache-Control': 'no-store, max-age=0' }
  try { return NextResponse.json({ navigation: await publishedNavigation() }, { headers }) }
  catch { return NextResponse.json({ error: 'Navigation temporarily unavailable.' }, { status: 503, headers }) }
}
