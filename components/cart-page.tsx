'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays, ShoppingCart, Trash2, Users } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, useLocale } from './locale'
import { clearCart, removeFromCart, useCart } from '@/lib/cart'

export function CartPage() {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { items, subtotal } = useCart()
  return <SiteShell>
    <Breadcrumb items={[ar ? 'سلة الرحلات' : 'Cart']} />
    <main className="container cart-page">
      <header className="car-request-head">
        <span className="eyebrow">{ar ? 'رحلاتك المختارة' : 'Your selected trips'}</span>
        <h1>{ar ? 'سلة الرحلات' : 'Trip cart'}</h1>
      </header>
      {!items.length ? <div className="cart-empty">
        <ShoppingCart size={40} />
        <h2>{ar ? 'سلة الرحلات فارغة' : 'Your cart is empty'}</h2>
        <p>{ar ? 'تصفح الرحلات وأضف ما يعجبك لمراجعته هنا.' : 'Browse the tours and add what you like to review it here.'}</p>
        <Link href="/trips" className="primary-btn">{ar ? 'تصفح الرحلات' : 'Browse trips'} <ArrowRight size={17} /></Link>
      </div> : <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => <article key={item.key} className="cart-item">
            <img src={item.image} alt={item.title} loading="lazy" />
            <div>
              <div className="cart-line-top"><Link href={`/egypt-tours/${item.tourSlug}`}><b>{item.title}</b></Link><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={ar ? 'إزالة من السلة' : 'Remove from cart'}><Trash2 size={16} /></button></div>
              <div className="cart-meta">
                <span><CalendarDays size={14} />{item.date || (ar ? 'التاريخ مفتوح' : 'Open date')}</span>
                <span><Users size={14} />{item.adults} {ar ? 'بالغون' : 'adult(s)'}, {item.children} {ar ? 'أطفال' : 'child(ren)'}, {item.infants} {ar ? 'رضّع' : 'infant(s)'}</span>
              </div>
              {item.addons.length > 0 && <div className="cart-addons">{item.addons.map((a) => <span key={a}>{a}</span>)}</div>}
              <div className="cart-line-bottom"><small>{ar ? `${formatPrice(item.adultUnit, currency, locale)} للبالغ` : `${formatPrice(item.adultUnit, currency, locale)} / adult`}{item.children > 0 && (ar ? `, ${formatPrice(item.childUnit, currency, locale)} للطفل` : `, ${formatPrice(item.childUnit, currency, locale)} / child`)}{item.infants > 0 && (ar ? `, ${formatPrice(item.infantUnit ?? 0, currency, locale)} للرضيع` : `, ${formatPrice(item.infantUnit ?? 0, currency, locale)} / infant`)}</small><strong>{formatPrice(item.total, currency, locale)}</strong></div>
            </div>
          </article>)}
          <button type="button" className="text-link" onClick={clearCart}>{ar ? 'إفراغ السلة' : 'Clear cart'}</button>
        </div>
        <aside className="cart-summary">
          <h2>{ar ? 'ملخص الطلب' : 'Order summary'}</h2>
          <div className="cart-summary-row"><span>{ar ? 'عدد الرحلات' : 'Trips'}</span><strong>{items.length}</strong></div>
          <div className="cart-summary-row total"><span>{ar ? 'المجموع الفرعي' : 'Subtotal'}</span><strong>{formatPrice(subtotal, currency, locale)}</strong></div>
          <p>{ar ? 'تُؤكد الضرائب والرسوم النهائية قبل الدفع.' : 'Final taxes and fees are confirmed before payment.'}</p>
          <Link href="/checkout" className="primary-btn">{ar ? 'إتمام الحجز' : 'Proceed to checkout'} <ArrowRight size={17} /></Link>
          <Link href="/trips" className="outline-btn">{ar ? 'مواصلة التصفح' : 'Continue browsing'}</Link>
        </aside>
      </div>}
    </main>
  </SiteShell>
}
