import 'server-only'

import { db } from './db'
import { generateOpaqueToken, hashToken } from '../core/tokens'
import { DEFAULT_ACCESS_TTL_DAYS, guestBookingPath } from './booking-access'
import { sendCustomerEmailSafe } from './email'
import { prepareCheckoutAccount } from './checkout-account'

/** Email-only recovery. A reference/email never grants a browser credential. */
export async function emailGuestBookingAccess(reference: string, email: string): Promise<void> {
  // The enrollment service independently verifies the saved email and consent.
  await prepareCheckoutAccount(reference,email).catch(()=>undefined)
  const issued = await db.$transaction(async tx => {
    // Serialize recoveries for this booking without changing its business data.
    await tx.$queryRaw`SELECT reference FROM bookings WHERE reference = ${reference} FOR UPDATE`
    const row = await tx.booking.findUnique({ where: { reference }, select: { reference: true, userId: true, contactEmail: true, contactName: true } })
    if (!row || row.userId !== null || row.contactEmail.trim().toLowerCase() !== email) return null
    const now = new Date()
    const recent = await tx.bookingAccessToken.findFirst({ where: { bookingRef: reference, revokedAt: null, expiresAt: { gt: now }, createdAt: { gte: new Date(now.getTime() - 60_000) } }, select: { id: true } })
    if (recent) return null // also coalesces parallel clicks and an in-flight original receipt
    const raw = generateOpaqueToken(32)
    const days = Number(process.env.BOOKING_ACCESS_TOKEN_TTL_DAYS)
    const token = await tx.bookingAccessToken.create({ data: { bookingRef: reference, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + (Number.isFinite(days) && days > 0 ? days : DEFAULT_ACCESS_TTL_DAYS) * 86400000) }, select: { id: true, createdAt: true, tokenHash: true } })
    return { row, raw, token }
  })
  if (!issued) return
  const delivery = await sendCustomerEmailSafe('booking_access_requested', issued.row.contactEmail, {
    name: issued.row.contactName, reference, detailUrl: guestBookingPath(issued.raw),
  }, { relatedReference: reference, idempotencyKey: `guest-booking-access:${issued.token.id}` }).catch(() => null)
  // A failed recovery must not invalidate a previously delivered private link.
  if (delivery?.status === 'SENT') {
    await db.bookingAccessToken.updateMany({ where: { bookingRef: reference, tokenHash: { not: issued.token.tokenHash }, revokedAt: null, createdAt: { lte: issued.token.createdAt } }, data: { revokedAt: new Date() } })
  } else {
    await db.bookingAccessToken.updateMany({ where: { id: issued.token.id }, data: { revokedAt: new Date() } })
  }
}
