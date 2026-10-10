import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { getReviewIntegrations, loadReviewFeed, saveReviewIntegration } from '@/lib/server/review-integrations'
import { isReviewProvider } from '@/lib/review-integrations'
import { db } from '@/lib/server/db'
const headers = { 'Cache-Control': 'no-store' }
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.view')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try { return NextResponse.json({ integrations: await getReviewIntegrations() }, { headers }) }
  catch { return NextResponse.json({ error: 'Could not load review integrations.' }, { status: 500, headers }) }
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
  if (!hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  let body: Record<string, unknown>
  try { const value: unknown = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); body = value as Record<string, unknown> }
  catch { return NextResponse.json({ error: 'Invalid JSON object.' }, { status: 400, headers }) }
  if (!isReviewProvider(body.provider) || !['save', 'test'].includes(String(body.action))) return NextResponse.json({ error: 'Invalid action or provider.' }, { status: 400, headers })
  try {
    let testState: string | undefined
    if (body.action === 'save') await saveReviewIntegration(body.provider, body.config, body.secret, body.clearSecret)
    else testState = (await loadReviewFeed(body.provider, true)).state
    // Match settings' existing best-effort audit policy: audit availability must
    // not turn a completed save into a false failure or leak credential values.
    await db.staffActionAudit.create({ data: { actorId: user.id, action: `reviews.integration.${body.action}`, entityType: 'site_settings', metadata: JSON.stringify({ provider: body.provider }) } }).catch(() => undefined)
    return NextResponse.json({ integrations: await getReviewIntegrations(), testState }, { headers })
  } catch (e) { return NextResponse.json({ error: e instanceof Error && e.name === 'Error' && !e.message.toLowerCase().includes('prisma') ? e.message : 'Review integration operation failed.' }, { status: 400, headers }) }
}
