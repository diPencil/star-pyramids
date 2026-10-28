import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatCurrency } from '@/lib/currency'

const mocks = vi.hoisted(() => ({
  booking: { findUnique: vi.fn() },
  payment: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  query: vi.fn(),
}))
vi.mock('@/lib/server/db', () => ({ db: {
  booking: mocks.booking, payment: mocks.payment,
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
    booking: mocks.booking, payment: mocks.payment, $queryRaw: mocks.query,
  }),
  user: { findUnique: vi.fn(async () => null) },
} }))
vi.mock('@/lib/server/notifications', () => ({ notifyUser: vi.fn(), notifyStaff: vi.fn() }))
vi.mock('@/lib/server/email', () => ({ sendCustomerEmailSafe: vi.fn(), sendStaffEmailSafe: vi.fn() }))
vi.mock('@/lib/server/booking-access', () => ({
  guestBookingPath: vi.fn(), issueGuestBookingToken: vi.fn(), revokeGuestBookingTokens: vi.fn(),
  resolveGuestBookingToken: vi.fn(),
}))
import { deriveBookingPaymentSummary, initiateCustomerPayment, recordOfflinePayment, recordOfflineRefund, toCustomerPaymentView, toStaffPaymentView } from '@/lib/server/payments'
import { toCustomerView, toStaffView } from '@/lib/server/bookings'

const date = new Date('2026-01-01T00:00:00Z')
function booking(currency = 'USD') {
  return { id: 'bk1', reference: 'SP-BK-ABC123', currency, userId: 'user1', status: 'CONFIRMED',
    total: '120.25', subtotal: '125.25', discount: '5.00', paymentStatus: 'PENDING',
    createdAt: date, updatedAt: date, contactName: 'Test', contactEmail: 'test@example.com',
    contactPhone: '', notes: null, items: [], activities: [], payments: [], user: null }
}
function payment(currency = 'USD') {
  return { bookingId: 'bk1', reference: 'SP-PAY-ABC123', currency, booking: booking(currency), provider: 'offline',
    providerPaymentId: null, status: 'PAID', amount: '120.25', amountPaid: '20.25', amountRefunded: '0.25',
    initiatedAt: date, createdAt: date, updatedAt: date, paidAt: date, failedAt: null,
    cancelledAt: null, refundedAt: null, events: [], failureCode: null, failureMessage: null }
}
const initiation = { bookingReference: 'SP-BK-ABC123', idempotencyKey: '' }
const receipt = { bookingReference: 'SP-BK-ABC123', currency: 'USD', method: 'cash', amount: 10, idempotencyKey: 'accounting-key-123' }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.booking.findUnique.mockResolvedValue(booking())
  mocks.payment.findUnique.mockResolvedValue(null)
  mocks.payment.findFirst.mockResolvedValue(null)
  mocks.payment.findMany.mockResolvedValue([])
  mocks.query.mockResolvedValue([booking()])
  mocks.payment.create.mockResolvedValue(payment())
})

describe('historical accounting currency reads', () => {
  it.each(['EUR', 'EGP', 'GBP'])('preserves native %s amounts in customer and staff DTOs', (currency) => {
    const rawBooking = booking(currency) as unknown as Parameters<typeof toCustomerView>[0]
    for (const project of [toCustomerView, toStaffView]) expect(project(rawBooking)).toMatchObject({ currency, total: 120.25, discount: 5 })
    const rawPayment = payment(currency) as unknown as Parameters<typeof toCustomerPaymentView>[0]
    for (const project of [toCustomerPaymentView, toStaffPaymentView]) expect(project(rawPayment)).toMatchObject({ currency, amount: 120.25, amountPaid: 20.25, amountRefunded: 0.25 })
  })
  it('refuses a mixed-currency booking projection', () => {
    const row = { ...booking('USD'), payments: [{ ...payment('EUR'), createdAt: date }] } as unknown as Parameters<typeof toCustomerView>[0]
    expect(() => toCustomerView(row)).toThrow(/currency does not match/)
  })
  it('does not fabricate USD for a nullable legacy payment code', () => {
    const row = { ...payment(), currency: null } as unknown as Parameters<typeof toCustomerPaymentView>[0]
    expect(toCustomerPaymentView(row).currency).toBeNull()
  })
})

describe('currency-aware balance summaries', () => {
  const paid = { status: 'paid' as const, amountPaidCents: 1250, amountRefundedCents: 25, reference: 'pay', createdAt: date }
  it('preserves the two-argument helper API', () => {
    expect(deriveBookingPaymentSummary([paid], 1250)).toMatchObject({ paidTotal: 12.5, refundedTotal: 0.25 })
  })
  it('sums matching foreign historical currency without conversion', () => {
    expect(deriveBookingPaymentSummary([{ ...paid, currency: 'EUR' }], 1250, 'EUR')).toMatchObject({ paidTotal: 12.5, state: 'partially_refunded' })
  })
  it('rejects mixed currencies, including refunded rows', () => {
    expect(() => deriveBookingPaymentSummary([{ ...paid, currency: 'EUR' }], 1250, 'USD')).toThrow(/currency does not match/)
    expect(() => deriveBookingPaymentSummary([{ ...paid, currency: 'EUR', status: 'refunded' }], 1250, 'USD')).toThrow(/currency does not match/)
  })
})

describe('new USD accounting writes', () => {
  it.each(['EUR', 'EGP', 'GBP'])('rejects customer initiation for %s before writing', async (currency) => {
    mocks.booking.findUnique.mockResolvedValue(booking(currency))
    await expect(initiateCustomerPayment('user1', initiation)).rejects.toThrow(/Only USD bookings/)
    expect(mocks.payment.create).not.toHaveBeenCalled()
  })
  it('rechecks customer booking currency under the transaction lock', async () => {
    mocks.query.mockResolvedValue([booking('EUR')])
    await expect(initiateCustomerPayment('user1', initiation)).rejects.toThrow(/Only USD bookings/)
    expect(mocks.query.mock.calls[0][0].join('')).toMatch(/currency FROM bookings[\s\S]*FOR UPDATE/)
    expect(mocks.payment.create).not.toHaveBeenCalled()
  })
  it('creates a USD intent with the locked amount', async () => {
    mocks.query.mockResolvedValue([{ ...booking(), total: '99.50' }])
    await expect(initiateCustomerPayment('user1', initiation)).resolves.toMatchObject({ created: true })
    expect(mocks.payment.create.mock.calls[0][0].data).toMatchObject({ currency: 'USD', amount: '99.50' })
  })
  it('rejects a foreign active attempt for a USD booking', async () => {
    mocks.payment.findFirst.mockResolvedValue(payment('EUR'))
    await expect(initiateCustomerPayment('user1', initiation)).rejects.toThrow(/currency does not match/)
    expect(mocks.payment.create).not.toHaveBeenCalled()
  })
  it.each(['EUR', 'EGP'])('rejects %s offline bookings under lock', async (currency) => {
    mocks.query.mockResolvedValue([booking(currency)])
    await expect(recordOfflinePayment(receipt)).rejects.toThrow(/Only USD bookings/)
    expect(mocks.payment.create).not.toHaveBeenCalled()
  })
  it('rejects mixed-currency receipts before calculating balance', async () => {
    mocks.payment.findMany.mockResolvedValue([payment('EUR')])
    await expect(recordOfflinePayment(receipt)).rejects.toThrow(/currency does not match/)
    expect(mocks.payment.create).not.toHaveBeenCalled()
  })
  it('records a matching USD receipt without conversion', async () => {
    await expect(recordOfflinePayment(receipt)).resolves.toMatchObject({ created: true })
    expect(mocks.payment.create.mock.calls[0][0].data).toMatchObject({ currency: 'USD', amountPaid: '10.00' })
  })
  it.each(['EUR', 'EGP'])('rejects USD refund entry against a historical %s payment', async (currency) => {
    mocks.payment.findUnique.mockResolvedValue(payment(currency))
    await expect(recordOfflineRefund({ paymentReference: 'SP-PAY-ABC123', amount: 10, method: 'cash', externalReference: 'bank-ref', confirmReturned: true })).rejects.toThrow(/USD payment and booking/)
    expect(mocks.query).not.toHaveBeenCalled()
  })
})

describe('native accounting dialog limits', () => {
  it('keeps cents and the USD denomination', () => {
    expect(formatCurrency(120.25, 'USD', 'en')).toBe('$120.25')
    expect(formatCurrency(120.25, 'EGP', 'en')).not.toBe(formatCurrency(120.25 * 48, 'EGP', 'en'))
  })
  it('uses explicit native USD helpers in both accounting dialogs', () => {
    const bookingSource = readFileSync(new URL('../app/admin/bookings/[ref]/content.tsx', import.meta.url), 'utf8')
    const paymentSource = readFileSync(new URL('../app/admin/payments/[ref]/content.tsx', import.meta.url), 'utf8')
    expect(bookingSource).toContain('formatAccountingUsd(remainingBookingBalance(')
    expect(paymentSource).toContain('formatAccountingUsd(Math.max(0, item.amountPaid - item.amountRefunded))')
    for (const source of [bookingSource, paymentSource]) expect(source).toContain('formatCurrency(amount, TOUR_BOOKING_CURRENCY,')
  })
})
