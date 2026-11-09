import { NextResponse } from 'next/server'
import { bookingSameOrigin } from '@/lib/server/booking-request-security'
import { confirmationCookieFromHeader, readBookingConfirmation } from '@/lib/server/booking-confirmation'
import { readBoundedJson } from '@/lib/server/request-json'

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  if (!bookingSameOrigin(request)) return NextResponse.json({ ready: false }, { status: 403, headers })
  let input: unknown
  try { input = await readBoundedJson(request, 256) } catch { return NextResponse.json({ ready: false }, { status: 400, headers }) }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'flow')) {
    return NextResponse.json({ ready: false }, { status: 400, headers })
  }
  const flow = (input as { flow?: unknown }).flow
  const context = readBookingConfirmation(confirmationCookieFromHeader(request.headers.get('cookie')), flow)
  // Acknowledgement only: no receipt, access URL, customer data or grants.
  return NextResponse.json({ ready: Boolean(context) }, { headers })
}
