import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission, hasStaffRole } from '@/lib/server/auth'
import { isSameOriginRequest } from '@/lib/server/csrf'
import { getSetting } from '@/lib/server/settings'
import { resolveTrackingSettings } from '@/lib/tracking'
import { admitTrackingHealthCheck, verifyTrackingHealth } from '@/lib/server/tracking-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' }
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers })
    if (!hasStaffRole(user) || !hasPermission(user, 'settings.edit')) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers })
    if (!admitTrackingHealthCheck(user.id)) return NextResponse.json({ error: 'Please wait before verifying again.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } })
    const [enabled, containerId, measurementId] = await Promise.all([getSetting('tracking.gtmEnabled'), getSetting('tracking.gtmContainerId'), getSetting('tracking.ga4MeasurementId')])
    const settings = resolveTrackingSettings({ enabled, containerId })
    return NextResponse.json(await verifyTrackingHealth({ ...settings, measurementId: measurementId ?? '' }), { headers })
  } catch { return NextResponse.json({ error: 'Tracking verification could not be completed.' }, { status: 503, headers }) }
}
