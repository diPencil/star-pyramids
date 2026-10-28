'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'
import { useDbTours, useDbToursStatus } from '@/lib/tours-client'
import { usePublicDestinationsStatus } from '@/lib/catalogue-client'
import { useDbEvents, useDbEventsStatus } from '@/lib/events-cars-client'
import { useDbBlogs, useDbOffers, useDbOffersStatus, usePublicBlogsStatus } from '@/lib/offers-blogs-client'
import { parseSearchQuery } from '@/lib/query'
import { searchPublishedContent, type SearchResult } from '@/lib/site-search'
import { SiteShell } from './site'
import { tx, useLocale } from './locale'

export function SearchPage() {
  const initial = parseSearchQuery(useSearchParams()).q
  const [query, setQuery] = useState(initial)
  useEffect(() => setQuery(initial), [initial])
  const { locale } = useLocale()
  const tours = useDbTours([], { includeNew: true })
  const tourStatus = useDbToursStatus([], { includeNew: true })
  const destinations = usePublicDestinationsStatus()
  const events = useDbEvents([])
  const eventStatus = useDbEventsStatus()
  const offers = useDbOffers([])
  const offerStatus = useDbOffersStatus()
  const blogs = useDbBlogs([])
  const blogStatus = usePublicBlogsStatus()
  const statuses = [tourStatus, destinations, eventStatus, offerStatus, blogStatus]
  const loading = statuses.some(status => status.loading || status.data === null && !status.error)
  const failed = statuses.filter(status => status.error)
  const results = searchPublishedContent({ tours, destinations: destinations.data ?? [], events, offers, blogs }, query)
  const typeLabel = (type: SearchResult['type']) => ({
    Tour: tx(locale, { en: 'Tour', es: 'Circuito', it: 'Tour' }),
    Destination: tx(locale, { en: 'Destination', es: 'Destino', it: 'Destinazione' }),
    Event: tx(locale, { en: 'Event', es: 'Evento', it: 'Evento' }),
    Offer: tx(locale, { en: 'Offer', es: 'Oferta', it: 'Offerta' }),
    Blog: tx(locale, { en: 'Blog', es: 'Blog', it: 'Blog' }),
  })[type]
  return <SiteShell><main className="search-page container">
    <div className="search-page-header">
      <span className="eyebrow">{tx(locale, { en: 'Explore the site', es: 'Descubre el sitio', it: 'Esplora il sito' })}</span>
      <h1>{tx(locale, { en: 'Find your next Egypt story', es: 'Encuentra tu próxima historia en Egipto', it: 'Trova la tua prossima storia in Egitto' })}</h1>
      <label><Search size={20}/><input autoFocus value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder={tx(locale, { en: 'Search tours, destinations, stories...', es: 'Busca excursiones, destinos, historias...', it: 'Cerca tour, destinazioni, storie...' })} aria-label={tx(locale, { en: 'Search', es: 'Buscar', it: 'Cerca' })}/></label>
    </div>
    <div className="search-results" aria-busy={loading}>
      {loading && <p role="status">{tx(locale, { en: 'Loading search results…', es: 'Cargando resultados…', it: 'Caricamento risultati…' })}</p>}
      {failed.length > 0 && <div role="alert"><p>{tx(locale, { en: 'Some results could not be loaded. Please try again.', es: 'No se pudieron cargar algunos resultados. Inténtalo de nuevo.', it: 'Impossibile caricare alcuni risultati. Riprova.' })}</p><button type="button" className="outline-btn" onClick={() => failed.forEach(status => status.retry())}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova' })}</button></div>}
      {!loading && failed.length === 0 && <p role="status">{tx(locale, { en: `${results.length} result${results.length === 1 ? '' : 's'}`, es: `${results.length} resultado${results.length === 1 ? '' : 's'}`, it: `${results.length} risultat${results.length === 1 ? 'o' : 'i'}` })}{query.trim() ? tx(locale, { en: ` for "${query.trim()}"`, es: ` para "${query.trim()}"`, it: ` per "${query.trim()}"` }) : ''}</p>}
      {!loading && failed.length === 0 && results.length === 0 && <p>{tx(locale, { en: 'No matching results. Try another place or keyword.', es: 'No hay resultados. Prueba otro lugar o palabra clave.', it: 'Nessun risultato. Prova un altro luogo o una parola chiave.' })}</p>}
      <div className="content-grid">{results.map(item => <article className="content-card" key={`${item.type}-${item.slug}`}>
        {item.image && <img className="content-image" src={item.image} alt={item.title}/>}
        <div className="content-card-body"><small>{typeLabel(item.type)}</small><h3>{item.title}</h3><p>{item.copy}</p><Link href={item.href} className="text-link">{tx(locale, { en: 'Explore', es: 'Descubrir', it: 'Scopri' })} <ArrowRight size={15}/></Link></div>
      </article>)}</div>
    </div>
  </main></SiteShell>
}
