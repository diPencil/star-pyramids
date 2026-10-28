import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => {
  const db = {
    bookingDocument: { findUnique: vi.fn(), create: vi.fn() },
    booking: { findUnique: vi.fn() }, payment: { findUnique: vi.fn() },
    documentSequence: { upsert: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn(),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  }
  return { db }
})
vi.mock('@/lib/server/db', () => ({ db: mocks.db }))
vi.mock('@/lib/server/auth', () => ({ hasPermission: vi.fn() }))
vi.mock('@/lib/server/settings', () => ({ getSetting: vi.fn() }))
vi.mock('@/lib/server/booking-access', () => ({ GuestBookingAccessError: class extends Error {}, resolveGuestBookingToken: vi.fn() }))
import { issueBookingDocument } from '@/lib/server/documents'
const { db } = mocks
const input = { type: 'PAYMENT_RECEIPT' as const, bookingReference: 'SP-BK-ABC123', paymentReference: 'SP-PAY-ABC123', idempotencyKey: 'receipt-key-123' }
function document(overrides: Record<string, unknown> = {}) {
  return { id: 'd1', number: 'SP-RCP-2026-000001', type: 'PAYMENT_RECEIPT', currency: 'USD', amountCents: 10000,
    booking: { reference: input.bookingReference }, payment: { reference: input.paymentReference }, issuedAt: new Date(), ...overrides }
}
beforeEach(() => {
  vi.resetAllMocks()
  db.bookingDocument.findUnique.mockResolvedValue(null)
  db.booking.findUnique.mockResolvedValue({ id: 'b1', reference: input.bookingReference, currency: 'USD', total: '100.00' })
  db.payment.findUnique.mockResolvedValue({ id: 'p1', bookingId: 'b1', currency: 'USD', amountPaid: '100.00' })
  db.$queryRaw.mockImplementation(async (sql: TemplateStringsArray) => sql.join('').includes('SELECT lastValue') ? [{ lastValue: 1 }] : [])
})
describe('document issuance key identity', () => {
  it.each([
    ['booking', { booking: { reference: 'SP-BK-OTHER1' } }],
    ['payment', { payment: { reference: 'SP-PAY-OTHER1' } }],
    ['document type', { type: 'INVOICE' }],
    ['currency', { currency: 'EUR' }],
  ])('rejects an existing key for another %s before returning its document', async (_label, overrides) => {
    db.bookingDocument.findUnique.mockResolvedValue(document(overrides))
    await expect(issueBookingDocument(input)).resolves.toEqual({ ok: false, error: 'invalid-input' })
    expect(db.documentSequence.upsert).not.toHaveBeenCalled(); expect(db.bookingDocument.create).not.toHaveBeenCalled()
  })
  it('returns the original receipt for the same logical document', async () => {
    db.bookingDocument.findUnique.mockResolvedValue(document())
    await expect(issueBookingDocument(input)).resolves.toMatchObject({ ok: true, created: false, document: { bookingReference: input.bookingReference } })
  })
  it('checks the transaction replay identity', async () => {
    db.bookingDocument.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(document({ booking: { reference: 'SP-BK-OTHER1' } }))
    await expect(issueBookingDocument(input)).resolves.toEqual({ ok: false, error: 'invalid-input' })
    expect(db.bookingDocument.create).not.toHaveBeenCalled()
  })
  it('checks the winner after a unique-key race', async () => {
    db.bookingDocument.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(document({ payment: { reference: 'SP-PAY-OTHER1' } }))
    db.bookingDocument.create.mockRejectedValue({ code: 'P2002', meta: { target: ['idempotencyKey'] } })
    await expect(issueBookingDocument(input)).resolves.toEqual({ ok: false, error: 'invalid-input' })
  })
  it('does not replay a refund note for another event', async () => {
    db.bookingDocument.findUnique.mockResolvedValue(document({ type: 'REFUND_NOTE' }))
    db.$queryRaw.mockResolvedValue([{ id: 'd1', refundEventId: 'refund-original' }])
    await expect(issueBookingDocument({ ...input, type: 'REFUND_NOTE', refundEventId: 'refund-other' })).resolves.toEqual({ ok: false, error: 'invalid-input' })
  })
  it('rejects receipt issuance for a non-USD booking', async () => {
    db.booking.findUnique.mockResolvedValue({ id: 'b1', currency: 'EUR' })
    await expect(issueBookingDocument(input)).resolves.toEqual({ ok: false, error: 'non-usd-payment' })
    expect(db.bookingDocument.create).not.toHaveBeenCalled()
  })
  it('rejects refund-note issuance for a foreign payment event', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'ev1', paymentBookingId: 'b1', paymentReference: input.paymentReference, paymentCurrency: 'EUR' }])
    await expect(issueBookingDocument({ ...input, type: 'REFUND_NOTE', refundEventId: 'ev1' })).resolves.toEqual({ ok: false, error: 'non-usd-payment' })
    expect(db.bookingDocument.create).not.toHaveBeenCalled()
  })
})
