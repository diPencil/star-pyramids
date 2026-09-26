'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ArrowRight, Banknote, Check, CreditCard, ShieldCheck } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, useLocale } from './locale'
import { clearCart, useCart, type CartItem } from '@/lib/cart'
import { recordCustomerBooking } from '@/lib/customer-account'

type PayMethod = 'card' | 'arrival'

export function CheckoutPage() {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { items, subtotal } = useCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  // Card payments are intentionally unavailable until a secure payment gateway is integrated.
  // 'arrival' is the only live prototype method; no card credentials are collected or stored.
  const method: PayMethod = 'arrival'
  const [placed, setPlaced] = useState<{ reference: string; total: number; lines: CartItem[] } | null>(null)

  const placeOrder = (e: FormEvent) => {
    e.preventDefault()
    if (!items.length) return
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
        <h1>{ar ? 'تم إنشاء معاينة طلب الحجز' : 'Booking request preview created'}</h1>
        <span className="req-ref">{ar ? 'المرجع المحلي: ' : 'Local ref: '}{placed.reference}</span>
        <div className="req-summary-rows">
          {placed.lines.map((l) => <div key={l.key}><span>{l.title}</span><strong>{formatPrice(l.total, currency, locale)}</strong></div>)}
          <div><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{formatPrice(placed.total, currency, locale)}</strong></div>
        </div>
        <p>{ar ? 'هذا المرجع موجود في هذا المتصفح فقط ولم يُرسل إلى STAR PYRAMIDS. اذكره عند التواصل مع فريقنا.' : 'This reference exists only in this browser and has not been submitted to STAR PYRAMIDS. Quote it when you contact our team.'}</p>
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
            <label className="active"><input type="radio" name="pay" checked readOnly /><Banknote size={18} /><span><b>{ar ? 'الدفع عند الوصول' : 'Pay on arrival'}</b><small>{ar ? 'ادفع نقدًا أو بالبطاقة عند بدء الرحلة' : 'Pay by cash or card when your trip starts'}</small></span></label>
            <label aria-disabled="true"><input type="radio" name="pay" disabled /><CreditCard size={18} /><span><b>{ar ? 'بطاقة بنكية عبر الإنترنت' : 'Credit / debit card online'}</b><small>{ar ? 'سيتاح الدفع بالبطاقة بعد ربط بوابة دفع آمنة.' : 'Online card payment will be available after secure payment gateway integration.'}</small></span></label>
          </div>
          <p className="co-demo-note"><ShieldCheck size={15} />{ar ? 'وضع تجريبي: لن يتم خصم أي مبلغ. يُفعَّل الدفع الحقيقي بربط بوابة دفع.' : 'Demo checkout: no real charge is made. Live payments activate with a payment gateway.'}</p>
        </div>
        <aside className="cart-summary">
          <h2>{ar ? 'ملخص الطلب' : 'Order summary'}</h2>
          {items.map((item) => <div key={item.key} className="cart-summary-row"><span>{item.title}, {item.adults + item.children + item.infants} {ar ? 'ضيوف' : 'guest(s)'}</span><strong>{formatPrice(item.total, currency, locale)}</strong></div>)}
          <div className="cart-summary-row total"><span>{ar ? 'الإجمالي' : 'Total'}</span><strong>{formatPrice(subtotal, currency, locale)}</strong></div>
          <button type="submit" className="primary-btn">{ar ? 'إرسال طلب الحجز' : 'Request booking'} <ArrowRight size={17} /></button>
        </aside>
      </form>}
    </main>
  </SiteShell>
}
