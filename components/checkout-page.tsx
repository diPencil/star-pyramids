'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ArrowRight, Banknote, Check, CreditCard, ShieldCheck } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, useLocale } from './locale'
import { clearCart, useCart, type CartItem } from '@/lib/cart'
import { recordCustomerBooking } from '@/lib/customer-account'

type PayMethod = 'card' | 'arrival'

const onlyDigits = (v: string) => v.replace(/\D/g, '')

export function CheckoutPage() {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { items, subtotal } = useCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<PayMethod>('card')
  const [cardNumber, setCardNumber] = useState('')
  const [cardName, setCardName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [placed, setPlaced] = useState<{ reference: string; total: number; lines: CartItem[] } | null>(null)

  const cardValid = method !== 'card' || (onlyDigits(cardNumber).length === 16 && cardName.trim() !== '' && /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) && onlyDigits(cvc).length >= 3)

  const placeOrder = (e: FormEvent) => {
    e.preventDefault()
    if (!items.length || !cardValid) return
    const reference = `SP-${Date.now().toString(36).toUpperCase().slice(-6)}`
    recordCustomerBooking({
      reference,
      createdAt: new Date().toISOString(),
      status: 'request_received',
      paymentStatus: method === 'arrival' ? 'pay_on_arrival' : 'pending',
      paymentMethod: method,
      total: subtotal,
      currency: 'USD',
      contact: { name: name.trim(), email: email.trim(), phone: phone.trim() },
      notes: notes.trim(),
      lines: [...items],
    })
    setPlaced({ reference, total: subtotal, lines: items })
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
        <h1>{ar ? 'تم استلام طلبك' : 'Your booking is received'}</h1>
        <span className="req-ref">{ar ? 'رقم الحجز: ' : 'Booking ref: '}{placed.reference}</span>
        <div className="req-summary-rows">
          {placed.lines.map((l) => <div key={l.key}><span>{l.title}</span><strong>{formatPrice(l.total, currency, locale)}</strong></div>)}
          <div><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{formatPrice(placed.total, currency, locale)}</strong></div>
        </div>
        <p>{ar ? 'سنتواصل معك قريبًا لتأكيد التفاصيل.' : 'We will contact you shortly to confirm the details.'}</p>
        <div className="car-success-actions"><Link className="primary-btn" href="/account/bookings">{ar ? 'متابعة الحجز' : 'Track booking'}</Link><Link className="outline-btn" href="/trips">{ar ? 'تصفح المزيد من الرحلات' : 'Browse more trips'}</Link></div>
      </div> : !items.length ? <div className="cart-empty">
        <h2>{ar ? 'لا توجد عناصر لإتمامها' : 'Nothing to check out'}</h2>
        <p>{ar ? 'أضف رحلة إلى السلة أولًا.' : 'Add a trip to the cart first.'}</p>
        <Link href="/trips" className="primary-btn">{ar ? 'تصفح الرحلات' : 'Browse trips'} <ArrowRight size={17} /></Link>
      </div> : <form className="co-layout" onSubmit={placeOrder}>
        <div className="co-form-card">
          <h2>{ar ? 'بيانات التواصل' : 'Contact details'}</h2>
          <div className="form-grid">
            <label className="full">{ar ? 'الاسم الكامل' : 'Full name'}<input required value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? 'اكتب اسمك الكامل' : 'Your name'} maxLength={80} /></label>
            <label>{ar ? 'البريد الإلكتروني' : 'Email'}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} /></label>
            <label>{ar ? 'رقم الهاتف' : 'Phone'}<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 ..." maxLength={24} /></label>
            <label className="full">{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ar ? 'أية تفاصيل إضافية' : 'Anything else we should know'} maxLength={500} /></label>
          </div>
          <h2>{ar ? 'طريقة الدفع' : 'Payment method'}</h2>
          <div className="pay-methods" role="radiogroup" aria-label={ar ? 'طريقة الدفع' : 'Payment method'}>
            <label className={method === 'card' ? 'active' : ''}><input type="radio" name="pay" checked={method === 'card'} onChange={() => setMethod('card')} /><CreditCard size={18} /><span><b>{ar ? 'بطاقة بنكية' : 'Credit / debit card'}</b><small>{ar ? 'دفع آمن عبر الإنترنت' : 'Secure online payment'}</small></span></label>
            <label className={method === 'arrival' ? 'active' : ''}><input type="radio" name="pay" checked={method === 'arrival'} onChange={() => setMethod('arrival')} /><Banknote size={18} /><span><b>{ar ? 'الدفع عند الوصول' : 'Pay on arrival'}</b><small>{ar ? 'ادفع نقدًا أو بالبطاقة عند بدء الرحلة' : 'Pay by cash or card when your trip starts'}</small></span></label>
          </div>
          {method === 'card' && <div className="form-grid">
            <label className="full">{ar ? 'رقم البطاقة' : 'Card number'}<input required inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(onlyDigits(e.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '))} placeholder="1234 5678 9012 3456" maxLength={19} /></label>
            <label className="full">{ar ? 'الاسم على البطاقة' : 'Name on card'}<input required value={cardName} onChange={(e) => setCardName(e.target.value)} maxLength={80} /></label>
            <label>{ar ? 'تاريخ الانتهاء (شهر/سنة)' : 'Expiry (MM/YY)'}<input required value={expiry} onChange={(e) => { const d = onlyDigits(e.target.value).slice(0, 4); setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d) }} placeholder="MM/YY" maxLength={5} /></label>
            <label>{ar ? 'رمز الأمان' : 'CVC'}<input required inputMode="numeric" value={cvc} onChange={(e) => setCvc(onlyDigits(e.target.value).slice(0, 4))} placeholder="123" maxLength={4} /></label>
          </div>}
          <p className="co-demo-note"><ShieldCheck size={15} />{ar ? 'وضع تجريبي: لن يتم خصم أي مبلغ. يُفعَّل الدفع الحقيقي بربط بوابة دفع.' : 'Demo checkout: no real charge is made. Live payments activate with a payment gateway.'}</p>
        </div>
        <aside className="cart-summary">
          <h2>{ar ? 'ملخص الطلب' : 'Order summary'}</h2>
          {items.map((item) => <div key={item.key} className="cart-summary-row"><span>{item.title}, {item.adults + item.children + item.infants} {ar ? 'ضيوف' : 'guest(s)'}</span><strong>{formatPrice(item.total, currency, locale)}</strong></div>)}
          <div className="cart-summary-row total"><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{formatPrice(subtotal, currency, locale)}</strong></div>
          <button type="submit" className="primary-btn" disabled={!cardValid}>{ar ? 'تأكيد الحجز' : 'Place booking'} <ArrowRight size={17} /></button>
        </aside>
      </form>}
    </main>
  </SiteShell>
}
