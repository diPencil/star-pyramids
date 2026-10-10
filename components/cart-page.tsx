'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, CalendarDays, CircleAlert, ShoppingCart, Trash2, Users } from 'lucide-react'
import { Breadcrumb, SiteShell } from '@/components/site'
import { formatPrice, tx, useLocale } from './locale'
import { clearCart, removeFromCart, useCart } from '@/lib/cart'
import { estimateCart } from '@/lib/booking'

export function CartPage() {
  const { currency, locale } = useLocale()
  const { items } = useCart()
  const estimate = useMemo(() => estimateCart(items), [items])
  const openDateLabel = tx(locale, { en: 'Open date', es: 'Fecha abierta', it: 'Data aperta', ar: 'التاريخ مفتوح' })
  const removeLabel = tx(locale, { en: 'Remove from cart', es: 'Quitar del carrito', it: 'Rimuovi dal carrello', ar: 'إزالة من السلة' })

  return <SiteShell>
    <Breadcrumb items={[tx(locale, { en: 'Cart', es: 'Carrito', it: 'Carrello', ar: 'سلة الرحلات' })]} />
    <main className="container cart-page">
      <header className="car-request-head">
        <span className="eyebrow">{tx(locale, { en: 'Your selected trips', es: 'Tus viajes seleccionados', it: 'I tuoi viaggi selezionati', ar: 'رحلاتك المختارة' })}</span>
        <h1>{tx(locale, { en: 'Trip cart', es: 'Carrito de viajes', it: 'Carrello viaggi', ar: 'سلة الرحلات' })}</h1>
      </header>
      {!items.length ? <div className="cart-empty">
        <ShoppingCart size={40} />
        <h2>{tx(locale, { en: 'Your cart is empty', es: 'Tu carrito está vacío', it: 'Il tuo carrello è vuoto', ar: 'سلة الرحلات فارغة' })}</h2>
        <p>{tx(locale, { en: 'Browse the tours and add what you like to review it here.', es: 'Explora los tours y añade lo que te guste para revisarlo aquí.', it: 'Sfoglia i tour e aggiungi ciò che ti piace per rivederlo qui.', ar: 'تصفح الرحلات وأضف ما يعجبك لمراجعته هنا.' })}</p>
        <Link href="/trips" className="primary-btn">{tx(locale, { en: 'Browse trips', es: 'Explorar viajes', it: 'Sfoglia i viaggi', ar: 'تصفح الرحلات' })} <ArrowRight size={17} /></Link>
      </div> : <div className="cart-layout">
        <div className="cart-items">
          {estimate.validLines.map(({ item, adultUnit, childUnit, infantUnit, canonicalTotal, pricedAddons, onRequestAddons }) => <article key={item.key} className="cart-item">
            <img src={item.image} alt={item.title} loading="lazy" />
            <div>
              <div className="cart-line-top"><Link href={`/egypt-tours/${item.tourSlug}`}><b>{item.title}</b></Link><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={removeLabel}><Trash2 size={16} /></button></div>
              <div className="cart-meta">
                <span><CalendarDays size={14} />{item.date || openDateLabel} {item.date ? tx(locale, { en: '(preferred)', es: '(preferida)', it: '(preferita)', ar: '(مفضل)' }) : ''}</span>
                <span><Users size={14} />{item.adults} {tx(locale, { en: 'adult(s)', es: 'adultos', it: 'adulti', ar: 'بالغون' })}, {item.children} {tx(locale, { en: 'child(ren)', es: 'niños', it: 'bambini', ar: 'أطفال' })}, {item.infants} {tx(locale, { en: 'infant(s)', es: 'bebés', it: 'neonati', ar: 'رضّع' })}</span>
              </div>
              {(pricedAddons.length > 0 || onRequestAddons.length > 0) && <div className="cart-addons">
                {pricedAddons.map((a) => <span key={a}>{a}</span>)}
                {onRequestAddons.map((a) => <span key={a} className="on-request">{a} · {tx(locale, { en: 'on request', es: 'bajo petición', it: 'su richiesta', ar: 'حسب الطلب' })}</span>)}
              </div>}
              <div className="cart-line-bottom"><small>{formatPrice(adultUnit, currency, locale)}{tx(locale, { en: ' per adult', es: ' por adulto', it: ' per adulto', ar: ' للبالغ' })}{item.children > 0 && `${formatPrice(childUnit, currency, locale)}${tx(locale, { en: ' per child', es: ' por niño', it: ' per bambino', ar: ' للطفل' })}`}{item.infants > 0 && `${formatPrice(infantUnit, currency, locale)}${tx(locale, { en: ' per infant', es: ' por bebé', it: ' per neonato', ar: ' للرضيع' })}`}</small><strong>{formatPrice(canonicalTotal, currency, locale)}</strong></div>
            </div>
          </article>)}
          {estimate.staleLines.map(({ item }) => <article key={item.key} className="cart-item is-stale">
            <img src={item.image} alt="" loading="lazy" />
            <div>
              <div className="cart-line-top"><b>{item.title}</b><button type="button" className="cart-remove" onClick={() => removeFromCart(item.key)} aria-label={removeLabel}><Trash2 size={16} /></button></div>
              <p className="cart-stale-note" role="note"><CircleAlert size={15} />{tx(locale, { en: 'This trip is no longer available. Remove it from the cart to continue to checkout.', es: 'Este viaje ya no está disponible. Quítalo del carrito para seguir con la compra.', it: 'Questo viaggio non è più disponibile. Rimuovilo dal carrello per procedere al checkout.', ar: 'هذه الرحلة لم تعد متاحة. أزلها من السلة للمتابعة إلى الدفع.' })}</p>
            </div>
          </article>)}
          <button type="button" className="text-link" onClick={clearCart}>{tx(locale, { en: 'Clear cart', es: 'Vaciar carrito', it: 'Svuota carrello', ar: 'إفراغ السلة' })}</button>
        </div>
        <aside className="cart-summary">
          <h2>{tx(locale, { en: 'Order summary', es: 'Resumen del pedido', it: 'Riepilogo ordine', ar: 'ملخص الطلب' })}</h2>
          <div className="cart-summary-row"><span>{tx(locale, { en: 'Trips', es: 'Viajes', it: 'Viaggi', ar: 'عدد الرحلات' })}</span><strong>{estimate.validLines.length}</strong></div>
          {estimate.discount > 0 && <div className="cart-summary-row discount"><span>{tx(locale, { en: 'Deal savings', es: 'Ahorro por oferta', it: 'Risparmio offerta', ar: 'توفير العروض' })}</span><strong>−{formatPrice(estimate.discount, currency, locale)}</strong></div>}
          <div className="cart-summary-row total"><span>{tx(locale, { en: 'Estimated subtotal', es: 'Subtotal estimado', it: 'Subtotale stimato', ar: 'الإجمالي التقديري' })}</span><strong>{formatPrice(estimate.subtotal, currency, locale)}</strong></div>
          <p>{tx(locale, { en: 'Frontend estimate only. The final price, taxes, and fees are confirmed with our team before payment.', es: 'Solo estimación inicial. El precio final, impuestos y tasas se confirman con nuestro equipo antes del pago.', it: 'Solo stima iniziale. Prezzo finale, tasse e costi sono confermati con il nostro team prima del pagamento.', ar: 'تقدير مبدئي فقط. السعر النهائي والضرائب والرسوم تُؤكد مع فريقنا قبل الدفع.' })}</p>
          {estimate.validLines.length > 0
            ? <Link href="/checkout" className="primary-btn">{tx(locale, { en: 'Proceed to checkout', es: 'Proceder a la compra', it: 'Procedi al checkout', ar: 'إتمام الحجز' })} <ArrowRight size={17} /></Link>
            : <p className="cart-stale-note" role="note"><CircleAlert size={15} />{tx(locale, { en: 'Remove the unavailable trips to continue.', es: 'Quita los viajes no disponibles para continuar.', it: 'Rimuovi i viaggi non disponibili per continuare.', ar: 'أزل الرحلات غير المتاحة للمتابعة.' })}</p>}
          <Link href="/trips" className="outline-btn">{tx(locale, { en: 'Continue browsing', es: 'Seguir explorando', it: 'Continua a sfogliare', ar: 'مواصلة التصفح' })}</Link>
        </aside>
      </div>}
    </main>
  </SiteShell>
}
