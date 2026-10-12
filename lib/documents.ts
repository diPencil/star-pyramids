// Shared booking-document contracts for every UI surface (Phase C).
//
// Client-safe: no database, no secrets, no server-only imports. The three
// audiences (admin, customer, guest) share these list-item shapes, type
// labels and PDF link builders so every surface points at the same
// token-/session-protected Phase B download routes.
//
// - Owners download through `/api/account/bookings/[ref]/documents/[id]/pdf`.
// - Staff download through `/api/admin/bookings/[ref]/documents/[id]/pdf`.
// - Guests download through `/api/bookings/access/[token]/documents/[id]/pdf`
//   using the token they already hold; tokens are never embedded in
//   document content, only in the download URL the browser requests.
import type { BookingDocumentType } from '@prisma/client';

import type { Locale } from './locale-config';

/** What the document list endpoints return (JSON-safe: ISO date strings). */
export interface DocumentListItem {
  id: string;
  number: string;
  type: BookingDocumentType;
  bookingReference: string;
  paymentReference: string | null;
  amountCents: number;
  currency: 'USD';
  issuedAt: string;
}

/** Slim verified-payment option for the admin receipt selector. */
export interface VerifiedPaymentOption {
  reference: string;
  amountPaidCents: number;
  paidAt: string | null;
}

const DOCUMENT_TYPE_LABELS: Record<BookingDocumentType, Record<Locale, string>> = {
  BOOKING_REQUEST: {
    en: 'Booking request',
    es: 'Solicitud de reserva',
    it: 'Richiesta di prenotazione',
    ar: 'طلب حجز',
  },
  BOOKING_CONFIRMATION: {
    en: 'Booking confirmation',
    es: 'Confirmación de reserva',
    it: 'Conferma di prenotazione',
    ar: 'تأكيد الحجز',
  },
  PAYMENT_RECEIPT: {
    en: 'Payment receipt',
    es: 'Recibo de pago',
    it: 'Ricevuta di pagamento',
    ar: 'إيصال دفع',
  },
  // Reserved types stay labelled so a future surface never shows a raw
  // enum, even though issuance keeps them disabled.
  INVOICE: { en: 'Invoice', es: 'Factura', it: 'Fattura', ar: 'فاتورة' },
  REFUND_NOTE: {
    en: 'Refund note',
    es: 'Nota de reembolso',
    it: 'Nota di rimborso',
    ar: 'إشعار استرداد',
  },
  BOOKING_VOUCHER: {
    en: 'Booking voucher',
    es: 'Bono de reserva',
    it: 'Voucher di prenotazione',
    ar: 'قسيمة حجز',
  },
};

/** Human-readable document type in the viewer's locale (AR preserved). */
export function documentTypeLabel(type: BookingDocumentType, locale: Locale): string {
  return DOCUMENT_TYPE_LABELS[type][locale] ?? DOCUMENT_TYPE_LABELS[type].en;
}

/** Issue date in the viewer's locale (date only, no time). */
export function formatDocumentIssuedAt(iso: string, locale: Locale): string {
  const intlLocale =
    locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US';
  return new Date(iso).toLocaleDateString(intlLocale);
}

/** Phase B download URL for the signed-in booking owner. */
export function ownerDocumentPdfUrl(bookingReference: string, documentId: string): string {
  return `/api/account/bookings/${encodeURIComponent(bookingReference)}/documents/${encodeURIComponent(documentId)}/pdf`;
}

/** Phase B download URL for staff (cookie session + view permission). */
export function staffDocumentPdfUrl(bookingReference: string, documentId: string): string {
  return `/api/admin/bookings/${encodeURIComponent(bookingReference)}/documents/${encodeURIComponent(documentId)}/pdf`;
}

/**
 * Phase B download URL for a guest. The token is the credential the
 * guest already holds for their private booking page; it travels in the
 * URL path exactly like the existing guest booking and proof endpoints.
 */
export function guestDocumentPdfUrl(token: string, documentId: string): string {
  return `/api/bookings/access/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}/pdf`;
}
