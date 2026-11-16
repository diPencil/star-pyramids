import { NextResponse } from 'next/server'
import { resolveSiteUrl } from '@/lib/seo/seo'
import { isSocialHost } from '@/lib/server/auth/social-flow'
import { consumeSocialMeasurement } from '@/lib/server/auth/social-measurement'
import { SOCIAL_MEASUREMENT_HEADER } from '@/lib/tracking/auth/social-measurement'
import { isProductionTrackingHost, isTrackingGrant } from '@/lib/tracking/tracking'

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export async function POST(request: Request) {
  const grant = request.headers.get(SOCIAL_MEASUREMENT_HEADER)
  const sentOrigin = request.headers.get('origin')
  const sameOrigin = sentOrigin === resolveSiteUrl() || ((!sentOrigin || sentOrigin === 'null') && request.headers.get('sec-fetch-site') === 'same-origin')
  if (!sameOrigin || !isSocialHost(request) || !isProductionTrackingHost(process.env.NODE_ENV, new URL(resolveSiteUrl()).host) || !isTrackingGrant(grant)) {
    return NextResponse.json({}, { status: 403, headers })
  }
  try { return NextResponse.json({ events: await consumeSocialMeasurement(grant) }, { headers }) }
  catch { return NextResponse.json({}, { status: 503, headers }) }
}
