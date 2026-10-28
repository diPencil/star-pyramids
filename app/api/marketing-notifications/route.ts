import { NextResponse } from 'next/server'
import { listMarketingNotifications } from '@/lib/server/marketing-notifications'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { return NextResponse.json({ notifications: await listMarketingNotifications() }, { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch { return NextResponse.json({ error: 'Offers could not be loaded.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } }) }
}
