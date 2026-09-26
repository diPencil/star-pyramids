'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, CalendarDays, CircleAlert, ShoppingCart, Trash2, Users } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, useLocale } from './locale'
import { clearCart, removeFromCart, useCart } from '@/lib/cart'
import { estimateCart } from '@/lib/booking'

export function CartPage() {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { items } = useCart()
  const estimate = useMemo(() => estimateCart(items), [items])
  const openDateLabel = ar ? 'التاريخ مفتوح' : 'Open date'

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
          {estimate.validLines.map(({ item, adultUnit, childUnit, infantUnit, canonicalTotal, pricedAddons, onRequestAddons }) => <article key={item.key} className="cart-item">
            <img src={item.image} alt={item.title} loading="lazy" />
            <div>
              <div className="cart-line-top"><Link href={`/egypt-tours/${item.tourSlug}`}><b>{item.title}</b></Link><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={ar ? 'إزالة من السلة' : 'Remove from cart'}><Trash2 size={16} /></button></div>
              <div className="cart-meta">
                <span><CalendarDays size={14} />{item.date || openDateLabel} {item.date ? (ar ? '(مفضل)' : '(preferred)') : ''}</span>
                <span><Users size={14} />{item.adults} {ar ? 'بالغون' : 'adult(s)'}, {item.children} {ar ? 'أطفال' : 'child(ren)'}, {item.infants} {ar ? 'رضّع' : 'infant(s)'}</span>
              </div>
              {(pricedAddons.length > 0 || onRequestAddons.length > 0) && <div className="cart-addons">
                {pricedAddons.map((a) => <span key={a}>{a}</span>)}
                {onRequestAddons.map((a) => <span key={a} className="on-request">{a} · {ar ? 'حسب الطلب' : 'on request'}</span>)}
              </div>}
              <div className="cart-line-bottom"><small>{ar ? `${formatPrice(adultUnit, currency, locale)} للبالغ` : `${formatPrice(adultUnit, currency, locale)} / adult`}{item.children > 0 && (ar ? `, ${formatPrice(childUnit, currency, locale)} للطفل` : `, ${formatPrice(childUnit, currency, locale)} / child`)}{item.infants > 0 && (ar ? `, ${formatPrice(infantUnit, currency, locale)} للرضيع` : `, ${formatPrice(infantUnit, currency, locale)} / infant`)}</small><strong>{formatPrice(canonicalTotal, currency, locale)}</strong></div>
            </div>
          </article>)}
          {estimate.staleLines.map(({ item }) => <article key={item.key} className="cart-item is-stale">
            <img src={item.image} alt="" loading="lazy" />
            <div>
              <div className="cart-line-top"><b>{item.title}</b><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={ar ? 'إزالة من السلة' : 'Remove from cart'}><Trash2 size={16} /></button></div>
              <p className="cart-stale-note" role="note"><CircleAlert size={15} />{ar ? 'هذه الرحلة لم تعد متاحة. أزلها من السلة للمتابعة إلى الدفع.' : 'This trip is no longer available. Remove it from the cart to continue to checkout.'}</p>
            </div>
          </article>)}
          <button type="button" className="text-link" onClick={clearCart}>{ar ? 'إفراغ السلة' : 'Clear cart'}</button>
        </div>
        <aside className="cart-summary">
          <h2>{ar ? 'ملخص الطلب' : 'Order summary'}</h2>
          <div className="cart-summary-row"><span>{ar ? 'عدد الرحلات' : 'Trips'}</span><strong>{estimate.validLines.length}</strong></div>
          <div className="cart-summary-row total"><span>{ar ? 'الإجمالي التقديري' : 'Estimated subtotal'}</span><strong>{formatPrice(estimate.subtotal, currency, locale)}</strong></div>
          <p>{ar ? 'تقدير مبدئي فقط. السعر النهائي والضرائب والرسوم تُؤكد مع فريقنا قبل الدفع.' : 'Frontend estimate only. The final price, taxes, and fees are confirmed with our team before payment.'}</p>
          {estimate.validLines.length > 0
            ? <Link href="/checkout" className="primary-btn">{ar ? 'إتمام الحجز' : 'Proceed to checkout'} <ArrowRight size={17} /></Link>
            : <p className="cart-stale-note" role="note"><CircleAlert size={15} />{ar ? 'أزل الرحلات غير المتاحة للمتابعة.' : 'Remove the unavailable trips to continue.'}</p>}
          <Link href="/trips" className="outline-btn">{ar ? 'مواصلة التصفح' : 'Continue browsing'}</Link>
        </aside>
      </div>}
    </main>
  </SiteShell>
}
