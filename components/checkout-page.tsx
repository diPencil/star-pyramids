'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, Check, CircleAlert, ShieldCheck, Trash2, Users } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, useLocale } from './locale'
import { clearCart, removeFromCart, useCart, type CartItem } from '@/lib/cart'
import {
  estimateCart, hasContactErrors, validateBookingContact,
  type BookingContact, type ContactErrors,
} from '@/lib/booking'
import { recordBookingRequestDraft } from '@/lib/customer-account'

export function CheckoutPage() {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { items } = useCart()
  const estimate = useMemo(() => estimateCart(items), [items])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<ContactErrors>({})
  const [attempted, setAttempted] = useState(false)
  const [placed, setPlaced] = useState<{ reference: string; total: number; lines: CartItem[] } | null>(null)

  const copy = {
    nameRequired: ar ? 'اكتب الاسم الكامل.' : 'Enter your full name.',
    emailRequired: ar ? 'اكتب البريد الإلكتروني.' : 'Enter your email address.',
    emailInvalid: ar ? 'اكتب بريدًا إلكترونيًا صحيحًا.' : 'Enter a valid email address.',
    phoneRequired: ar ? 'اكتب رقم الهاتف.' : 'Enter your phone number.',
    phoneInvalid: ar ? 'اكتب رقم هاتف صحيحًا (7 أرقام على الأقل).' : 'Enter a valid phone number (at least 7 digits).',
    staleBlocked: ar ? 'أزل الرحلات غير المتاحة من السلة قبل إرسال الطلب.' : 'Remove the unavailable trips from the cart before sending the request.',
    fixErrors: ar ? 'راجع الحقول المطلوبة قبل إرسال الطلب.' : 'Review the required fields before sending the request.',
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
    const contact: BookingContact = { name: name.trim(), email: email.trim(), phone: phone.trim() }
    const fieldErrors = validateBookingContact(contact)
    setErrors(fieldErrors)
    setAttempted(true)
    if (!estimate.validLines.length || staleBlocked || hasContactErrors(fieldErrors)) return
    const booking = recordBookingRequestDraft({
      lines: estimate.validLines.map((line) => line.item),
      contact,
      notes: notes.trim(),
      estimateUSD: estimate.subtotal,
      currency: 'USD',
    })
    setPlaced({ reference: booking.reference, total: booking.total, lines: booking.lines })
    clearCart()
  }

  return <SiteShell>
    <Breadcrumb items={[ar ? 'إتمام الحجز' : 'Checkout']} />
    <main className="container cart-page">
      <header className="car-request-head">
        <span className="eyebrow">{ar ? 'لم يتبق إلا خطوة واحدة' : 'Almost done'}</span>
        <h1>{ar ? 'إتمام الحجز' : 'Checkout'}</h1>
      </header>
      {placed ? <div className="form-success large">
        <Check size={42} />
        <h1>{ar ? 'تم إنشاء معاينة طلب الحجز' : 'Booking request preview created'}</h1>
        <span className="req-ref">{ar ? 'المرجع المحلي: ' : 'Local ref: '}{placed.reference}</span>
        <div className="req-summary-rows">
          {placed.lines.map((l) => <div key={l.key}><span>{l.title}</span><strong>{formatPrice(l.total, currency, locale)}</strong></div>)}
          <div><span>{ar ? 'الإجمالي التقديري' : 'Estimated total'}</span><strong>{formatPrice(placed.total, currency, locale)}</strong></div>
        </div>
        <p>{ar ? 'هذا المرجع موجود في هذا المتصفح فقط ولم يُرسل إلى STAR PYRAMIDS. اذكره عند التواصل مع فريقنا.' : 'This reference exists only in this browser and has not been submitted to STAR PYRAMIDS. Quote it when you contact our team.'}</p>
        <div className="car-success-actions"><Link className="primary-btn" href={`/account/bookings/detail?ref=${encodeURIComponent(placed.reference)}`}>{ar ? 'عرض طلب الحجز' : 'View booking request'}</Link><Link className="outline-btn" href="/trips">{ar ? 'تصفح المزيد من الرحلات' : 'Browse more trips'}</Link></div>
      </div> : !items.length ? <div className="cart-empty">
        <h2>{ar ? 'لا توجد عناصر لإتمامها' : 'Nothing to check out'}</h2>
        <p>{ar ? 'أضف رحلة إلى السلة أولًا.' : 'Add a trip to the cart first.'}</p>
        <Link href="/trips" className="primary-btn">{ar ? 'تصفح الرحلات' : 'Browse trips'} <ArrowRight size={17} /></Link>
      </div> : !estimate.validLines.length ? <div className="cart-empty">
        <CircleAlert size={40} />
        <h2>{ar ? 'لا توجد رحلات متاحة لإتمامها' : 'No available trips to check out'}</h2>
        <p>{ar ? 'الرحلات المحفوظة في السلة لم تعد متاحة. أفرغ السلة واختر رحلات حالية.' : 'The trips saved in your cart are no longer available. Clear the cart and pick current trips.'}</p>
        <div className="car-success-actions"><button type="button" className="primary-btn" onClick={clearCart}>{ar ? 'إفراغ السلة' : 'Clear cart'}</button><Link href="/trips" className="outline-btn">{ar ? 'تصفح الرحلات' : 'Browse trips'}</Link></div>
      </div> : <form className="co-layout" onSubmit={placeOrder} noValidate>
        <div className="co-form-card">
          <h2>{ar ? 'بيانات التواصل' : 'Contact details'}</h2>
          {showSummary && <p className="co-error" role="alert"><CircleAlert size={15} />{staleBlocked ? copy.staleBlocked : copy.fixErrors}</p>}
          <div className="form-grid">
            <label className="full">{ar ? 'الاسم الكامل' : 'Full name'}<input required value={name} onChange={(e) => { setName(e.target.value); setAttempted(false) }} placeholder={ar ? 'اكتب اسمك الكامل' : 'Your name'} maxLength={80} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'co-name-error' : undefined} />{errorText('name') && <span className="field-error" id="co-name-error">{errorText('name')}</span>}</label>
            <label>{ar ? 'البريد الإلكتروني' : 'Email'}<input required type="email" value={email} onChange={(e) => { setEmail(e.target.value); setAttempted(false) }} placeholder="you@example.com" maxLength={120} autoComplete="email" dir="ltr" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'co-email-error' : undefined} />{errorText('email') && <span className="field-error" id="co-email-error">{errorText('email')}</span>}</label>
            <label>{ar ? 'رقم الهاتف' : 'Phone'}<input required type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setAttempted(false) }} placeholder="+20 ..." maxLength={24} autoComplete="tel" dir="ltr" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'co-phone-error' : undefined} />{errorText('phone') && <span className="field-error" id="co-phone-error">{errorText('phone')}</span>}</label>
            <label className="full">{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ar ? 'أية تفاصيل إضافية' : 'Anything else we should know'} maxLength={500} /></label>
          </div>
          <h2>{ar ? 'ترتيبات الدفع' : 'Payment arrangements'}</h2>
          <p className="co-payment-note"><ShieldCheck size={16} /><span>{ar ? 'سيتم تأكيد تفاصيل الدفع بعد مراجعة طلب الحجز.' : 'Payment details will be confirmed after your booking request is reviewed.'}</span></p>
          <p className="co-demo-note"><ShieldCheck size={15} />{ar ? 'وضع تجريبي: لن يتم خصم أي مبلغ. يُفعَّل الدفع الحقيقي بربط بوابة دفع.' : 'Demo checkout: no real charge is made. Live payments activate with a payment gateway.'}</p>
        </div>
        <aside className="cart-summary">
          <h2>{ar ? 'ملخص الطلب' : 'Order summary'}</h2>
          {estimate.validLines.map(({ item, canonicalTotal, pricedAddons, onRequestAddons }) => <div key={item.key} className="co-line">
            <div className="cart-summary-row"><span>{item.title}</span><strong>{formatPrice(canonicalTotal, currency, locale)}</strong></div>
            <small className="co-line-sub"><CalendarDays size={13} />{item.date || (ar ? 'التاريخ مفتوح' : 'Open date')} {item.date ? (ar ? '(مفضل)' : '(preferred)') : ''} · <Users size={13} />{item.adults + item.children + item.infants} {ar ? 'ضيوف' : 'guest(s)'}</small>
            {(pricedAddons.length > 0 || onRequestAddons.length > 0) && <small className="co-line-sub co-line-addons">{[...pricedAddons, ...onRequestAddons.map((a) => `${a} (${ar ? 'حسب الطلب' : 'on request'})`)].join(' · ')}</small>}
          </div>)}
          {estimate.staleLines.map(({ item }) => <div key={item.key} className="co-line is-stale">
            <div className="cart-summary-row"><span>{item.title}</span><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={ar ? 'إزالة من السلة' : 'Remove from cart'}><Trash2 size={16} /></button></div>
            <small className="co-line-sub">{ar ? 'لم تعد متاحة — أزلها للمتابعة.' : 'No longer available — remove it to continue.'}</small>
          </div>)}
          <div className="cart-summary-row total"><span>{ar ? 'الإجمالي التقديري' : 'Estimated total'}</span><strong>{formatPrice(estimate.subtotal, currency, locale)}</strong></div>
          <p>{ar ? 'تقدير مبدئي فقط. السعر النهائي يُؤكد قبل الدفع.' : 'Frontend estimate only. The final price is confirmed before payment.'}</p>
          <button type="submit" className="primary-btn" disabled={staleBlocked}>{ar ? 'إرسال طلب الحجز' : 'Request booking'} <ArrowRight size={17} /></button>
        </aside>
      </form>}
    </main>
  </SiteShell>
}
