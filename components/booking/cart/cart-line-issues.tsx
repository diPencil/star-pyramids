'use client'

import Link from 'next/link'
import { tx, useLocale } from '../../locale'
import { removeCartAddons, removeFromCart } from '@/lib/booking/cart'
import type { ResolvedCartLine } from '@/lib/booking/booking'

export function CartLineIssues({ line }: { line: Pick<ResolvedCartLine, 'item' | 'duplicateSelection' | 'invalidTravelers' | 'invalidPrice' | 'unavailableAddons' | 'onRequestAddons'> }) {
  const { locale } = useLocale()
  return <>
    {line.duplicateSelection && <div className="cart-stale-note" role="alert"><p>{tx(locale, { en: 'This trip selection is already in your cart, possibly under an older URL.', es: 'Esta selección ya está en el carrito, posiblemente con una URL anterior.', it: 'Questa selezione è già nel carrello, forse con un URL precedente.' })}</p><button type="button" className="outline-btn" onClick={() => removeFromCart(line.item.key)}>{tx(locale, { en: 'Remove duplicate selection', es: 'Quitar la selección duplicada', it: 'Rimuovi la selezione duplicata' })}</button></div>}
    {line.invalidTravelers && <p className="cart-stale-note" role="alert">{tx(locale, { en: 'Use 1–50 adults, 0–50 children/infants and at most 60 travelers in total.', es: 'Usa 1–50 adultos, 0–50 niños/bebés y un máximo de 60 viajeros en total.', it: 'Usa 1–50 adulti, 0–50 bambini/neonati e al massimo 60 viaggiatori in totale.' })} <Link href={`/egypt-tours/${line.item.tourSlug}`} className="text-link">{tx(locale, { en: 'Update trip selection', es: 'Actualizar la selección', it: 'Aggiorna la selezione' })}</Link></p>}
    {line.invalidPrice && <p className="cart-stale-note" role="alert">{tx(locale, { en: 'The current price cannot be confirmed. Please contact our team.', es: 'No se puede confirmar el precio actual. Contacta con nuestro equipo.', it: 'Il prezzo attuale non può essere confermato. Contatta il nostro team.' })}</p>}
    {line.unavailableAddons.length > 0 && <div className="cart-stale-note" role="alert"><p>{tx(locale, { en: 'These extras are no longer available:', es: 'Estos extras ya no están disponibles:', it: 'Questi extra non sono più disponibili:' })} {line.unavailableAddons.join(', ')}</p><button type="button" className="outline-btn" onClick={() => removeCartAddons(line.item.key, line.unavailableAddons)}>{tx(locale, { en: 'Remove unavailable extras', es: 'Quitar extras no disponibles', it: 'Rimuovi gli extra non disponibili' })}</button></div>}
    {line.onRequestAddons.length > 0 && <p className="cart-stale-note" role="note">{tx(locale, { en: 'Extras on request are not confirmed or included in this total. Our team must confirm their prices and availability separately.', es: 'Los extras a petición no están confirmados ni incluidos en este total. Nuestro equipo debe confirmar sus precios y disponibilidad por separado.', it: 'Gli extra su richiesta non sono confermati né inclusi in questo totale. Il team deve confermare prezzi e disponibilità separatamente.' })}</p>}
  </>
}
