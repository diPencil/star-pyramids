import 'server-only'

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OFFICIAL_BOOKING_REF_PATTERN } from '../../../booking/booking'
import { CONFIRMATION_FLOW, type CheckoutReceipt } from '../../../booking/booking-confirmation'

const PURPOSE = 'sp-booking-confirmation-v1'
const TTL = 30 * 60 * 1000
const MAX_CONTEXTS = 3
type Confirmation = { flow: string; ownerId: string | null; expires: number; receipt: CheckoutReceipt }
export const confirmationCookieName = () => process.env.NODE_ENV === 'production' ? '__Host-sp-booking-confirmation' : 'sp-booking-confirmation'

function key() {
  // Reuse the existing server-only signing configuration with a distinct key
  // derivation and format. Never accept a price-quote token as a handoff.
  const secret = process.env.BOOKING_QUOTE_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) throw Error('Confirmation unavailable')
  return createHmac('sha256', secret).update(PURPOSE).digest()
}

function validReceipt(input: unknown): input is CheckoutReceipt {
  if (!input || typeof input !== 'object') return false
  const receipt = input as CheckoutReceipt
  return typeof receipt.reference === 'string' && OFFICIAL_BOOKING_REF_PATTERN.test(receipt.reference) &&
    (receipt.total === null || typeof receipt.total === 'number' && Number.isFinite(receipt.total) && receipt.total >= 0) &&
    ['existing', 'linked', 'guest'].every(field => typeof receipt[field as keyof CheckoutReceipt] === 'boolean') &&
    typeof receipt.email === 'string' && receipt.email.length <= 120 && !/[\r\n]/.test(receipt.email) &&
    (receipt.guestAccessUrl === null || typeof receipt.guestAccessUrl === 'string' && /^\/booking\/[A-Za-z0-9_-]{43}$/.test(receipt.guestAccessUrl))
}

function contexts(value: string | undefined, now: number): Confirmation[] {
  try {
    if (!value || value.length > 3800) return []
    const [version, iv, payload, tag, extra] = value.split('.')
    if (version !== 'v1' || extra || !/^[A-Za-z0-9_-]{16}$/.test(iv) || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{22}$/.test(tag)) return []
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(PURPOSE))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const decoded: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8'))
    if (!Array.isArray(decoded) || decoded.length > MAX_CONTEXTS) return []
    return decoded.filter((entry): entry is Confirmation => entry && CONFIRMATION_FLOW.test(entry.flow) &&
      (entry.ownerId === null || typeof entry.ownerId === 'string' && entry.ownerId.length <= 128) &&
      typeof entry.expires === 'number' && entry.expires > now && entry.expires <= now + TTL && validReceipt(entry.receipt))
  } catch { return [] }
}

export function readBookingConfirmation(value: string | undefined, flow: unknown, now = Date.now()): Confirmation | undefined {
  if (typeof flow !== 'string' || !CONFIRMATION_FLOW.test(flow)) return
  return contexts(value, now).find(entry => entry.flow === flow)
}

export function confirmationCookieFromHeader(header: string | null): string | undefined {
  const prefix = confirmationCookieName() + '='
  return header?.split(';').map(value => value.trim()).find(value => value.startsWith(prefix))?.slice(prefix.length)
}

/** Called only with the server's successful persisted/replayed booking result. */
export function bookingConfirmationResponse(
  payload: Record<string, unknown>, status: number, cookie: string | undefined,
  ownerId: string | null, receipt: CheckoutReceipt, now = Date.now(),
) {
  const options = { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } }
  const fallback = () => NextResponse.json(payload, options)
  try {
    if (!validReceipt(receipt)) return fallback()
    const flow = createHmac('sha256', key()).update(JSON.stringify([ownerId, receipt.reference])).digest('hex').slice(0, 32)
    const previous = contexts(cookie, now)
    const matching = previous.find(entry => entry.flow === flow)
    // Guest replays must never remint an access token. Preserve an existing
    // matching link when available; otherwise retain the private recovery UI.
    const saved = { ...receipt, guestAccessUrl: receipt.guestAccessUrl ?? matching?.receipt.guestAccessUrl ?? null }
    const entries = [...previous.filter(entry => entry.flow !== flow).slice(-(MAX_CONTEXTS - 1)), { flow, ownerId, expires: now + TTL, receipt: saved }]
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key(), iv)
    cipher.setAAD(Buffer.from(PURPOSE))
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(entries), 'utf8'), cipher.final()])
    const value = `v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`
    if (value.length > 3800) return fallback()
    const response = NextResponse.json({ ...payload, bookingConfirmationUrl: `/booking-confirmation?flow=${flow}` }, options)
    response.cookies.set(confirmationCookieName(), value, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TTL / 1000,
    })
    return response
  } catch { return fallback() }
}
