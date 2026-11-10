import { NextResponse } from 'next/server'
import {bookingSameOrigin,bookingClientIp,reserveBookingAttempt} from '@/lib/server/booking/booking-request-security'
import { isValidEmail, normalizeEmail } from '@/lib/core/validation'
import { OFFICIAL_BOOKING_REF_PATTERN } from '@/lib/booking/booking'
import { emailGuestBookingAccess } from '@/lib/server/booking/access/booking-recovery'
import { readBoundedJson } from '@/lib/server/request-json'

// Identical response for missing, account-owned, mismatched and guest bookings.
// No customer data, token or private URL ever leaves this endpoint.
export async function POST(request: Request) {
  if (!bookingSameOrigin(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  let body: unknown
  try {
    body = await readBoundedJson(request, 2048)
  } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const input = body as Record<string, unknown>
  const reference = typeof input.reference === 'string' ? input.reference.trim() : ''
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : ''
  if (Object.keys(input).some(key => !['reference', 'email'].includes(key)) || !OFFICIAL_BOOKING_REF_PATTERN.test(reference) || email.length > 190 || !isValidEmail(email)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const ip=bookingClientIp(request)
  let limit
  try{limit=await reserveBookingAttempt(email,ip)}catch{return NextResponse.json({error:'The service is temporarily unavailable.'},{status:503})}
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: limit.retryAfterSeconds?{ 'Retry-After': String(limit.retryAfterSeconds) }:{} })
  // Response deliberately does not confirm existence, matching email or delivery.
  await emailGuestBookingAccess(reference, email).catch(() => undefined)
  return NextResponse.json({ accepted: true }, { headers: { 'Cache-Control': 'no-store' } })
}
