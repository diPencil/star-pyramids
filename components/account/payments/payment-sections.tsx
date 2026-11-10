'use client'

import { formatCurrency } from "@/lib/payments/currency";
// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Eye, Plus, ReceiptText, ShieldCheck } from "lucide-react";
import { tx, useLocale } from "@/components/locale";
import { paymentActivityLabel, paymentStatusLabel, type Payment } from "@/lib/payments/payment";
import { usePagination } from "@/components/admin/admin-pagination";
import { customerErrorText } from "@/lib/account/customer-error-copy";
import { Metric, EmptyState, CustomerPagination } from "../shared/account-ui"


async function apiPaymentList(): Promise<Payment[]> {
  const res = await fetch('/api/account/payments', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your payments.')
  const data = (await res.json()) as { payments?: Payment[] }
  if (!Array.isArray(data.payments)) throw new Error('Could not load your payments.')
  return data.payments
}

/**
 * Customer payments (Phase 3.1: offline only). Real database-backed
 * payment records from `/api/account/payments`  -  never booking-derived
 * previews. Only verified money appears here: pending rows are legacy
 * online-intent placeholders, never charges. Customers pay offline via
 * their booking's payment instructions; this screen never initiates.
 */
function PaymentsSection() {
  const { locale, currency } = useLocale()

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | Payment['status']>('all')
  useEffect(() => {
    let cancelled = false
    apiPaymentList()
      .then((rows) => { if (!cancelled) { setPayments(rows); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load your payments.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])
  const visible = filter === 'all' ? payments : payments.filter((payment) => payment.status === filter)
  // "Collected" should only count net paid money (paid - refunded).
  // REFUNDED and PARTIALLY_REFUNDED payments are settled money that was returned.
  const paymentTotals = (rows: Payment[], amountOf: (payment: Payment) => number) => {
    const totals = new Map<string, number>()
    for (const payment of rows) totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + amountOf(payment))
    return [...totals].map(([code, amount]) => formatCurrency(amount, code, locale)).join(' · ') || formatCurrency(0, 'USD', locale)
  }
  const collected = paymentTotals(payments.filter((payment) => payment.status === 'paid' || payment.status === 'partially_refunded' || payment.status === 'refunded'), (payment) => payment.amountPaid - payment.amountRefunded)
  const awaiting = paymentTotals(payments.filter((payment) => payment.status === 'pending' || payment.status === 'processing'), (payment) => payment.amount)
  const paging = usePagination(visible)
  return <><div className="customer-payment-summary"><Metric Icon={CheckCircle2} value={collected} label={tx(locale, { en: 'Paid', es: 'Pagado', it: 'Pagato', ar: 'تم دفعه' })} note={tx(locale, { en: 'Confirmed payments', es: 'Pagos confirmados', it: 'Pagamenti confermati', ar: 'مدفوعات مؤكدة' })} tone="green" /><Metric Icon={Clock3} value={awaiting} label={tx(locale, { en: 'Unpaid', es: 'Sin pagar', it: 'Non pagato', ar: 'غير مدفوع' })} note={tx(locale, { en: 'No charge is made online', es: 'No se realiza ningún cargo en línea', it: 'Nessun addebito online', ar: 'لا يتم الخصم عبر الإنترنت' })} tone="orange" /><Metric Icon={ReceiptText} value={payments.length} label={tx(locale, { en: 'Records', es: 'Registros', it: 'Registrazioni', ar: 'السجلات' })} note={tx(locale, { en: 'Real payment attempts', es: 'Intentos de pago reales', it: 'Tentativi di pagamento reali', ar: 'محاولات دفع حقيقية' })} tone="blue" /></div><section className="customer-account-block customer-full-block"><header><div><span>{tx(locale, { en: 'Payment history', es: 'Historial de pagos', it: 'Cronologia pagamenti', ar: 'السجل المالي' })}</span><h2>{tx(locale, { en: 'Payments and payment status', es: 'Pagos y estado de pagos', it: 'Pagamenti e stato pagamenti', ar: 'المدفوعات وحالتها' })}</h2></div><ShieldCheck size={20} /></header><div className="customer-filterbar"><div role="tablist" aria-label={tx(locale, { en: 'Filter payments', es: 'Filtrar pagos', it: 'Filtra pagamenti', ar: 'فلترة المدفوعات' })}>{(['all', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'] as const).map((status) => <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? (tx(locale, { en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' })) : paymentStatusLabel(status, locale)}</button>)}</div><Link href="/trips"><Plus size={16} />{tx(locale, { en: 'Book a trip', es: 'Reservar un viaje', it: 'Prenota un viaggio', ar: 'احجز رحلة' })}</Link></div>{loading ? <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading payments…', es: 'Cargando los pagos…', it: 'Caricamento pagamenti…', ar: 'جارٍ تحميل المدفوعات…' })}</strong></span></div>
      : loadError && !payments.length ? <EmptyState Icon={ReceiptText} title={tx(locale, { en: 'Could not load payments', es: 'No se pudieron cargar los pagos', it: 'Impossibile caricare i pagamenti', ar: 'تعذر تحميل المدفوعات' })} copy={customerErrorText(locale, loadError)} href="/account/bookings" action={tx(locale, { en: 'Back to bookings', es: 'Volver a las reservas', it: 'Torna alle prenotazioni', ar: 'عودة للحجوزات' })} />
      : visible.length ? <><div className="customer-table-wrap"><table className="customer-table">
        <thead><tr><th>#</th><th>{tx(locale, { en: 'Reference', es: 'Referencia', it: 'Riferimento', ar: 'المرجع' })}</th><th>{tx(locale, { en: 'Booking', es: 'Reserva', it: 'Prenotazione', ar: 'الحجز' })}</th><th>{tx(locale, { en: 'Initiated', es: 'Iniciado', it: 'Avviato', ar: 'تاريخ الإنشاء' })}</th><th>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}</th><th>{tx(locale, { en: 'Amount', es: 'Importe', it: 'Importo', ar: 'المبلغ' })}</th><th></th></tr></thead>
        <tbody>{paging.pageRows.map((payment, index) => (
          <tr key={payment.reference}>
            <td className="customer-row-number">{paging.from + index}</td>
            <td><strong>{payment.reference}</strong></td>
            <td><Link href={'/account/bookings/detail?ref=' + encodeURIComponent(payment.bookingReference)}>{payment.bookingReference}</Link></td>
            <td>{new Date(payment.initiatedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB')}</td>
            <td><span className={`customer-payment-state ${payment.status}`}>{paymentStatusLabel(payment.status, locale)}</span></td>
            <td><strong>{formatCurrency(payment.amount, payment.currency, locale)}</strong></td>
            <td><span className="customer-table-actions">
              <Link href={'/account/payments/detail?ref=' + encodeURIComponent(payment.reference)} aria-label={tx(locale, { en: 'View payment', es: 'Ver el pago', it: 'Vedi pagamento', ar: 'عرض الدفع' })} title={tx(locale, { en: 'View payment', es: 'Ver el pago', it: 'Vedi pagamento', ar: 'عرض الدفع' })}><Eye size={16} /></Link>
            </span></td>
          </tr>
        ))}</tbody>
      </table></div><CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} /></> : <EmptyState Icon={ReceiptText} title={payments.length ? (tx(locale, { en: 'No records in this view', es: 'Sin registros en esta vista', it: 'Nessuna registrazione in questa vista', ar: 'لا توجد سجلات في هذه الحالة' })) : (tx(locale, { en: 'No payment records yet', es: 'Aún no hay registros de pago', it: 'Ancora nessuna registrazione di pagamento', ar: 'لا توجد مدفوعات بعد' }))} copy={payments.length ? (tx(locale, { en: 'Try a different status from the filter above.', es: 'Prueba con otro estado del filtro.', it: 'Prova un altro stato dal filtro qui sopra.', ar: 'جرب حالة مختلفة من الفلتر بالأعلى.' })) : (tx(locale, { en: 'Verified payments appear here. To pay, open your booking and follow the offline payment instructions.', es: 'Los pagos verificados aparecen aquí. Para pagar, abre tu reserva y sigue las instrucciones de pago offline.', it: 'I pagamenti verificati appaiono qui. Per pagare, apri la tua prenotazione e segui le istruzioni di pagamento offline.', ar: 'تظهر المدفوعات المؤكدة هنا. للدفع، افتح حجزك واتبع تعليمات الدفع المباشر.' }))} href="/account/bookings" action={tx(locale, { en: 'View my bookings', es: 'Ver mis reservas', it: 'Vedi le mie prenotazioni', ar: 'عرض حجوزاتي' })} />}</section></>
}

async function apiPaymentDetail(reference: string): Promise<Payment> {
  const res = await fetch(`/api/account/payments/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as Payment & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Payment not found.')
  return data
}

/**
 * Customer payment detail (Phase 2F-A). Database-backed record owned
 * by the signed-in customer, fetched from `/api/account/payments/*`.
 * Shows the real payment lifecycle state honestly: a pending payment
 * means nothing has been charged and no provider is connected yet.
 * Internal payment events never reach this UI  -  the customer
 * serializer excludes them.
 */
function PaymentDetailSection({ reference }: { reference: string }) {
  const { locale, currency } = useLocale()

  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiPaymentDetail(reference)
      .then((row) => { if (!cancelled) { setPayment(row); setLoading(false) } })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Payment not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading payment…', es: 'Cargando el pago…', it: 'Caricamento pagamento…', ar: 'جارٍ تحميل الدفع…' })}</strong></span></div>
  }

  if (!payment) {
    return <EmptyState Icon={ReceiptText} title={tx(locale, { en: 'Payment not found', es: 'Pago no encontrado', it: 'Pagamento non trovato', ar: 'الدفع غير موجود' })} copy={(loadError ? customerErrorText(locale, loadError) : '') || (tx(locale, { en: 'It may belong to a different account.', es: 'Es posible que pertenezca a otra cuenta.', it: 'Potrebbe appartenere a un altro account.', ar: 'ربما يتبع حسابًا مختلفًا.' }))} href="/account/payments" action={tx(locale, { en: 'Back to payments', es: 'Volver a los pagos', it: 'Torna ai pagamenti', ar: 'عودة للمدفوعات' })} />
  }

  const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US') : '-')
  const isPending = payment.status === 'pending' || payment.status === 'processing'

  return <>
    <section className="customer-account-block">
      <header><div><span>{payment.reference}</span><h2>{tx(locale, { en: 'Payment details', es: 'Detalles del pago', it: 'Dettagli pagamento', ar: 'تفاصيل الدفع' })}</h2></div><span className={`customer-payment-state ${payment.status}`}>{paymentStatusLabel(payment.status, locale)}</span></header>
      <div className="customer-detail-grid">
        <div><small>{tx(locale, { en: 'Amount due', es: 'Importe adeudado', it: 'Importo dovuto', ar: 'المبلغ المستحق' })}</small><strong>{formatCurrency(payment.amount, payment.currency, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Amount paid', es: 'Importe pagado', it: 'Importo pagato', ar: 'المدفوع' })}</small><strong>{formatCurrency(payment.amountPaid, payment.currency, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Payment status', es: 'Estado del pago', it: 'Stato del pagamento', ar: 'حالة الدفع' })}</small><strong>{paymentStatusLabel(payment.status, locale)}</strong></div>
        <div><small>{tx(locale, { en: 'Related booking', es: 'Reserva relacionada', it: 'Prenotazione collegata', ar: 'الحجز المرتبط' })}</small><strong><Link href={'/account/bookings/detail?ref=' + encodeURIComponent(payment.bookingReference)}>{payment.bookingReference}</Link></strong></div>
        <div><small>{tx(locale, { en: 'Initiated', es: 'Iniciado', it: 'Avviato', ar: 'تاريخ الإنشاء' })}</small><strong>{fmtDateTime(payment.initiatedAt)}</strong></div>
        {payment.amountRefunded > 0 && <div><small>{tx(locale, { en: 'Amount refunded', es: 'Importe reembolsado', it: 'Importo rimborsato', ar: 'المسترد' })}</small><strong>{formatCurrency(payment.amountRefunded, payment.currency, locale)}</strong></div>}
        {payment.paidAt && <div><small>{tx(locale, { en: 'Paid on', es: 'Pagado el', it: 'Pagato il', ar: 'تاريخ الدفع' })}</small><strong>{fmtDateTime(payment.paidAt)}</strong></div>}
        {payment.failedAt && <div><small>{tx(locale, { en: 'Failed on', es: 'Fallido el', it: 'Fallito il', ar: 'تاريخ الفشل' })}</small><strong>{fmtDateTime(payment.failedAt)}</strong></div>}
        {payment.cancelledAt && <div><small>{tx(locale, { en: 'Cancelled on', es: 'Cancelado el', it: 'Annullato il', ar: 'تاريخ الإلغاء' })}</small><strong>{fmtDateTime(payment.cancelledAt)}</strong></div>}
        {payment.refundedAt && <div><small>{tx(locale, { en: 'Refunded on', es: 'Reembolsado el', it: 'Rimborsato il', ar: 'تاريخ الاسترداد' })}</small><strong>{fmtDateTime(payment.refundedAt)}</strong></div>}
        <div><small>{tx(locale, { en: 'Payment provider', es: 'Proveedor de pago', it: 'Fornitore di pagamento', ar: 'مزود الدفع' })}</small><strong>{payment.provider === 'offline' ? (tx(locale, { en: 'Offline (bank transfer or cash)', es: 'Offline (transferencia o efectivo)', it: 'Offline (bonifico o contanti)', ar: 'مباشر (تحويل بنكي أو نقدي)' })) : payment.provider === 'pending' ? (tx(locale, { en: 'No payment made yet', es: 'Aún no se ha realizado ningún pago', it: 'Nessun pagamento ancora effettuato', ar: 'لم يتم أي دفع بعد' })) : payment.provider}{payment.providerPaymentId ? ` · ${payment.providerPaymentId}` : ''}</strong></div>
      </div>
      {isPending && <p role="status" className="form-note">{tx(locale, { en: `This record is pending: ${formatCurrency(payment.amount, payment.currency, locale)} is awaiting offline payment. Nothing has been charged online  -  pay by bank transfer or cash following your booking's payment instructions.`, es: `Este registro está pendiente: ${formatCurrency(payment.amount, payment.currency, locale)} aguarda el pago offline. No se ha cobrado nada en línea: paga por transferencia o en efectivo siguiendo las instrucciones de pago de tu reserva.`, it: `Questa registrazione è in sospeso: ${formatCurrency(payment.amount, payment.currency, locale)} è in attesa del pagamento offline. Nessun addebito online: paga con bonifico o contanti seguendo le istruzioni di pagamento della prenotazione.`, ar: `هذا السجل معلق: مبلغ ${formatCurrency(payment.amount, payment.currency, locale)} بانتظار الدفع المباشر. لم يتم خصم أي مبلغ عبر الإنترنت  -  ادفع بتحويل بنكي أو نقدًا وفق تعليمات الدفع في حجزك.` })}</p>}
      <div className="customer-detail-actions">
        <Link href={'/account/bookings/detail?ref=' + encodeURIComponent(payment.bookingReference)} className="account-icon-action"><Eye size={16} />{tx(locale, { en: 'View related booking', es: 'Ver la reserva relacionada', it: 'Vedi la prenotazione collegata', ar: 'عرض الحجز المرتبط' })}</Link>
        <Link href="/account/payments" className="account-icon-action"><ArrowLeft size={16} />{tx(locale, { en: 'Back to payments', es: 'Volver a los pagos', it: 'Torna ai pagamenti', ar: 'عودة للمدفوعات' })}</Link>
      </div>
    </section>

    {payment.events.length > 0 && (
      <section className="customer-activity" aria-label={tx(locale, { en: 'Payment activity', es: 'Actividad del pago', it: 'Attività pagamento', ar: 'سجل الدفع' })}>
        <h3>{tx(locale, { en: 'Activity', es: 'Actividad', it: 'Attività', ar: 'السجل' })}</h3>
        <ul>{payment.events.map((e, i) => <li key={`${e.at}-${i}`}><span>{new Date(e.at).toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US')}</span><strong>{paymentActivityLabel(e.action, locale)}</strong>{e.note && <small>{e.note}</small>}</li>)}</ul>
      </section>
    )}
  </>
}

export { PaymentsSection, PaymentDetailSection }
