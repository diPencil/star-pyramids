'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, CircleAlert, ShieldCheck, Trash2, Users } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, tx, useLocale } from './locale'
import { clearCart, removeFromCart, useCart } from '@/lib/cart'
import {
  estimateCart, hasContactErrors, validateBookingContact,
  type Booking, type BookingContact, type ContactErrors,
} from '@/lib/booking'
import { InternationalPhoneInput } from './international-phone-input'

const IDEMPOTENCY_KEY_STORAGE = 'sp-checkout-key'

function checkoutKey(): string {
  try {
    const stored = window.sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE)
    if (stored && /^[A-Za-z0-9-]{8,64}$/.test(stored)) return stored
    const fresh = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    window.sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, fresh)
    return fresh
  } catch {
    return `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function rotateCheckoutKey() {
  try { window.sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE) } catch { /* noop */ }
}

/**
 * Checkout (Phase 2E: real backend).
 * Sends SELECTIONS ONLY to `POST /api/bookings` — the server resolves
 * canonical tours/prices, computes totals in integer cents, links
 * ownership from the session, and returns the official `SP-BK-…`
 * reference. A per-attempt idempotency key makes double clicks, slow
 * networks, and re-renders create exactly ONE booking.
 */
export function CheckoutPage() {
  const { currency, locale } = useLocale()
  const { items } = useCart()
  const estimate = useMemo(() => estimateCart(items), [items])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<ContactErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [placed, setPlaced] = useState<{ reference: string; total: number; linked: boolean } | null>(null)
  const sendFailed = tx(locale, { en: 'Could not send the request. Please try again.', es: 'No se pudo enviar la solicitud. Inténtalo de nuevo.', it: 'Impossibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال الطلب. حاول مجددًا.' })

  const copy = {
    nameRequired: tx(locale, { en: 'Enter your full name.', es: 'Escribe tu nombre completo.', it: 'Inserisci il tuo nome completo.', ar: 'اكتب الاسم الكامل.' }),
    emailRequired: tx(locale, { en: 'Enter your email address.', es: 'Escribe tu correo electrónico.', it: 'Inserisci il tuo indirizzo email.', ar: 'اكتب البريد الإلكتروني.' }),
    emailInvalid: tx(locale, { en: 'Enter a valid email address.', es: 'Escribe un correo electrónico válido.', it: 'Inserisci un indirizzo email valido.', ar: 'اكتب بريدًا إلكترونيًا صحيحًا.' }),
    phoneRequired: tx(locale, { en: 'Enter your phone number.', es: 'Escribe tu número de teléfono.', it: 'Inserisci il tuo numero di telefono.', ar: 'اكتب رقم الهاتف.' }),
    phoneInvalid: tx(locale, { en: 'Enter a valid phone number (at least 7 digits).', es: 'Escribe un teléfono válido (al menos 7 dígitos).', it: 'Inserisci un numero di telefono valido (almeno 7 cifre).', ar: 'اكتب رقم هاتف صحيحًا (7 أرقام على الأقل).' }),
    staleBlocked: tx(locale, { en: 'Remove the unavailable trips from the cart before sending the request.', es: 'Quita los viajes no disponibles del carrito antes de enviar la solicitud.', it: 'Rimuovi i viaggi non disponibili dal carrello prima di inviare la richiesta.', ar: 'أزل الرحلات غير المتاحة من السلة قبل إرسال الطلب.' }),
    fixErrors: tx(locale, { en: 'Review the required fields before sending the request.', es: 'Revisa los campos obligatorios antes de enviar la solicitud.', it: 'Controlla i campi obbligatori prima di inviare la richiesta.', ar: 'راجع الحقول المطلوبة قبل إرسال الطلب.' }),
  }

  const errorText = (field: keyof ContactErrors): string | null => {
    const code = errors[field]
    if (!code) return null
    if (field === 'name') return copy.nameRequired
    if (field === 'email') return code === 'required' ? copy.emailRequired : copy.emailInvalid
    return code === 'required' ? copy.phoneRequired : copy.phoneInvalid
  }

  const staleBlocked = estimate.staleLines.length > 0
  const showSummary = attempted && (hasContactErrors(errors) || staleBlocked)

  const placeOrder = (e: FormEvent) => {
    e.preventDefault()
    if (sending || placed) return
    const contact: BookingContact = { name: name.trim(), email: email.trim(), phone: phone.trim() }
    const fieldErrors = validateBookingContact(contact)
    setErrors(fieldErrors)
    setAttempted(true)
    setSubmitError('')
    if (!estimate.validLines.length || staleBlocked || hasContactErrors(fieldErrors)) return
    setSending(true)
    const draft = {
      lines: estimate.validLines.map((line) => ({
        tourSlug: line.item.tourSlug,
        date: line.item.date,
        adults: line.item.adults,
        children: line.item.children,
        infants: line.item.infants,
        addons: [...line.item.addons],
      })),
      contact,
      notes: notes.trim(),
      currency: 'USD' as const,
      idempotencyKey: checkoutKey(),
    }
    fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(draft),
    })
      .then(async (res) => {
        const data = (await res.json()) as Booking & { error?: string }
        if (!res.ok) throw new Error(data.error || sendFailed)
        // Guest checkouts are not linked to an account: confirm honestly.
        let linked = true
        try {
          const detail = await fetch(`/api/account/bookings/${encodeURIComponent(data.reference)}`, { credentials: 'same-origin' })
          linked = detail.ok
        } catch { linked = false }
        setPlaced({ reference: data.reference, total: data.total, linked })
        clearCart()
        rotateCheckoutKey()
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : sendFailed)
      })
      .finally(() => setSending(false))
  }

  return <SiteShell>
    <Breadcrumb items={[tx(locale, { en: 'Checkout', es: 'Compra', it: 'Checkout', ar: 'إتمام الحجز' })]} />
    <main className="container cart-page">
      <header className="car-request-head">
        <span className="eyebrow">{tx(locale, { en: 'Almost done', es: 'Ya casi terminas', it: 'Quasi fatto', ar: 'لم يتبق إلا خطوة واحدة' })}</span>
        <h1>{tx(locale, { en: 'Checkout', es: 'Finalizar compra', it: 'Checkout', ar: 'إتمام الحجز' })}</h1>
      </header>
      {placed ? <div className="form-success large">
        <Check size={42} />
        <h1>{tx(locale, { en: 'Booking request received', es: 'Solicitud de reserva recibida', it: 'Richiesta di prenotazione ricevuta', ar: 'تم استلام طلب الحجز' })}</h1>
        <span className="req-ref">{tx(locale, { en: 'Official reference: ', es: 'Referencia oficial: ', it: 'Riferimento ufficiale: ', ar: 'المرجع الرسمي: ' })}{placed.reference}</span>
        <div className="req-summary-rows">
          <div><span>{tx(locale, { en: 'Booking total', es: 'Total de la reserva', it: 'Totale prenotazione', ar: 'إجمالي الحجز' })}</span><strong>{formatPrice(placed.total, currency, locale)}</strong></div>
        </div>
        <p>{placed.linked
          ? tx(locale, { en: 'We rechecked your tour prices and confirmed the total. Track your booking from your account.', es: 'Hemos revisado los precios de tus tours y confirmado el total. Sigue tu reserva desde tu cuenta.', it: 'Abbiamo ricontrollato i prezzi dei tuoi tour e confermato il totale. Segui la tua prenotazione dal tuo account.', ar: 'راجعنا أسعار رحلاتك وأكدنا الإجمالي. تابع حجزك من حسابك.' })
          : tx(locale, { en: 'We rechecked your tour prices and confirmed the total. Quote the reference when you contact our team.', es: 'Hemos revisado los precios de tus tours y confirmado el total. Menciona la referencia cuando contactes con nuestro equipo.', it: 'Abbiamo ricontrollato i prezzi dei tuoi tour e confermato il totale. Cita il riferimento quando contatti il nostro team.', ar: 'راجعنا أسعار رحلاتك وأكدنا الإجمالي. اذكر المرجع عند التواصل مع فريقنا.' })}</p>
        <div className="car-success-actions">{placed.linked && <Link className="primary-btn" href={`/account/bookings/detail?ref=${encodeURIComponent(placed.reference)}`}>{tx(locale, { en: 'View booking', es: 'Ver reserva', it: 'Visualizza prenotazione', ar: 'عرض الحجز' })}</Link>}<Link className="outline-btn" href="/trips">{tx(locale, { en: 'Browse more trips', es: 'Explorar más viajes', it: 'Sfoglia altri viaggi', ar: 'تصفح المزيد من الرحلات' })}</Link></div>
      </div> : !items.length ? <div className="cart-empty">
        <h2>{tx(locale, { en: 'Nothing to check out', es: 'Nada que comprar', it: 'Niente da acquistare', ar: 'لا توجد عناصر لإتمامها' })}</h2>
        <p>{tx(locale, { en: 'Add a trip to the cart first.', es: 'Añade primero un viaje al carrito.', it: 'Aggiungi prima un viaggio al carrello.', ar: 'أضف رحلة إلى السلة أولًا.' })}</p>
        <Link href="/trips" className="primary-btn">{tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })} <ArrowRight size={17} /></Link>
      </div> : !estimate.validLines.length ? <div className="cart-empty">
        <CircleAlert size={40} />
        <h2>{tx(locale, { en: 'No available trips to check out', es: 'No hay viajes disponibles para comprar', it: 'Nessun viaggio disponibile da acquistare', ar: 'لا توجد رحلات متاحة لإتمامها' })}</h2>
        <p>{tx(locale, { en: 'The trips saved in your cart are no longer available. Clear the cart and pick current trips.', es: 'Los viajes guardados en tu carrito ya no están disponibles. Vacía el carrito y elige viajes actuales.', it: 'I viaggi salvati nel carrello non sono più disponibili. Svuota il carrello e scegli viaggi attuali.', ar: 'الرحلات المحفوظة في السلة لم تعد متاحة. أفرغ السلة واختر رحلات حالية.' })}</p>
        <div className="car-success-actions"><button type="button" className="primary-btn" onClick={clearCart}>{tx(locale, { en: 'Clear cart', es: 'Vaciar carrito', it: 'Svuota carrello', ar: 'إفراغ السلة' })}</button><Link href="/trips" className="outline-btn">{tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })}</Link></div>
      </div> : <form className="co-layout" onSubmit={placeOrder} noValidate>
        <div className="co-form-card">
          <h2>{tx(locale, { en: 'Contact details', es: 'Datos de contacto', it: 'Dati di contatto', ar: 'بيانات التواصل' })}</h2>
          {showSummary && <p className="co-error" role="alert"><CircleAlert size={15} />{staleBlocked ? copy.staleBlocked : copy.fixErrors}</p>}
          <div className="form-grid">
            <label className="full">{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })}<input required value={name} onChange={(e) => { setName(e.target.value); setAttempted(false) }} placeholder={tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اكتب اسمك الكامل' })} maxLength={80} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'co-name-error' : undefined} />{errorText('name') && <span className="field-error" id="co-name-error">{errorText('name')}</span>}</label>
            <label>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}<input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAttempted(false) }} placeholder="you@example.com" maxLength={120} autoComplete="email" dir="ltr" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'co-email-error' : undefined} />{errorText('email') && <span className="field-error" id="co-email-error">{errorText('email')}</span>}</label>
            <label>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })}<InternationalPhoneInput required value={phone} onChange={(value) => { setPhone(value); setAttempted(false) }} locale={locale} invalid={Boolean(errors.phone)} describedBy={errors.phone ? 'co-phone-error' : undefined} />{errorText('phone') && <span className="field-error" id="co-phone-error">{errorText('phone')}</span>}</label>
            <label className="full">{tx(locale, { en: 'Notes (optional)', es: 'Notas (opcional)', it: 'Note (facoltativo)', ar: 'ملاحظات (اختياري)' })}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tx(locale, { en: 'Anything else we should know', es: 'Cualquier otra cosa que debamos saber', it: 'Altro che dovremmo sapere', ar: 'أية تفاصيل إضافية' })} maxLength={500} /></label>
          </div>
          <h2>{tx(locale, { en: 'Payment arrangements', es: 'Detalles del pago', it: 'Dettagli di pagamento', ar: 'ترتيبات الدفع' })}</h2>
          <p className="co-payment-note"><ShieldCheck size={16} /><span>{tx(locale, { en: 'No charge is made online. Payment details are arranged with our team after your booking request is reviewed.', es: 'No se cobra nada en línea. Los detalles del pago se acuerdan con nuestro equipo después de revisar tu solicitud de reserva.', it: 'Nessun addebito online. I dettagli di pagamento sono concordati con il nostro team dopo la revisione della richiesta.', ar: 'لا يتم خصم أي مبلغ عبر الإنترنت. تُرتب تفاصيل الدفع مع فريقنا بعد مراجعة طلب الحجز.' })}</span></p>
          {submitError && <p className="co-error" role="alert"><CircleAlert size={15} />{submitError}</p>}
        </div>
        <aside className="cart-summary">
          <h2>{tx(locale, { en: 'Order summary', es: 'Resumen del pedido', it: 'Riepilogo ordine', ar: 'ملخص الطلب' })}</h2>
          {estimate.validLines.map(({ item, canonicalTotal, pricedAddons, onRequestAddons }) => <div key={item.key} className="co-line">
            <div className="cart-summary-row"><span>{item.title}</span><strong>{formatPrice(canonicalTotal, currency, locale)}</strong></div>
            <small className="co-line-sub"><CalendarDays size={13} />{item.date || tx(locale, { en: 'Open date', es: 'Fecha abierta', it: 'Data aperta', ar: 'التاريخ مفتوح' })} {item.date ? tx(locale, { en: '(preferred)', es: '(preferida)', it: '(preferita)', ar: '(مفضل)' }) : ''} · <Users size={13} />{item.adults + item.children + item.infants} {tx(locale, { en: 'guest(s)', es: 'viajeros', it: 'viaggiatori', ar: 'ضيوف' })}</small>
            {(pricedAddons.length > 0 || onRequestAddons.length > 0) && <small className="co-line-sub co-line-addons">{[...pricedAddons, ...onRequestAddons.map((a) => `${a} (${tx(locale, { en: 'on request', es: 'bajo petición', it: 'su richiesta', ar: 'حسب الطلب' })})`)].join(' · ')}</small>}
          </div>)}
          {estimate.staleLines.map(({ item }) => <div key={item.key} className="co-line is-stale">
            <div className="cart-summary-row"><span>{item.title}</span><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={tx(locale, { en: 'Remove from cart', es: 'Quitar del carrito', it: 'Rimuovi dal carrello', ar: 'إزالة من السلة' })}><Trash2 size={16} /></button></div>
            <small className="co-line-sub">{tx(locale, { en: 'No longer available — remove it to continue.', es: 'Ya no disponible — quítalo para continuar.', it: 'Non più disponibile — rimuovilo per continuare.', ar: 'لم تعد متاحة — أزلها للمتابعة.' })}</small>
          </div>)}
          <div className="cart-summary-row total"><span>{tx(locale, { en: 'Estimated total', es: 'Total estimado', it: 'Totale stimato', ar: 'الإجمالي التقديري' })}</span><strong>{formatPrice(estimate.subtotal, currency, locale)}</strong></div>
          <p>{tx(locale, { en: 'Frontend estimate only. The final price is recalculated from our catalogue before the booking is confirmed.', es: 'Solo estimación inicial. El precio final se recalcula desde nuestro catálogo antes de confirmar la reserva.', it: 'Solo stima iniziale. Il prezzo finale è ricalcolato dal nostro catalogo prima della conferma.', ar: 'تقدير مبدئي فقط. يُعاد حساب السعر النهائي من قائمتنا قبل تأكيد الحجز.' })}</p>
          <button type="submit" className="primary-btn" disabled={staleBlocked || sending}>{sending ? tx(locale, { en: 'Sending...', es: 'Enviando...', it: 'Invio in corso...', ar: 'جارٍ الإرسال...' }) : tx(locale, { en: 'Request booking', es: 'Solicitar reserva', it: 'Richiedi prenotazione', ar: 'إرسال طلب الحجز' })} <ArrowRight size={17} /></button>
        </aside>
      </form>}
    </main>
  </SiteShell>
}
