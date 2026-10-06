'use client'

import { formatPrice, tx, useLocale } from './locale'
import type { Booking } from '@/lib/booking'

/**
 * Professional print-only booking document (Phase 2E micro-fix).
 *
 * Rendered from the SAME database-backed `Booking` view as the screen
 * detail — no duplicate data, no recalculation, no internal activity.
 * Visible ONLY in print (`booking-print-area` is `display:none` on
 * screen; `@media print` rules in `app/account/account.css` hide all
 * account chrome and screen sections).
 *
 * Honest title semantics:
 * - PENDING (any payment state)            → "Booking Request"
 * - CONFIRMED/COMPLETED but UNPAID         → "Booking Confirmation"
 * - PAID (future payment phase only)       → "Payment Receipt"
 * "Receipt" is never used for an unpaid booking.
 */
export function BookingPrintDocument({ booking }: { booking: Booking }) {
  const { locale } = useLocale()

  const paid = booking.paymentStatus === 'paid'
  const confirmed = booking.status === 'confirmed' || booking.status === 'completed'
  const title = paid
    ? tx(locale, { en: 'Payment Receipt', es: 'Recibo de pago', it: 'Ricevuta di pagamento', ar: 'إيصال دفع' })
    : confirmed
      ? tx(locale, { en: 'Booking Confirmation', es: 'Confirmación de reserva', it: 'Conferma della prenotazione', ar: 'تأكيد الحجز' })
      : tx(locale, { en: 'Booking Request', es: 'Solicitud de reserva', it: 'Richiesta di prenotazione', ar: 'طلب حجز' })

  const statusLabel = booking.status === 'pending'
    ? tx(locale, { en: 'Request received', es: 'Solicitud recibida', it: 'Richiesta ricevuta', ar: 'تم استلام الطلب' })
    : booking.status === 'confirmed'
      ? tx(locale, { en: 'Confirmed', es: 'Confirmada', it: 'Confermata', ar: 'مؤكد' })
      : booking.status === 'completed'
        ? tx(locale, { en: 'Completed', es: 'Completada', it: 'Completata', ar: 'مكتمل' })
        : tx(locale, { en: 'Cancelled', es: 'Cancelada', it: 'Annullata', ar: 'ملغي' })
  const paymentLabel = paid
    ? tx(locale, { en: 'Paid', es: 'Pagado', it: 'Pagato', ar: 'مدفوع' })
    : booking.paymentStatus === 'refunded'
      ? tx(locale, { en: 'Refunded', es: 'Reembolsado', it: 'Rimborsato', ar: 'مسترد' })
      : tx(locale, { en: 'Unpaid', es: 'Pendiente de pago', it: 'Non pagato', ar: 'غير مدفوع' })

  const money = (usd: number) => `USD ${formatPrice(usd, 'USD', locale)}`
  const dateLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB'

  return (
    <div className="booking-print-doc" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bpd-head">
        <span className="bpd-brand">
          <img src="/favicon.png" alt="" />
          <span><strong>STAR PYRAMIDS</strong><small>{tx(locale, { en: 'Booking document', es: 'Documento de reserva', it: 'Documento di prenotazione', ar: 'وثيقة حجز' })}</small></span>
        </span>
        <span className="bpd-title">
          <strong>{title}</strong>
          <small dir="ltr">{booking.reference}</small>
        </span>
      </header>

      <section className="bpd-states">
        <div><small>{tx(locale, { en: 'Booking status', es: 'Estado de la reserva', it: 'Stato della prenotazione', ar: 'حالة الحجز' })}</small><strong>{statusLabel}</strong></div>
        <div><small>{tx(locale, { en: 'Payment status', es: 'Estado del pago', it: 'Stato del pagamento', ar: 'حالة الدفع' })}</small><strong>{paymentLabel}</strong></div>
        <div><small>{tx(locale, { en: 'Issued', es: 'Fecha de emisión', it: 'Data di emissione', ar: 'تاريخ الإصدار' })}</small><strong>{new Date(booking.createdAt).toLocaleDateString(dateLocale)}</strong></div>
      </section>

      <section className="bpd-block">
        <h2>{tx(locale, { en: 'Booked trips', es: 'Viajes reservados', it: 'Viaggi prenotati', ar: 'تفاصيل الرحلات' })}</h2>
        {booking.lines.map((line) => (
          <article key={line.key} className="bpd-line">
            <div className="bpd-line-top"><strong>{line.title}</strong><strong dir="ltr">{money(line.total)}</strong></div>
            <dl>
              <div><dt>{tx(locale, { en: 'Travel date', es: 'Fecha del viaje', it: 'Data del viaggio', ar: 'التاريخ' })}</dt><dd>{line.date || tx(locale, { en: 'Open date', es: 'Fecha abierta', it: 'Data aperta', ar: 'موعد مرن' })}</dd></div>
              <div><dt>{tx(locale, { en: 'Travelers', es: 'Viajeros', it: 'Viaggiatori', ar: 'المسافرون' })}</dt><dd>{line.adults + line.children + line.infants} ({tx(locale, { en: `${line.adults} adults · ${line.children} children · ${line.infants} infants`, es: `${line.adults} adultos · ${line.children} niños · ${line.infants} bebés`, it: `${line.adults} adulti · ${line.children} bambini · ${line.infants} neonati`, ar: `${line.adults} بالغين' · ${line.children} أطفال · ${line.infants} رضع` })})</dd></div>
              {line.addons.length > 0 && <div><dt>{tx(locale, { en: 'Add-ons', es: 'Extras', it: 'Extra', ar: 'الإضافات' })}</dt><dd>{line.addons.join(' · ')} — <span dir="ltr">{money(line.addonTotal)}</span></dd></div>}
            </dl>
          </article>
        ))}
      </section>

      <section className="bpd-block">
        <h2>{tx(locale, { en: 'Traveler details', es: 'Datos del viajero', it: 'Dati del viaggiatore', ar: 'بيانات المسافر' })}</h2>
        <dl className="bpd-grid">
          <div><dt>{tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' })}</dt><dd>{booking.contact.name}</dd></div>
          <div><dt>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد' })}</dt><dd dir="ltr">{booking.contact.email}</dd></div>
          <div><dt>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'الهاتف' })}</dt><dd dir="ltr">{booking.contact.phone}</dd></div>
        </dl>
        {booking.notes && <p className="bpd-notes"><strong>{tx(locale, { en: 'Notes: ', es: 'Notas: ', it: 'Note: ', ar: 'ملاحظات: ' })}</strong>{booking.notes}</p>}
      </section>

      <section className="bpd-block">
        <h2>{tx(locale, { en: 'Pricing', es: 'Precios', it: 'Prezzi', ar: 'الأسعار' })}</h2>
        <dl className="bpd-totals">
          <div><dt>{tx(locale, { en: 'Subtotal', es: 'Subtotal', it: 'Subtotale', ar: 'المجموع الفرعي' })}</dt><dd dir="ltr">{money(booking.subtotal)}</dd></div>
          {booking.discount > 0 && <div><dt>{tx(locale, { en: 'Discount', es: 'Descuento', it: 'Sconto', ar: 'الخصم' })}</dt><dd dir="ltr">−{money(booking.discount)}</dd></div>}
          <div className="grand"><dt>{tx(locale, { en: 'Grand Total', es: 'Total', it: 'Totale', ar: 'الإجمالي' })}</dt><dd dir="ltr">{money(booking.total)}</dd></div>
        </dl>
      </section>

      <footer className="bpd-foot">
        {!paid && <p><strong>{tx(locale, { en: 'Notice: ', es: 'Aviso: ', it: 'Avviso: ', ar: 'تنبيه: ' })}</strong>{tx(locale, { en: 'This document confirms receipt of your booking request. It is not a final booking confirmation or payment receipt.', es: 'Este documento confirma la recepción de tu solicitud de reserva. No es una confirmación definitiva ni un recibo de pago.', it: 'Questo documento conferma la ricezione della tua richiesta di prenotazione. Non è una conferma definitiva né una ricevuta di pagamento.', ar: 'هذه الوثيقة تؤكد استلام طلب الحجز الخاص بك. وهي ليست تأكيدًا نهائيًا للحجز ولا إيصال دفع.' })}</p>}
        <p>{tx(locale, { en: `Quote reference ${booking.reference} when contacting our team.`, es: `Menciona la referencia ${booking.reference} cuando contactes con nuestro equipo.`, it: `Cita il riferimento ${booking.reference} quando contatti il nostro team.`, ar: `عند التواصل مع فريقنا اذكر المرجع ${booking.reference}.` })}</p>
      </footer>
    </div>
  )
}
