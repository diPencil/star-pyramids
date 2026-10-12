// Phase C: shared document UI contract tests (no database).
//
// The admin, customer and guest surfaces share `lib/documents.ts` for
// type labels and PDF link builders, so every audience names documents
// identically and points at the correct Phase B download route.
import { describe, it, expect } from 'vitest'

import {
  documentTypeLabel,
  formatDocumentIssuedAt,
  guestDocumentPdfUrl,
  ownerDocumentPdfUrl,
  staffDocumentPdfUrl,
} from '@/lib/documents'

describe('document type labels', () => {
  it('names the three issuable types in EN/ES/IT and preserves AR', () => {
    expect(documentTypeLabel('BOOKING_REQUEST', 'en')).toBe('Booking request')
    expect(documentTypeLabel('BOOKING_REQUEST', 'es')).toBe('Solicitud de reserva')
    expect(documentTypeLabel('BOOKING_REQUEST', 'it')).toBe('Richiesta di prenotazione')
    expect(documentTypeLabel('BOOKING_REQUEST', 'ar')).toBe('طلب حجز')

    expect(documentTypeLabel('BOOKING_CONFIRMATION', 'en')).toBe('Booking confirmation')
    expect(documentTypeLabel('BOOKING_CONFIRMATION', 'es')).toBe('Confirmación de reserva')
    expect(documentTypeLabel('BOOKING_CONFIRMATION', 'it')).toBe('Conferma di prenotazione')
    expect(documentTypeLabel('BOOKING_CONFIRMATION', 'ar')).toBe('تأكيد الحجز')

    expect(documentTypeLabel('PAYMENT_RECEIPT', 'en')).toBe('Payment receipt')
    expect(documentTypeLabel('PAYMENT_RECEIPT', 'es')).toBe('Recibo de pago')
    expect(documentTypeLabel('PAYMENT_RECEIPT', 'it')).toBe('Ricevuta di pagamento')
    expect(documentTypeLabel('PAYMENT_RECEIPT', 'ar')).toBe('إيصال دفع')
  })

  it('labels the reserved types instead of leaking raw enums', () => {
    expect(documentTypeLabel('INVOICE', 'en')).toBe('Invoice')
    expect(documentTypeLabel('REFUND_NOTE', 'es')).toBe('Nota de reembolso')
    expect(documentTypeLabel('BOOKING_VOUCHER', 'it')).toBe('Voucher di prenotazione')
    expect(documentTypeLabel('INVOICE', 'ar')).toBe('فاتورة')
  })
})

describe('document PDF link builders', () => {
  it('points each actor at their own Phase B download route', () => {
    expect(ownerDocumentPdfUrl('SP-BK-ABC123', 'doc-1')).toBe(
      '/api/account/bookings/SP-BK-ABC123/documents/doc-1/pdf',
    )
    expect(staffDocumentPdfUrl('SP-BK-ABC123', 'doc-1')).toBe(
      '/api/admin/bookings/SP-BK-ABC123/documents/doc-1/pdf',
    )
    expect(guestDocumentPdfUrl('tok-en_123', 'doc-1')).toBe(
      '/api/bookings/access/tok-en_123/documents/doc-1/pdf',
    )
  })

  it('encodes references, tokens and ids', () => {
    expect(ownerDocumentPdfUrl('SP-BK-A B', 'd/1')).toBe(
      '/api/account/bookings/SP-BK-A%20B/documents/d%2F1/pdf',
    )
    expect(guestDocumentPdfUrl('a+b', 'd 1')).toBe(
      '/api/bookings/access/a%2Bb/documents/d%201/pdf',
    )
  })
})

describe('document issue-date formatting', () => {
  it('renders a non-empty localized date per locale', () => {
    const iso = '2026-10-12T07:00:00.000Z'
    for (const locale of ['en', 'es', 'it', 'ar'] as const) {
      const label = formatDocumentIssuedAt(iso, locale)
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toContain('Invalid')
    }
  })
})
