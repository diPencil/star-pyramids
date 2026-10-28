'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { MessageCircle, ReceiptText, ShieldCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { tx, useLocale, type Locale } from '@/components/locale'
import { SharedSelect } from '@/components/shared-select'
import { bookingOfflinePaymentLabel, remainingBookingBalance } from '@/lib/payment'
import type { Booking } from '@/lib/booking'
import { customerErrorText } from '@/lib/customer-error-copy'

/**
 * Offline payment instructions (Phase 3: no gateway, no bank details on
 * file). Bank Transfer and Cash are the supported methods; because no
 * account details are configured, customers are directed to the team
 * instead of shown invented numbers. Internal admin notes are never
 * referenced here.
 */
export function PaymentInstructions({ layout }: { layout: 'section' | 'note' }) {
  const { locale } = useLocale()
  const title = tx(locale, { en: 'How to pay', es: 'Cómo pagar', it: 'Come pagare', ar: 'كيفية الدفع' })
  const methods = [
    tx(locale, { en: 'Bank transfer', es: 'Transferencia bancaria', it: 'Bonifico bancario', ar: 'تحويل بنكي' }),
    tx(locale, { en: 'Cash', es: 'Efectivo', it: 'Contanti', ar: 'نقدي' }),
  ]
  const contactLine = tx(locale, { en: 'Contact our team for payment instructions', es: 'Contacta con nuestro equipo para recibir las instrucciones de pago', it: 'Contatta il nostro team per le istruzioni di pagamento', ar: 'تواصل مع فريقنا للحصول على تعليمات الدفع' })
  const verifyNote = tx(locale, { en: 'No charge is made online. Your payment counts only after our team verifies the receipt.', es: 'No se cobra nada en línea. Tu pago solo cuenta cuando nuestro equipo verifica el comprobante.', it: 'Nessun addebito online. Il pagamento vale solo dopo la verifica del nostro team.', ar: 'لا يتم خصم أي مبلغ عبر الإنترنت. يُحتسب الدفع فقط بعد تحقق فريقنا من الإيصال.' })
  const contactCta = tx(locale, { en: 'Contact our team', es: 'Contacta con nuestro equipo', it: 'Contatta il nostro team', ar: 'تواصل مع فريقنا' })

  if (layout === 'note') {
    // Compact variant for the checkout confirmation: uses the global
    // checkout note style (`co-payment-note` lives in globals.css), so
    // no account-scoped CSS is required here.
    return <div role="note">
      <p className="co-payment-note"><ShieldCheck size={16} /><span><strong>{title}:</strong> {methods.join(' · ')}. {contactLine}. <Link href="/contact">{contactCta}</Link></span></p>
      <p className="co-payment-note"><ShieldCheck size={16} /><span>{verifyNote}</span></p>
    </div>
  }

  return <section className="customer-account-block" aria-label={title} id="sp-payment-instructions">
    <header><div><span>{tx(locale, { en: 'Payment', es: 'Pago', it: 'Pagamento', ar: 'الدفع' })}</span><h2>{title}</h2></div></header>
    <div className="customer-detail-grid">
      <div><small>{tx(locale, { en: 'Accepted methods', es: 'Métodos aceptados', it: 'Metodi accettati', ar: 'الطرق المقبولة' })}</small><strong>{methods.join(' · ')}</strong></div>
      <div><small>{tx(locale, { en: 'Bank details', es: 'Datos bancarios', it: 'Dati bancari', ar: 'بيانات البنك' })}</small><strong>{contactLine}</strong></div>
    </div>
    <p className="customer-block-note"><ShieldCheck size={14} /> {verifyNote}</p>
    <div className="customer-detail-actions">
      <Link href="/contact" className="account-icon-action"><MessageCircle size={16} />{contactCta}</Link>
    </div>
  </section>
}

/** Server-calculated financial truth, denominated in the booking currency. */
export function bookingMoney(booking: Booking): { paid: number; refunded: number; remaining: number } {
  const paid = booking.paymentSummary?.paidTotal ?? 0
  const refunded = booking.paymentSummary?.refundedTotal ?? 0
  return { paid, refunded, remaining: remainingBookingBalance(booking.total, paid, refunded) }
}

export function bookingPaymentLabel(booking: Booking, locale: Locale): string {
  const summary = booking.paymentSummary
  return bookingOfflinePaymentLabel(
    {
      state: summary?.state ?? 'unpaid',
      paidTotal: summary?.paidTotal ?? 0,
      refundedTotal: summary?.refundedTotal ?? 0,
      total: booking.total,
    },
    locale,
  )
}

function methodLabel(method: 'bank_transfer' | 'cash' | null, locale: Locale): string {
  if (method === 'bank_transfer') return tx(locale, { en: 'Bank transfer', es: 'Transferencia bancaria', it: 'Bonifico bancario', ar: 'تحويل بنكي' })
  if (method === 'cash') return tx(locale, { en: 'Cash', es: 'Efectivo', it: 'Contanti', ar: 'نقدي' })
  return tx(locale, { en: 'Offline payment', es: 'Pago offline', it: 'Pagamento offline', ar: 'دفع مباشر' })
}

type SubmittedProofResponse = {
  proof: { reference: string; method: 'bank_transfer' | 'cash' | null; submittedAt: string; reviewed: boolean; created: boolean; duplicate: boolean }
}

/**
 * Reference-only proof submission form. Sends the bank/cash reference
 * for staff review — never a file (no private upload infrastructure),
 * never money. The confirmation states receipt, never verification.
 */
export function PaymentProofForm({ bookingReference, guestToken, onSubmitted }: {
  bookingReference: string
  guestToken?: string
  onSubmitted?: () => void
}) {
  const { locale } = useLocale()
  const [reference, setReference] = useState('')
  const [method, setMethod] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (sending) return
    const value = reference.trim()
    if (value.length < 3) {
      setError(tx(locale, { en: 'Enter the payment reference from your bank or receipt.', es: 'Escribe la referencia de pago de tu banco o recibo.', it: 'Inserisci il riferimento di pagamento della banca o ricevuta.', ar: 'اكتب مرجع الدفع من البنك أو الإيصال.' }))
      return
    }
    setSending(true)
    setError('')
    setNotice('')
    const url = guestToken
      ? `/api/bookings/access/${encodeURIComponent(guestToken)}/proof`
      : `/api/account/bookings/${encodeURIComponent(bookingReference)}/proof`
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: guestToken ? 'omit' : 'same-origin',
      body: JSON.stringify({ reference: value, ...(method ? { method } : {}) }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as SubmittedProofResponse & { error?: string }
        if (!res.ok) throw new Error(customerErrorText(locale, data.error, tx(locale, { en: 'Could not send the reference. Please try again.', es: 'No se pudo enviar la referencia. Inténtalo de nuevo.', it: 'Impossibile inviare il riferimento. Riprova.', ar: 'تعذر إرسال المرجع. حاول مجددًا.' })))
        setReference('')
        setMethod('')
        setNotice(data.proof?.duplicate
          ? tx(locale, { en: 'We already received this reference — our team will review it. No payment is confirmed yet.', es: 'Ya recibimos esta referencia — nuestro equipo la revisará. Aún no hay ningún pago confirmado.', it: 'Abbiamo già ricevuto questo riferimento — il nostro team lo verificherà. Nessun pagamento è ancora confermato.', ar: 'استلمنا هذا المرجع من قبل — سيراجعه فريقنا. لم يتم تأكيد أي دفع بعد.' })
          : tx(locale, { en: 'Reference received — our team will review it. This does not confirm payment yet.', es: 'Referencia recibida — nuestro equipo la revisará. Esto aún no confirma el pago.', it: 'Riferimento ricevuto — il nostro team lo verificherà. Questo non conferma ancora il pagamento.', ar: 'تم استلام المرجع — سيراجعه فريقنا. هذا لا يؤكد الدفع بعد.' }))
        onSubmitted?.()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : tx(locale, { en: 'Could not send the reference. Please try again.', es: 'No se pudo enviar la referencia. Inténtalo de nuevo.', it: 'Impossibile inviare il riferimento. Riprova.', ar: 'تعذر إرسال المرجع. حاول مجددًا.' }))
      })
      .finally(() => setSending(false))
  }

  return <section className="customer-account-block" aria-label={tx(locale, { en: 'Submit payment proof', es: 'Enviar comprobante de pago', it: 'Invia prova di pagamento', ar: 'إرسال إثبات الدفع' })}>
    <header><div><span>{tx(locale, { en: 'Payment proof', es: 'Comprobante de pago', it: 'Prova di pagamento', ar: 'إثبات الدفع' })}</span><h2>{tx(locale, { en: 'Tell us you have paid', es: 'Avísanos de que has pagado', it: 'Avvisaci del pagamento', ar: 'أخبرنا أنك دفعت' })}</h2></div></header>
    <p className="customer-block-note" style={{ marginTop: 0 }}>{tx(locale, { en: 'Paid by bank transfer or cash? Send the reference from your receipt so our team can verify it. Sending a reference never marks the booking paid by itself.', es: '¿Pagaste por transferencia o en efectivo? Envía la referencia de tu recibo para que nuestro equipo la verifique. Enviar una referencia nunca marca la reserva como pagada por sí solo.', it: 'Hai pagato con bonifico o contanti? Invia il riferimento della ricevuta così il nostro team può verificarlo. Inviare un riferimento non segna mai la prenotazione come pagata.', ar: 'دفعت بتحويل بنكي أو نقدًا؟ أرسل مرجع الإيصال ليتحقق فريقنا منه. إرسال المرجع لا يعلّم الحجز كمدفوع وحده أبدًا.' })}</p>
    <form onSubmit={submit}>
      <div className="customer-form-grid">
        <label>{tx(locale, { en: 'Payment method', es: 'Método de pago', it: 'Metodo di pagamento', ar: 'طريقة الدفع' })}
          <SharedSelect value={method} onChange={setMethod} locale={locale} label={tx(locale, { en: 'Payment method', es: 'Método de pago', it: 'Metodo di pagamento', ar: 'طريقة الدفع' })} options={[
            { value: '', label: tx(locale, { en: 'Select a method…', es: 'Elige un método…', it: 'Seleziona un metodo…', ar: 'اختر الطريقة…' }) },
            { value: 'bank_transfer', label: tx(locale, { en: 'Bank transfer', es: 'Transferencia bancaria', it: 'Bonifico bancario', ar: 'تحويل بنكي' }) },
            { value: 'cash', label: tx(locale, { en: 'Cash', es: 'Efectivo', it: 'Contanti', ar: 'نقدي' }) },
          ]} />
        </label>
        <label>{tx(locale, { en: 'Payment reference', es: 'Referencia de pago', it: 'Riferimento di pagamento', ar: 'مرجع الدفع' })}
          <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={128} dir="ltr" autoComplete="off" placeholder={tx(locale, { en: 'e.g. BANK-REF-123456', es: 'p. ej. BANK-REF-123456', it: 'ad es. BANK-REF-123456', ar: 'مثال: BANK-REF-123456' })} aria-label={tx(locale, { en: 'Payment reference', es: 'Referencia de pago', it: 'Riferimento di pagamento', ar: 'مرجع الدفع' })} />
        </label>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status" className="form-note">{notice}</p>}
      <div className="customer-detail-actions">
        <button type="submit" className="account-icon-action primary" disabled={sending}><ReceiptText size={16} />{sending
          ? tx(locale, { en: 'Sending…', es: 'Enviando…', it: 'Invio in corso…', ar: 'جارٍ الإرسال…' })
          : tx(locale, { en: 'Submit payment reference', es: 'Enviar referencia de pago', it: 'Invia riferimento di pagamento', ar: 'إرسال مرجع الدفع' })}</button>
      </div>
    </form>
  </section>
}

/**
 * Booking financial summary + submitted proofs (customer-safe only).
 * Amounts come from the server-calculated payment summary; the display
 * amounts use native formatting in the stored booking currency.
 */
export function BookingPaymentPanel({ booking }: { booking: Booking }) {
  const { locale, currency } = useLocale()
  const { paid, refunded, remaining } = bookingMoney(booking)
  const proofs = booking.paymentProofs ?? []
  const dateFor = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB')
  }

  return <section className="customer-account-block" aria-label={tx(locale, { en: 'Payment summary', es: 'Resumen del pago', it: 'Riepilogo pagamento', ar: 'ملخص الدفع' })}>
    <header><div><span>{booking.reference}</span><h2>{tx(locale, { en: 'Payment summary', es: 'Resumen del pago', it: 'Riepilogo pagamento', ar: 'ملخص الدفع' })}</h2></div><span className="customer-booking-flags"><span className="customer-status local"><ShieldCheck size={13} />{bookingPaymentLabel(booking, locale)}</span></span></header>
    <div className="customer-detail-grid">
      <div><small>{tx(locale, { en: 'Booking total', es: 'Total de la reserva', it: 'Totale prenotazione', ar: 'إجمالي الحجز' })}</small><strong>{formatCurrency(booking.total, booking.currency, locale)}</strong></div>
      <div><small>{tx(locale, { en: 'Verified paid', es: 'Pagado verificado', it: 'Pagato verificato', ar: 'المدفوع المؤكد' })}</small><strong>{formatCurrency(paid, booking.currency, locale)}</strong></div>
      <div><small>{tx(locale, { en: 'Refunded', es: 'Reembolsado', it: 'Rimborsato', ar: 'المسترد' })}</small><strong>{formatCurrency(refunded, booking.currency, locale)}</strong></div>
      <div><small>{tx(locale, { en: 'Remaining balance', es: 'Saldo pendiente', it: 'Saldo residuo', ar: 'الرصيد المتبقي' })}</small><strong>{formatCurrency(remaining, booking.currency, locale)}</strong></div>
    </div>
    {proofs.length > 0 && <div>
      <p className="customer-block-note"><strong>{tx(locale, { en: 'Submitted references', es: 'Referencias enviadas', it: 'Riferimenti inviati', ar: 'المراجع المرسلة' })}</strong></p>
      <ul className="customer-timeline">
        {proofs.map((proof) => <li key={proof.reference} className={proof.reviewed ? 'done' : ''}><span /><div><strong dir="ltr">{proof.reference}</strong><small>{methodLabel(proof.method, locale)} · {dateFor(proof.submittedAt)} · {proof.reviewed
          ? tx(locale, { en: 'Reviewed by our team', es: 'Revisada por nuestro equipo', it: 'Verificata dal nostro team', ar: 'راجعها فريقنا' })
          : tx(locale, { en: 'Awaiting review — not confirmed', es: 'En revisión — sin confirmar', it: 'In revisione — non confermato', ar: 'بانتظار المراجعة — غير مؤكد' })}</small></div></li>)}
      </ul>
    </div>}
  </section>
}
