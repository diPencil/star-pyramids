'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'
import { usePublicSearch } from '@/lib/use-public-search'
import { parseSearchQuery } from '@/lib/query'
import { SEARCH_TYPE_LABELS } from '@/lib/site-search'
import { SiteShell } from './site'
import { tx, useLocale } from './locale'

export function SearchPage() {
  const initial = parseSearchQuery(useSearchParams()).q
  const [query, setQuery] = useState(initial)
  useEffect(() => setQuery(initial), [initial])
  const { locale } = useLocale()
  const { results, loading, failed, retry } = usePublicSearch(query)
  return <SiteShell><main className="search-page container">
    <div className="search-page-header">
      <span className="eyebrow">{tx(locale, { en: 'Explore the site', es: 'Descubre el sitio', it: 'Esplora il sito' })}</span>
      <h1>{tx(locale, { en: 'Find your next Egypt story', es: 'Encuentra tu próxima historia en Egipto', it: 'Trova la tua prossima storia in Egitto' })}</h1>
      <label><Search size={20}/><input autoFocus value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder={tx(locale, { en: 'Search tours, destinations, stories...', es: 'Busca excursiones, destinos, historias...', it: 'Cerca tour, destinazioni, storie...' })} aria-label={tx(locale, { en: 'Search', es: 'Buscar', it: 'Cerca' })}/></label>
    </div>
    <div className="search-results" aria-busy={loading}>
      {loading && <p role="status">{tx(locale, { en: 'Loading search results…', es: 'Cargando resultados…', it: 'Caricamento risultati…' })}</p>}
      {failed.length > 0 && <div role="alert"><p>{tx(locale, { en: 'Some results could not be loaded. Please try again.', es: 'No se pudieron cargar algunos resultados. Inténtalo de nuevo.', it: 'Impossibile caricare alcuni risultati. Riprova.' })}</p><button type="button" className="outline-btn" onClick={retry}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova' })}</button></div>}
      {!loading && failed.length === 0 && <p role="status">{tx(locale, { en: `${results.length} result${results.length === 1 ? '' : 's'}`, es: `${results.length} resultado${results.length === 1 ? '' : 's'}`, it: `${results.length} risultat${results.length === 1 ? 'o' : 'i'}` })}{query.trim() ? tx(locale, { en: ` for "${query.trim()}"`, es: ` para "${query.trim()}"`, it: ` per "${query.trim()}"` }) : ''}</p>}
      {!loading && failed.length === 0 && results.length === 0 && <p>{tx(locale, { en: 'No matching results. Try another place or keyword.', es: 'No hay resultados. Prueba otro lugar o palabra clave.', it: 'Nessun risultato. Prova un altro luogo o una parola chiave.' })}</p>}
      <div className="public-search-results-list">{results.map(item => <article className="public-search-result" key={`${item.type}-${item.slug}`}>
        {item.image && <Link href={item.href} className="public-search-result-image" tabIndex={-1} aria-hidden="true"><img src={item.image} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden' }}/></Link>}
        <div className="public-search-result-copy"><small>{tx(locale, SEARCH_TYPE_LABELS[item.type])}</small><h2><Link href={item.href}>{item.title}</Link></h2><p>{item.copy}</p><Link href={item.href} className="text-link">{tx(locale, { en: 'Open page', es: 'Abrir página', it: 'Apri pagina' })} <ArrowRight size={15}/></Link></div>
      </article>)}</div>
    </div>
  </main></SiteShell>
}
