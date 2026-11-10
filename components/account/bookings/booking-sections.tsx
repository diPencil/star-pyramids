'use client'

import { formatCurrency } from "@/lib/payments/currency";
// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Download, Eye, FileText, MessageCircle, PackageCheck, Plus, ReceiptText, ShoppingBag, Users, WalletCards, X } from "lucide-react";
import { formatPrice, tx, useLocale, type Locale } from "@/components/locale";
import { isValidPreferredDate, bookingActivityLabel, bookingStatusLabel, type Booking, type BookingStatus } from "@/lib/booking/booking";
import { documentTypeLabel, formatDocumentIssuedAt, guestDocumentPdfUrl, ownerDocumentPdfUrl, type DocumentListItem } from "@/lib/documents";
import { usePagination } from "@/components/admin/admin-pagination";
import { saveMessageDraft } from "@/lib/account/customer-account";
import { BookingPrintDocument } from "@/components/booking/booking-print-document";
import { BookingPaymentPanel, PaymentInstructions, PaymentProofForm, bookingMoney, bookingPaymentLabel } from "@/components/booking/booking-payment";
import { CustomerConfirmDialog } from "../customer-confirm-dialog";
import { customerErrorText } from "@/lib/account/customer-error-copy";
import { useImpersonated } from "../shared/account-hooks"
import { EmptyState, CustomerPagination } from "../shared/account-ui"


async function apiBookingList(): Promise<Booking[]> {
  const res = await fetch('/api/account/bookings', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your bookings.')
  const data = (await res.json()) as { bookings?: Booking[] }
  if (!Array.isArray(data.bookings)) throw new Error('Could not load your bookings.')
  return data.bookings
}

async function apiBookingDetail(reference: string): Promise<Booking> {
  const res = await fetch(`/api/account/bookings/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as Booking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Booking not found.')
  return data
}

async function apiBookingCancel(reference: string): Promise<Booking> {
  const res = await fetch(`/api/account/bookings/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as Booking & { error?: string; code?: string }
  if (!res.ok) {
    // Preserve the machine code so callers can localize blocks
    // (e.g. financial-review) instead of showing raw server English.
    const err = new Error(data.error || 'Could not cancel the booking.')
    if (data.code) (err as { code?: string }).code = data.code
    throw err
  }
  return data
}

/** Localized explanation for a financial-review cancellation block. */
function financialReviewMessage(locale: Locale): string {
  return tx(locale, {
    en: 'This booking has a payment that needs review before it can be cancelled. Please contact support and we will help with the refund.',
    es: 'Esta reserva tiene un pago que debe revisarse antes de cancelarla. Contáctanos y te ayudaremos con el reembolso.',
    it: 'Questa prenotazione ha un pagamento da verificare prima della cancellazione. Contattaci e ti aiuteremo con il rimborso.',
    ar: 'هذا الحجز مرتبط بمدفوعات تحتاج إلى مراجعة قبل الإلغاء. تواصل معنا وسنساعدك في الاسترداد.',
  })
}

/**
 * Guest booking read. The private access token IS the credential  -  no
 * session cookie is sent or required, and the server derives the booking
 * from the token rather than from anything the caller supplies.
 */
async function apiGuestBooking(token: string): Promise<Booking> {
  const res = await fetch(`/api/bookings/access/${encodeURIComponent(token)}`, { credentials: 'omit' })
  const data = (await res.json().catch(() => ({}))) as Booking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'This booking link is not valid.')
  return data
}

/** The signed-in customer's real bookings (database-backed). */
export function useCustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    apiBookingList()
      .then((rows) => { if (!cancelled) { setBookings(rows); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your bookings.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])
  return { bookings, loading, error }
}

export function useVisibleBookings() {
  const { bookings } = useCustomerBookings()
  return bookings
}

const bookingStatusCopy: Record<BookingStatus, { en: string; es: string; it: string; ar: string }> = {
  pending: { en: 'Request received', es: 'Solicitud recibida', it: 'Richiesta ricevuta', ar: 'تم استلام الطلب' },
  confirmed: { en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' },
  completed: { en: 'Completed', es: 'Completada', it: 'Completata', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' },
}

function BookingStatus({ booking, locale }: { booking: Booking; locale: Locale }) {
  return <span className={`customer-status ${booking.status}`}>{booking.status === 'confirmed' || booking.status === 'completed' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{bookingStatusLabel(booking.status, locale)}</span>
}

/** Prefer a valid stored line date, then a parseable creation date. Never throws. */
function displayBookingDate(booking: Booking, locale: Locale): string {
  const lineDate = booking.lines.find((line) => isValidPreferredDate(line.date))?.date
  if (lineDate) return lineDate
  const created = new Date(booking.createdAt)
  if (!Number.isNaN(created.getTime())) return created.toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB')
  return booking.lines[0]?.date || '-'
}

/**
 * Honest payment semantics (Phase 2E): no gateway exists, so a booking is
 * unpaid until staff confirms payment in a later phase. Only an
 * explicitly stored method is ever named. Phase 2E does not store
 * a payment method; this UI reflects the booking's actual payment state.
 */
function displayPaymentMethod(booking: Booking, locale: Locale): string {
  // Phase 2E has no gateway: paymentMethod is never set. Show honest state.
  if (booking.paymentStatus === 'paid') {
    return tx(locale, { en: 'Paid', es: 'Pagado', it: 'Pagato', ar: 'مدفوع' })
  }
  if (booking.paymentStatus === 'refunded') {
    return tx(locale, { en: 'Refunded', es: 'Reembolsado', it: 'Rimborsato', ar: 'مسترد' })
  }
  return tx(locale, { en: 'To be arranged', es: 'Por acordar', it: 'Da concordare', ar: 'سيتم الترتيب' })
}

/**
 * Honest offline payment state (Phase 3): derived from the
 * server-calculated payment summary  -  never from client input, never
 * from a customer proof submission. Booking lifecycle state stays in
 * `BookingStatus`; the two are never mixed.
 */
function displayPaymentStatus(booking: Booking, locale: Locale): string {
  return bookingPaymentLabel(booking, locale)
}

function BookingCard({ booking }: { booking: Booking }) {
  const { locale, currency } = useLocale()

  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  return <article className="customer-booking-row">
    <Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link>
    <div className="customer-booking-copy">
      <div className="customer-booking-top"><span>{booking.reference}</span><BookingStatus booking={booking} locale={locale} /></div>
      <h3><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{first?.title || (tx(locale, { en: 'Custom journey', es: 'Viaje personalizado', it: 'Viaggio personalizzato', ar: 'رحلة مخصصة' }))}</Link></h3>
      <div className="customer-booking-meta"><span><CalendarDays size={14} />{displayBookingDate(booking, locale)}</span><span><Users size={14} />{travelers} {tx(locale, { en: 'travelers', es: 'viajeros', it: 'viaggiatori', ar: 'مسافرين' })}</span><span><PackageCheck size={14} />{booking.lines.length} {tx(locale, { en: 'trip items', es: 'elementos del viaje', it: 'voci di viaggio', ar: 'رحلات' })}</span></div>
    </div>
    <div className="customer-booking-total"><small>{tx(locale, { en: 'Total', es: 'Total', it: 'Totale', ar: 'الإجمالي' })}</small><strong>{formatCurrency(booking.total, booking.currency, locale)}</strong><span className="customer-booking-links"><Link href={`/account/bookings/detail?ref=${encodeURIComponent(booking.reference)}`}>{tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })} <ArrowRight size={14} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })}>{tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })} <ArrowRight size={14} /></Link></span></div>
  </article>
}

/**
 * Customer booking detail (Phase 2E). Database-backed record owned by
 * the signed-in customer: fetched from `/api/account/bookings/*`.
 * Cancel runs against the same API and is server-enforced. Staff-only
 * notes never reach this UI  -  the customer serializer excludes them.
 */
/**
 * Issued-documents section shared by the customer booking page and the
 * private guest booking page (Phase C).
 *
 * Read-only: lists the booking's issued documents with per-document PDF
 * download links. The caller supplies the list endpoint and the PDF link
 * builder for its actor  -  the owner session route for customers, the
 * token-protected route for guests. No issuance controls live here, and
 * the token itself never appears in document content, only in the guest
 * PDF URLs the browser requests (same pattern as the guest booking and
 * proof endpoints). The section stays hidden until documents exist.
 */
function BookingDocumentsSection({ listUrl, pdfUrlFor, omitCredentials = false }: {
  listUrl: string
  pdfUrlFor: (documentId: string) => string
  omitCredentials?: boolean
}) {
  const { locale, currency } = useLocale()
  const [docs, setDocs] = useState<DocumentListItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(listUrl, { credentials: omitCredentials ? 'omit' : 'same-origin' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { documents?: DocumentListItem[] }
        if (!res.ok || !Array.isArray(data.documents)) throw new Error('Could not load the documents.')
        if (!cancelled) setDocs(data.documents)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [listUrl])

  if (docs === null && !failed) return null
  if (docs !== null && docs.length === 0 && !failed) return null

  return (
    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Official records', es: 'Registros oficiales', it: 'Documenti ufficiali', ar: 'سجلات رسمية' })}</span><h2>{tx(locale, { en: 'Documents', es: 'Documentos', it: 'Documenti', ar: 'المستندات' })}</h2></div></header>
      {failed || docs === null ? (
        <p role="alert" className="form-error">{tx(locale, { en: 'Could not load the documents.', es: 'No se pudieron cargar los documentos.', it: 'Impossibile caricare i documenti.', ar: 'تعذر تحميل المستندات.' })}</p>
      ) : (
        <>
          <p className="customer-booking-meta"><span>{tx(locale, { en: 'Official documents issued for this booking. Select a document to download its PDF.', es: 'Documentos oficiales emitidos para esta reserva. Selecciona un documento para descargar su PDF.', it: 'Documenti ufficiali emessi per questa prenotazione. Seleziona un documento per scaricare il PDF.', ar: 'مستندات رسمية صادرة لهذا الحجز. اختر مستندًا لتنزيل نسخته.' })}</span></p>
          {(docs ?? []).map((doc) => (
            <div key={doc.id} className="customer-detail-grid">
              <div><small>{tx(locale, { en: 'Type', es: 'Tipo', it: 'Tipo', ar: 'النوع' })}</small><strong><FileText size={14} /> {documentTypeLabel(doc.type, locale)}</strong></div>
              <div><small>{tx(locale, { en: 'Number', es: 'Número', it: 'Numero', ar: 'الرقم' })}</small><strong><code dir="ltr">{doc.number}</code></strong></div>
              <div><small>{tx(locale, { en: 'Issued', es: 'Emitido', it: 'Emesso', ar: 'تاريخ الإصدار' })}</small><strong>{formatDocumentIssuedAt(doc.issuedAt, locale)}</strong></div>
              <div><small>{tx(locale, { en: 'Amount', es: 'Importe', it: 'Importo', ar: 'المبلغ' })}</small><strong>{formatPrice(doc.amountCents / 100, 'USD', locale)}</strong></div>
              <div className="full"><small>{tx(locale, { en: 'PDF', es: 'PDF', it: 'PDF', ar: 'PDF' })}</small><strong><a className="account-icon-action" href={pdfUrlFor(doc.id)}><Download size={17} />{tx(locale, { en: 'Download PDF', es: 'Descargar PDF', it: 'Scarica PDF', ar: 'تنزيل PDF' })}</a></strong></div>
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function BookingDetailSection({ reference, autoPrint = false }: { reference: string; autoPrint?: boolean }) {
  const { locale, currency } = useLocale()

  const impersonated = useImpersonated()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiBookingDetail(reference)
      .then((row) => { if (!cancelled) { setBooking(row); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Booking not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  useEffect(() => {
    if (autoPrint && booking) {
      const timer = window.setTimeout(() => window.print(), 700)
      return () => window.clearTimeout(timer)
    }
  }, [autoPrint, booking])

  if (loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading booking…', es: 'Cargando la reserva…', it: 'Caricamento prenotazione…', ar: 'جارٍ تحميل الحجز…' })}</strong></span></div>
  }

  if (!booking) {
    return <EmptyState Icon={ShoppingBag} title={tx(locale, { en: 'Booking not found', es: 'Reserva no encontrada', it: 'Prenotazione non trovata', ar: 'الحجز غير موجود' })} copy={(loadError ? customerErrorText(locale, loadError) : '') || (tx(locale, { en: 'It may have been cancelled or you are viewing a different account.', es: 'Es posible que se haya cancelado o que estés viendo otra cuenta.', it: 'Potrebbe essere stata cancellata o stai visualizzando un altro account.', ar: 'ربما تم إلغاؤه أو أنك تتصفح حسابا مختلفا.' }))} href="/account/bookings" action={tx(locale, { en: 'Back to bookings', es: 'Volver a las reservas', it: 'Torna alle prenotazioni', ar: 'عودة للحجوزات' })} />
  }

  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const linesTotal = booking.lines.reduce((sum, line) => sum + line.total, 0)
  const canCancel = !impersonated && (booking.status === 'pending' || booking.status === 'confirmed')
  // Offline-only payments (Phase 3.1): the legacy online initiation
  // button is gone from customer UI  -  it implied a gateway that does
  // not exist. Customers pay offline (see the instructions below)
  // and optionally submit a reference for staff review. The initiation
  // API and all stored payment history are preserved untouched.
  // Offline proof submission: offered while the booking can still take
  // money and a balance remains. Reference-only  -  never a file, never
  // a payment record.
  const { remaining } = bookingMoney(booking)
  const canSubmitProof = !impersonated && (booking.status === 'pending' || booking.status === 'confirmed') && remaining > 0
  const refreshBooking = () => {
    apiBookingDetail(booking.reference).then((row) => setBooking(row)).catch(() => undefined)
  }
  const createdOn = displayBookingDate(booking, locale)
  const steps = [
    { done: true, label: tx(locale, { en: 'Received', es: 'Recibida', it: 'Ricevuta', ar: 'تم الاستلام' }), date: createdOn },
    { done: booking.status !== 'pending', label: tx(locale, { en: 'Confirmation', es: 'Confirmación', it: 'Conferma', ar: 'التأكيد' }), date: booking.status !== 'pending' ? createdOn : '-' },
    { done: booking.status === 'completed', label: tx(locale, { en: 'Trip completed', es: 'Viaje completado', it: 'Viaggio completado', ar: 'اكتمال الرحلة' }), date: booking.status === 'completed' ? createdOn : '-' },
    ...(booking.status === 'cancelled' ? [{ done: true, label: tx(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' }), date: '-' }] : []),
  ]

  return <>
    <section className="customer-account-block">
      <header><div><span>{booking.reference}</span><h2>{booking.lines[0]?.title || (tx(locale, { en: 'Booking details', es: 'Detalles de la reserva', it: 'Dettagli prenotazione', ar: 'تفاصيل الحجز' }))}</h2></div><span className="customer-booking-flags"><BookingStatus booking={booking} locale={locale} /></span></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Travel date', es: 'Fecha del viaje', it: 'Data del viaggio', ar: 'تاريخ السفر' })}</small><strong>{booking.lines[0]?.date || createdOn}</strong></div>
        <div><small>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</small><strong>{travelers}</strong></div>
        <div><small>{tx(locale, { en: 'Payment method', es: 'Método de pago', it: 'Metodo di pagamento', ar: 'طريقة الدفع' })}</small><strong>{displayPaymentMethod(booking, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Payment status', es: 'Estado del pago', it: 'Stato del pagamento', ar: 'حالة الدفع' })}</small><strong>{displayPaymentStatus(booking, locale)}{booking.paymentSummary?.latestReference ? (<> · <Link href={'/account/payments/detail?ref=' + encodeURIComponent(booking.paymentSummary.latestReference)}>{booking.paymentSummary.latestReference}</Link></>) : ''}</strong></div>
      </div>
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      <div className="customer-detail-actions">
        {canSubmitProof && <a href="#sp-payment-instructions" className="account-icon-action primary"><WalletCards size={17} />{tx(locale, { en: 'How to pay', es: 'Cómo pagar', it: 'Come pagare', ar: 'كيفية الدفع' })}</a>}
        <Link href="/account/messages" className="account-icon-action" onClick={() => saveMessageDraft({ reference: booking.reference, title: booking.lines[0]?.title ?? '' })}><MessageCircle size={17} />{tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })}</Link>
        <button type="button" className="account-icon-action" onClick={() => window.print()}><ReceiptText size={17} />{tx(locale, { en: 'Print booking', es: 'Imprimir la reserva', it: 'Stampa la prenotazione', ar: 'طباعة الحجز' })}</button>
        {canCancel && <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={17} />{tx(locale, { en: 'Request cancellation', es: 'Solicitar cancelación', it: 'Richiedi cancellazione', ar: 'طلب الإلغاء' })}</button>}
      </div>
    </section>

    {!impersonated && (
      <BookingDocumentsSection
        listUrl={`/api/account/bookings/${encodeURIComponent(reference)}/documents`}
        pdfUrlFor={(id) => ownerDocumentPdfUrl(reference, id)}
      />
    )}

    <BookingPaymentPanel booking={booking} />
    <PaymentInstructions layout="section" />
    {canSubmitProof && <PaymentProofForm bookingReference={booking.reference} onSubmitted={refreshBooking} />}

    <section className="customer-account-block">
      <header><div><span>{booking.lines.length} {tx(locale, { en: 'items', es: 'elementos', it: 'voci', ar: 'بنود' })}</span><h2>{tx(locale, { en: 'Trip details', es: 'Detalles del viaje', it: 'Dettagli del viaggio', ar: 'تفاصيل الرحلات' })}</h2></div></header>
      {booking.lines.map((line) => (
        <article key={line.key} className="customer-booking-row">
          <Link href={line.tourSlug ? `/egypt-tours/${line.tourSlug}` : '/trips'}><img src={line.image || '/egypt-hero.png'} alt="" /></Link>
          <div className="customer-booking-copy">
            <div className="customer-booking-top"><span>{line.date || (tx(locale, { en: 'Flexible date', es: 'Fecha flexible', it: 'Data flessibile', ar: 'موعد مرن' }))}</span></div>
            <h3>{line.tourSlug ? <Link href={`/egypt-tours/${line.tourSlug}`}>{line.title}</Link> : line.title}</h3>
            <div className="customer-booking-meta">
              <span><Users size={14} />{line.adults} {tx(locale, { en: 'adults', es: 'adultos', it: 'adulti', ar: 'بالغين' })}</span>
              {line.children > 0 && <span>{line.children} {tx(locale, { en: 'children', es: 'niños', it: 'bambini', ar: 'أطفال' })}</span>}
              {line.infants > 0 && <span>{line.infants} {tx(locale, { en: 'infants', es: 'bebés', it: 'neonati', ar: 'رضع' })}</span>}
            </div>
            <div className="customer-booking-meta"><span>{tx(locale, { en: 'Adult', es: 'Adulto', it: 'Adulto', ar: 'البالغ' })}: {formatCurrency(line.adultUnit, booking.currency, locale)}</span>{line.children > 0 && <span>{tx(locale, { en: 'Child', es: 'Niño', it: 'Bambino', ar: 'الطفل' })}: {formatCurrency(line.childUnit, booking.currency, locale)}</span>}</div>
            {line.addons.length > 0 && <div className="customer-booking-meta"><span><Plus size={14} />{line.addons.join(' · ')}</span></div>}
          </div>
          <div className="customer-booking-total"><small>{tx(locale, { en: 'Line total', es: 'Total de la línea', it: 'Totale voce', ar: 'إجمالي البند' })}</small><strong>{formatCurrency(line.total, booking.currency, locale)}</strong></div>
        </article>
      ))}
      <div className="customer-payment-total-row"><span>{tx(locale, { en: 'Lines total', es: 'Total de líneas', it: 'Totale voci', ar: 'إجمالي البنود' })}</span><strong>{formatCurrency(linesTotal, booking.currency, locale)}</strong></div>
      {booking.discount > 0 && <div className="customer-payment-total-row discount"><span>{tx(locale, { en: 'Deal savings', es: 'Ahorro por oferta', it: 'Risparmio offerta', ar: 'توفير العروض' })}</span><strong>−{formatCurrency(booking.discount, booking.currency, locale)}</strong></div>}
      <div className="customer-payment-total-row grand"><span>{tx(locale, { en: 'Grand total', es: 'Total general', it: 'Totale generale', ar: 'الإجمالي' })}</span><strong>{formatCurrency(booking.total, booking.currency, locale)}</strong></div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Contact', es: 'Contacto', it: 'Contatto', ar: 'التواصل' })}</span><h2>{tx(locale, { en: 'Traveler details', es: 'Datos del viajero', it: 'Dati del viaggiatore', ar: 'بيانات المسافر' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' })}</small><strong>{booking.contact.name}</strong></div>
        <div><small>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد' })}</small><strong>{booking.contact.email || '-'}</strong></div>
        <div><small>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'الهاتف' })}</small><strong>{booking.contact.phone || '-'}</strong></div>
        {booking.notes ? <div><small>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</small><strong>{booking.notes}</strong></div> : null}
      </div>
    </section>

    {booking.activity.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Booking activity', es: 'Actividad de la reserva', it: 'Attività prenotazione', ar: 'سجل الحجز' })}>
        <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الحجز' })}</h3>
        <ul>{booking.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</span><strong>{bookingActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
      </section>
    )}

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Tracking', es: 'Seguimiento', it: 'Monitoraggio', ar: 'التتبع' })}</span><h2>{tx(locale, { en: 'Booking timeline', es: 'Cronología de la reserva', it: 'Cronologia prenotazione', ar: 'مراحل الحجز' })}</h2></div></header>
      <ol className="customer-timeline">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : ''}><span /><div><strong>{step.label}</strong><small>{step.date}</small></div></li>
        ))}
      </ol>
    </section>
    <CustomerConfirmDialog
      open={cancelling}
      onClose={() => setCancelling(false)}
      onConfirm={() => {
        setCancelling(false)
        setActionError('')
        apiBookingCancel(booking.reference)
          .then((saved) => setBooking(saved))
          .catch((err: unknown) => {
            const code = (err as { code?: unknown } | null)?.code
            setActionError(code === 'BOOKING_FINANCIAL_REVIEW'
              ? financialReviewMessage(locale)
              : (customerErrorText(locale, err instanceof Error ? err.message : null, tx(locale, { en: 'Could not cancel the booking.', es: 'No se pudo cancelar la reserva.', it: 'Impossibile cancellare la prenotazione.', ar: 'تعذر إلغاء الحجز.' }))))
          })
      }}
      title={tx(locale, { en: 'Cancel this booking?', es: '¿Cancelar esta reserva?', it: 'Cancellare questa prenotazione?', ar: 'إلغاء هذا الحجز؟' })}
      copy={tx(locale, { en: 'This booking will remain in your history with a Cancelled status.', es: 'Esta reserva quedará en tu historial como cancelada.', it: 'Questa prenotazione resterà nella cronologia come cancellata.', ar: 'سيبقى هذا الحجز في سجلك بحالة ملغي.' })}
      confirmLabel={tx(locale, { en: 'Cancel booking', es: 'Cancelar la reserva', it: 'Cancella prenotazione', ar: 'إلغاء الحجز' })}
      cancelLabel={tx(locale, { en: 'Keep booking', es: 'Mantener la reserva', it: 'Mantieni prenotazione', ar: 'أبقِ الحجز' })}
    />
    {/* Print-only professional booking document (same DB-backed view). */}
    <div className="booking-print-area" aria-hidden="true"><BookingPrintDocument booking={booking} /></div>
  </>
}

function GuestBookingSection({ token, autoPrint = false }: { token: string; autoPrint?: boolean }) {
  const { locale, currency } = useLocale()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiGuestBooking(token)
      .then((row) => { if (!cancelled) { setBooking(row); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'This booking link is not valid.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (autoPrint && booking) {
      const timer = window.setTimeout(() => window.print(), 700)
      return () => window.clearTimeout(timer)
    }
  }, [autoPrint, booking])

  if (loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading booking…', es: 'Cargando la reserva…', it: 'Caricamento prenotazione…', ar: 'جارٍ تحميل الحجز…' })}</strong></span></div>
  }

  if (!booking) {
    // One honest message for every failure: a wrong, expired or revoked
    // link must be indistinguishable from one another.
    return <section className="customer-account-block customer-full-block">
      <div className="customer-empty">
        <h2>{tx(locale, { en: 'This booking link is not valid', es: 'Este enlace de reserva no es válido', it: 'Questo link di prenotazione non è valido', ar: 'رابط الحجز غير صالح' })}</h2>
        <p>{(loadError ? customerErrorText(locale, loadError) : '') || tx(locale, { en: 'The link may have expired or already been replaced by a newer one. Use the most recent link from your confirmation email, or contact our team with your reference.', es: 'El enlace puede haber caducado o haber sido sustituido por uno más reciente. Usa el enlace más reciente de tu correo de confirmación o contacta con nuestro equipo indicando tu referencia.', it: 'Il link potrebbe essere scaduto o essere stato sostituito da uno più recente. Usa il link più recente della tua email di conferma o contatta il nostro team con il tuo riferimento.', ar: 'ربما انتهت صلاحية الرابط أو تم استبداله بأحدث. استخدم أحدث رابط من رسالة التأكيد أو تواصل معنا مع ذكر المرجع.' })}</p>
        <Link href="/trips">{tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })} <ArrowRight size={16} /></Link>
      </div>
    </section>
  }

  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const linesTotal = booking.lines.reduce((sum, line) => sum + line.total, 0)
  const createdOn = displayBookingDate(booking, locale)
  // Offline proof submission (Phase 3): token-authorized, reference-only
  //  -  the token never gains cancel/pay powers; this appends one
  // harmless activity row for staff review, never money.
  const { remaining } = bookingMoney(booking)
  const canSubmitProof = (booking.status === 'pending' || booking.status === 'confirmed') && remaining > 0
  const refreshBooking = () => {
    apiGuestBooking(token).then((row) => setBooking(row)).catch(() => undefined)
  }
  const steps = [
    { done: true, label: tx(locale, { en: 'Received', es: 'Recibida', it: 'Ricevuta', ar: 'تم الاستلام' }), date: createdOn },
    { done: booking.status !== 'pending', label: tx(locale, { en: 'Confirmation', es: 'Confirmación', it: 'Conferma', ar: 'التأكيد' }), date: booking.status !== 'pending' ? createdOn : '-' },
    { done: booking.status === 'completed', label: tx(locale, { en: 'Trip completed', es: 'Viaje completado', it: 'Viaggio completado', ar: 'اكتمال الرحلة' }), date: booking.status === 'completed' ? createdOn : '-' },
    ...(booking.status === 'cancelled' ? [{ done: true, label: tx(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Cancellata', ar: 'ملغي' }), date: '-' }] : []),
  ]

  return <>
    <section className="customer-account-block">
      <header><div><span>{booking.reference}</span><h2>{booking.lines[0]?.title || (tx(locale, { en: 'Booking details', es: 'Detalles de la reserva', it: 'Dettagli prenotazione', ar: 'تفاصيل الحجز' }))}</h2></div><span className="customer-booking-flags"><BookingStatus booking={booking} locale={locale} /></span></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Travel date', es: 'Fecha del viaje', it: 'Data del viaggio', ar: 'تاريخ السفر' })}</small><strong>{booking.lines[0]?.date || createdOn}</strong></div>
        <div><small>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</small><strong>{travelers}</strong></div>
        <div><small>{tx(locale, { en: 'Payment method', es: 'Método de pago', it: 'Metodo di pagamento', ar: 'طريقة الدفع' })}</small><strong>{displayPaymentMethod(booking, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Payment status', es: 'Estado del pago', it: 'Stato del pagamento', ar: 'حالة الدفع' })}</small><strong>{displayPaymentStatus(booking, locale)}</strong></div>
      </div>
      <div className="customer-detail-actions">
        <button type="button" className="account-icon-action" onClick={() => window.print()}><ReceiptText size={17} />{tx(locale, { en: 'Print booking', es: 'Imprimir la reserva', it: 'Stampa la prenotazione', ar: 'طباعة الحجز' })}</button>
        <Link href="/contact" className="account-icon-action"><MessageCircle size={17} />{tx(locale, { en: 'Contact our team', es: 'Contacta con nuestro equipo', it: 'Contatta il nostro team', ar: 'تواصل مع فريقنا' })}</Link>
      </div>
    </section>

    <BookingDocumentsSection
      listUrl={`/api/bookings/access/${encodeURIComponent(token)}/documents`}
      pdfUrlFor={(id) => guestDocumentPdfUrl(token, id)}
      omitCredentials
    />

    <BookingPaymentPanel booking={booking} />
    <PaymentInstructions layout="section" />
    {canSubmitProof && <PaymentProofForm bookingReference={booking.reference} guestToken={token} onSubmitted={refreshBooking} />}

    <section className="customer-account-block">
      <header><div><span>{booking.lines.length} {tx(locale, { en: 'items', es: 'elementos', it: 'voci', ar: 'بنود' })}</span><h2>{tx(locale, { en: 'Trip details', es: 'Detalles del viaje', it: 'Dettagli del viaggio', ar: 'تفاصيل الرحلات' })}</h2></div></header>
      {booking.lines.map((line) => (
        <article key={line.key} className="customer-booking-row">
          <Link href={line.tourSlug ? `/egypt-tours/${line.tourSlug}` : '/trips'}><img src={line.image || '/egypt-hero.png'} alt="" /></Link>
          <div className="customer-booking-copy">
            <div className="customer-booking-top"><span>{line.date || (tx(locale, { en: 'Flexible date', es: 'Fecha flexible', it: 'Data flessibile', ar: 'موعد مرن' }))}</span></div>
            <h3>{line.tourSlug ? <Link href={`/egypt-tours/${line.tourSlug}`}>{line.title}</Link> : line.title}</h3>
            <div className="customer-booking-meta">
              <span><Users size={14} />{line.adults} {tx(locale, { en: 'adults', es: 'adultos', it: 'adulti', ar: 'بالغين' })}</span>
              {line.children > 0 && <span>{line.children} {tx(locale, { en: 'children', es: 'niños', it: 'bambini', ar: 'أطفال' })}</span>}
              {line.infants > 0 && <span>{line.infants} {tx(locale, { en: 'infants', es: 'bebés', it: 'neonati', ar: 'رضع' })}</span>}
            </div>
            <div className="customer-booking-meta"><span>{tx(locale, { en: 'Adult', es: 'Adulto', it: 'Adulto', ar: 'البالغ' })}: {formatCurrency(line.adultUnit, booking.currency, locale)}</span>{line.children > 0 && <span>{tx(locale, { en: 'Child', es: 'Niño', it: 'Bambino', ar: 'الطفل' })}: {formatCurrency(line.childUnit, booking.currency, locale)}</span>}</div>
            {line.addons.length > 0 && <div className="customer-booking-meta"><span><Plus size={14} />{line.addons.join(' · ')}</span></div>}
          </div>
          <div className="customer-booking-total"><small>{tx(locale, { en: 'Line total', es: 'Total de la línea', it: 'Totale voce', ar: 'إجمالي البند' })}</small><strong>{formatCurrency(line.total, booking.currency, locale)}</strong></div>
        </article>
      ))}
      <div className="customer-payment-total-row"><span>{tx(locale, { en: 'Lines total', es: 'Total de líneas', it: 'Totale voci', ar: 'إجمالي البنود' })}</span><strong>{formatCurrency(linesTotal, booking.currency, locale)}</strong></div>
      {booking.discount > 0 && <div className="customer-payment-total-row discount"><span>{tx(locale, { en: 'Deal savings', es: 'Ahorro por oferta', it: 'Risparmio offerta', ar: 'توفير العروض' })}</span><strong>−{formatCurrency(booking.discount, booking.currency, locale)}</strong></div>}
      <div className="customer-payment-total-row grand"><span>{tx(locale, { en: 'Grand total', es: 'Total general', it: 'Totale generale', ar: 'الإجمالي' })}</span><strong>{formatCurrency(booking.total, booking.currency, locale)}</strong></div>
    </section>

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Contact', es: 'Contacto', it: 'Contatto', ar: 'التواصل' })}</span><h2>{tx(locale, { en: 'Traveler details', es: 'Datos del viajero', it: 'Dati del viaggiatore', ar: 'بيانات المسافر' })}</h2></div></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' })}</small><strong>{booking.contact.name}</strong></div>
        <div><small>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد' })}</small><strong>{booking.contact.email || '-'}</strong></div>
        <div><small>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'الهاتف' })}</small><strong>{booking.contact.phone || '-'}</strong></div>
        {booking.notes ? <div><small>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</small><strong>{booking.notes}</strong></div> : null}
      </div>
    </section>

    {booking.activity.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Booking activity', es: 'Actividad de la reserva', it: 'Attività prenotazione', ar: 'سجل الحجز' })}>
        <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'سجل الحجز' })}</h3>
        <ul>{booking.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</span><strong>{bookingActivityLabel(a.action, locale)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
      </section>
    )}

    <section className="customer-account-block">
      <header><div><span>{tx(locale, { en: 'Tracking', es: 'Seguimiento', it: 'Monitoraggio', ar: 'التتبع' })}</span><h2>{tx(locale, { en: 'Booking timeline', es: 'Cronología de la reserva', it: 'Cronologia prenotazione', ar: 'مراحل الحجز' })}</h2></div></header>
      <ol className="customer-timeline">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? 'done' : ''}><span /><div><strong>{step.label}</strong><small>{step.date}</small></div></li>
        ))}
      </ol>
    </section>
    {/* Print-only professional booking document (same DB-backed view). */}
    <div className="booking-print-area" aria-hidden="true"><BookingPrintDocument booking={booking} /></div>
  </>
}

function BookingTableRow({ booking, index }: { booking: Booking; index: number }) {
  const { locale, currency } = useLocale()

  const first = booking.lines[0]
  const travelers = booking.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)
  const detailHref = '/account/bookings/detail?ref=' + encodeURIComponent(booking.reference)
  return <tr>
    <td className="customer-row-number">{index}</td>
    <td><span className="customer-trip-cell"><Link href={detailHref}><img src={first?.image || '/egypt-hero.png'} alt="" /></Link><span><strong><Link href={detailHref}>{first?.title || (tx(locale, { en: 'Custom journey', es: 'Viaje personalizado', it: 'Viaggio personalizzato', ar: 'رحلة مخصصة' }))}</Link></strong><small>{booking.reference} · {booking.lines.length} {tx(locale, { en: 'items', es: 'elementos', it: 'voci', ar: 'بنود' })}</small></span></span></td>
    <td>{displayBookingDate(booking, locale)}</td>
    <td>{travelers}</td>
    <td><strong>{formatCurrency(booking.total, booking.currency, locale)}</strong></td>
    <td><BookingStatus booking={booking} locale={locale} /></td>
    <td><span className="customer-table-actions"><Link href={detailHref} aria-label={tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })} title={tx(locale, { en: 'View details', es: 'Ver detalles', it: 'Vedi dettagli', ar: 'عرض التفاصيل' })}><Eye size={16} /></Link><Link href="/account/messages" onClick={() => saveMessageDraft({ reference: booking.reference, title: first?.title ?? '' })} aria-label={tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })} title={tx(locale, { en: 'Ask about booking', es: 'Preguntar por la reserva', it: 'Chiedi info sulla prenotazione', ar: 'اسأل عن الحجز' })}><MessageCircle size={16} /></Link></span></td>
  </tr>
}

/**
 * Customer bookings (Phase 2E). Database-backed records owned by the
 * signed-in customer, loaded from `/api/account/bookings`. Staff-only
 * notes never reach this UI  -  the customer serializer excludes them.
 */
function BookingsSection() {
  const { locale } = useLocale()

  const { bookings: mine, loading, error } = useCustomerBookings()
  const bookings = mine
  const [filter, setFilter] = useState<'all' | BookingStatus>('all')
  const visible = filter === 'all' ? bookings : bookings.filter((booking) => booking.status === filter)
  const paging = usePagination(visible)
  if (loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{tx(locale, { en: 'Loading your bookings…', es: 'Cargando tus reservas…', it: 'Caricamento prenotazioni…', ar: 'جارٍ تحميل حجوزاتك…' })}</h3></div></section>
  }
  if (error && !bookings.length) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty"><h3>{tx(locale, { en: 'Could not load bookings', es: 'No se pudieron cargar las reservas', it: 'Impossibile caricare le prenotazioni', ar: 'تعذر تحميل الحجوزات' })}</h3><p>{customerErrorText(locale, error)}</p></div></section>
  }
  return <section className="customer-account-block customer-full-block"><div className="customer-filterbar"><div role="tablist" aria-label={tx(locale, { en: 'Filter bookings', es: 'Filtrar reservas', it: 'Filtra prenotazioni', ar: 'فلترة الحجوزات' })}>{(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (tx(locale, { en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' })) : tx(locale, bookingStatusCopy[status])}</button>)}</div><Link href="/trips"><Plus size={16} />{tx(locale, { en: 'Book a trip', es: 'Reservar un viaje', it: 'Prenota un viaggio', ar: 'حجز رحلة' })}</Link></div>{visible.length ? <><div className="customer-table-wrap"><table className="customer-table"><thead><tr><th>#</th><th>{tx(locale, { en: 'Trip', es: 'Viaje', it: 'Viaggio', ar: 'الرحلة' })}</th><th>{tx(locale, { en: 'Date', es: 'Fecha', it: 'Data', ar: 'التاريخ' })}</th><th>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</th><th>{tx(locale, { en: 'Total', es: 'Total', it: 'Totale', ar: 'الإجمالي' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th></th></tr></thead><tbody>{paging.pageRows.map((booking, index) => <BookingTableRow key={booking.reference} booking={booking} index={paging.from + index} />)}</tbody></table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ShoppingBag} title={tx(locale, { en: 'No bookings in this view', es: 'Sin reservas en esta vista', it: 'Nessuna prenotazione in questa vista', ar: 'لا توجد حجوزات في هذه الحالة' })} copy={tx(locale, { en: 'Bookings linked to your account appear here. For a guest booking, verify the link in your booking email first.', es: 'Aquí aparecen las reservas vinculadas a tu cuenta. Si reservaste como invitado, verifica primero el enlace del correo de tu reserva.', it: 'Qui compaiono le prenotazioni collegate al tuo account. Per una prenotazione come ospite, verifica prima il link nell’email della prenotazione.', ar: 'أي حجز تنشئه من صفحة الدفع سيظهر هنا تلقائيًا.' })} href="/trips" action={tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })} />}</section>
}

export { BookingCard, BookingDetailSection, GuestBookingSection, BookingsSection }
