'use client'

import { tx, useLocale } from './locale'

/** A failed or pending read is not proof that a customer's selected tour disappeared. */
export function CartCatalogueStatus({ error, retry }: { error: string | null; retry: () => void }) {
  const { locale } = useLocale()
  return <div className="cart-empty" role={error ? 'alert' : 'status'} aria-live="polite">
    <h2>{error
      ? tx(locale, { en: 'Unable to check your trips', es: 'No se pudieron comprobar tus viajes', it: 'Impossibile verificare i tuoi viaggi' })
      : tx(locale, { en: 'Checking your trips…', es: 'Comprobando tus viajes…', it: 'Verifica dei tuoi viaggi…' })}</h2>
    <p>{error
      ? tx(locale, { en: 'Your cart is saved. Retry to load current availability and prices.', es: 'Tu carrito está guardado. Reintenta para cargar la disponibilidad y los precios actuales.', it: 'Il carrello è conservato. Riprova per caricare disponibilità e prezzi attuali.' })
      : tx(locale, { en: 'Loading the current tour catalogue and prices.', es: 'Cargando el catálogo y los precios actuales.', it: 'Caricamento del catalogo e dei prezzi attuali.' })}</p>
    {error && <button type="button" className="outline-btn" onClick={retry}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova' })}</button>}
  </div>
}
