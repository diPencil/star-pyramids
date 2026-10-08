'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, LayoutGrid, List, MapPin, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { catalogTours, getToursByCategory, tourCategories } from '@/data/tours'
import type { TourCategory } from '@/data/types'
import { matchPriceBand, tourListingSorts, tourPriceBands, type TourListingSort } from '@/lib/query'
import { Breadcrumb, HelpCTA, SiteShell, TourCard } from '@/components/site'
import { SharedSelect } from '@/components/shared-select'
import { formatPrice, tx, useLocale } from '@/components/locale'
import { useDbTours } from '@/lib/tours-client'

const categories = Object.keys(tourCategories) as TourCategory[]
const durations = ['day', 'short', 'long'] as const
type Duration = (typeof durations)[number]

const minNilePrice = Math.min(...getToursByCategory('nile-cruises').map((tour) => tour.price))

const baseCopy = {
  en: {
    title: 'Find your Egypt trip', subtitle: 'From one memorable day to a journey across the country. Explore every trip in one place.',
    all: 'All trips', search: 'Search trips', searchPlaceholder: 'Search by place or experience', filters: 'Filters', type: 'Trip type',
    destination: 'Destination', anyDestination: 'All destinations', duration: 'Duration', anyDuration: 'Any duration',
    durationLabels: ['One day', '2 to 4 days', '5 or more days'],     price: 'Price', anyPrice: 'Any price', clear: 'Clear filters', results: 'trips found',
    showing: 'Showing', of: 'of', sort: 'Sort by', sortLabels: ['Recommended', 'Price: low to high', 'Price: high to low'],
    grid: 'Grid view', list: 'List view', empty: 'No trips match these filters.', emptyHelp: 'Try another search or clear the filters.',
    previous: 'Previous page', next: 'Next page', page: 'Page',
  },
  ar: {
    title: 'اعثر على رحلتك في مصر', subtitle: 'من يوم واحد مميز إلى رحلة بين مدن مصر. تصفح كل الرحلات في مكان واحد.',
    all: 'كل الرحلات', search: 'ابحث عن رحلة', searchPlaceholder: 'ابحث عن مكان أو تجربة', filters: 'الفلاتر', type: 'نوع الرحلة',
    destination: 'الوجهة', anyDestination: 'كل الوجهات', duration: 'المدة', anyDuration: 'أي مدة',
    durationLabels: ['يوم واحد', '٢ إلى ٤ أيام', '٥ أيام أو أكثر'], price: 'السعر', anyPrice: 'أي سعر', clear: 'مسح الفلاتر', results: 'رحلة متاحة',
    showing: 'عرض', of: 'من', sort: 'الترتيب', sortLabels: ['الموصى بها', 'السعر: من الأقل', 'السعر: من الأعلى'],
    grid: 'عرض شبكي', list: 'عرض قائمة', empty: 'لا توجد رحلات تطابق بحثك.', emptyHelp: 'جرّب بحثًا آخر أو امسح الفلاتر.',
    previous: 'الصفحة السابقة', next: 'الصفحة التالية', page: 'صفحة',
  },
} as const

const copy = { ...baseCopy,
  es: { ...baseCopy.en,
    title: 'Encuentra tu viaje por Egipto', subtitle: 'De un día memorable a un viaje por todo el país. Explora todos los viajes en un solo lugar.',
    all: 'Todos los viajes', search: 'Buscar viajes', searchPlaceholder: 'Busca por lugar o experiencia', filters: 'Filtros', type: 'Tipo de viaje',
    destination: 'Destino', anyDestination: 'Todos los destinos', duration: 'Duración', anyDuration: 'Cualquier duración',
    durationLabels: ['Un día', '2 a 4 días', '5 o más días'], price: 'Precio', anyPrice: 'Cualquier precio', clear: 'Borrar filtros', results: 'viajes encontrados',
    showing: 'Mostrando', of: 'de', sort: 'Ordenar por', sortLabels: ['Recomendados', 'Precio: de menor a mayor', 'Precio: de mayor a menor'],
    grid: 'Vista de cuadrícula', list: 'Vista de lista', empty: 'Ningún viaje coincide con estos filtros.', emptyHelp: 'Prueba otra búsqueda o borra los filtros.',
    previous: 'Página anterior', next: 'Página siguiente', page: 'Página',
  },
  it: { ...baseCopy.en,
    title: 'Trova il tuo viaggio in Egitto', subtitle: 'Da un giorno memorabile a un viaggio in tutto il paese. Esplora tutti i viaggi in un unico luogo.',
    all: 'Tutti i viaggi', search: 'Cerca viaggi', searchPlaceholder: 'Cerca per luogo o esperienza', filters: 'Filtri', type: 'Tipo di viaggio',
    destination: 'Destinazione', anyDestination: 'Tutte le destinazioni', duration: 'Durata', anyDuration: 'Qualsiasi durata',
    durationLabels: ['Un giorno', 'Da 2 a 4 giorni', '5 o più giorni'], price: 'Prezzo', anyPrice: 'Qualsiasi prezzo', clear: 'Cancella i filtri', results: 'viaggi trovati',
    showing: 'Visualizzati', of: 'di', sort: 'Ordina per', sortLabels: ['Consigliati', 'Prezzo: dal più basso', 'Prezzo: dal più alto'],
    grid: 'Vista griglia', list: 'Vista elenco', empty: 'Nessun viaggio corrisponde a questi filtri.', emptyHelp: 'Prova un’altra ricerca o cancella i filtri.',
    previous: 'Pagina precedente', next: 'Pagina successiva', page: 'Pagina',
  },
} as const

function durationMatches(value: string, filter: Duration) {
  const days = /\b(\d+)\s*(days?|nights?)\b/i.exec(value)
  if (filter === 'day') return /\bday\b|\bhours?\b/i.test(value) && (!days || Number(days[1]) === 1)
  if (!days) return false
  const count = Number(days[1])
  return filter === 'short' ? count >= 2 && count <= 4 : count >= 5
}

function TripsContent() {
  const { currency, locale } = useLocale()
  const liveCatalog = useDbTours(catalogTours)
  const destinationOptions = [...new Set(liveCatalog.flatMap((tour) => tour.location.split(',').map((place) => place.trim())))].sort()
  const nilePrices = liveCatalog.filter((tour) => tour.category === 'nile-cruises').map((tour) => tour.price)
  const liveMinNilePrice = nilePrices.length ? Math.min(...nilePrices) : minNilePrice
  const t = copy[locale]
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCategory = searchParams.get('category')
  const category = categories.find((item) => item === rawCategory) ?? ''
  const rawDestination = searchParams.get('destination')
  const destination = destinationOptions.find((item) => item === rawDestination) ?? ''
  const rawDuration = searchParams.get('duration')
  const duration = durations.find((item) => item === rawDuration) ?? ''
  const rawPrice = searchParams.get('price')
  const price = tourPriceBands.find((item) => item.id && item.id === rawPrice)?.id ?? ''
  const rawSort = searchParams.get('sort')
  const sort: TourListingSort = tourListingSorts.find((item) => item === rawSort) ?? 'Recommended'
  const q = (searchParams.get('q') ?? '').trim().slice(0, 120)
  const rawPage = Number(searchParams.get('page'))
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 999 ? rawPage : 1
  const [search, setSearch] = useState(q)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  useEffect(() => setSearch(q), [q])

  const update = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    if (!('page' in next)) params.delete('page')
    const query = params.toString()
    router.replace(`/trips${query ? `?${query}` : ''}`, { scroll: false })
  }

  const term = q.toLocaleLowerCase()
  const filtered = liveCatalog.filter((tour) =>
    (!category || tour.category === category) &&
    (!destination || tour.location.split(',').some((place) => place.trim() === destination)) &&
    (!duration || durationMatches(tour.duration, duration)) &&
    matchPriceBand(tour.price, price) &&
    (!term || [tour.title, tour.location, tour.summary, tour.travelStyle ?? ''].some((value) => value.toLocaleLowerCase().includes(term)))
  )
  const sorted = [...filtered].sort((a, b) => sort === 'Price: low to high' ? a.price - b.price : sort === 'Price: high to low' ? b.price - a.price : 0)
  const perPage = 9
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * perPage
  const visible = sorted.slice(start, start + perPage)
  const activeCount = [category, destination, duration, price, q].filter(Boolean).length

  return <>
    <div className="trips-intro">
      <div className="container trips-intro-inner">
        <div>
          <span className="trips-eyebrow">STAR PYRAMIDS, EGYPT</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <div className="trips-intro-count"><strong>{liveCatalog.length}</strong><span>{t.all}</span></div>
      </div>
    </div>
    <main className="container trips-page">
      <form className="trips-search" role="search" onSubmit={(event) => { event.preventDefault(); update({ q: search.trim().slice(0, 120) }) }}>
        <div className="trips-search-field">
          <Search size={21} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} aria-label={t.search} maxLength={120} />
        </div>
        <button type="submit">{t.search}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <div className="trips-layout">
        <aside className="trips-filters" aria-label={t.filters}>
          <div className="trips-filter-head"><h2><SlidersHorizontal size={19}/>{t.filters}{activeCount > 0 && <span>{activeCount}</span>}</h2><button type="button" onClick={() => { setSearch(''); router.replace('/trips', { scroll: false }) }}>{t.clear}</button></div>
          <fieldset className="trips-filter-group"><legend>{t.type}</legend>
            <label><input type="radio" name="trip-category" checked={!category} onChange={() => update({ category: '' })}/><span>{t.all}</span><small>{liveCatalog.length}</small></label>
            {categories.map((item) => <label key={item}><input type="radio" name="trip-category" checked={category === item} onChange={() => update({ category: item })}/><span>{tx(locale, { en: tourCategories[item].title, es: ({ 'one-day-tours': 'Circuitos de un día', 'multi-days-tours': 'Viajes de varios días', 'nile-cruises': 'Cruceros por el Nilo', 'shore-excursions': 'Excursiones en tierra' } as Record<TourCategory, string>)[item], it: ({ 'one-day-tours': 'Tour di un giorno', 'multi-days-tours': 'Viaggi di più giorni', 'nile-cruises': 'Crociere sul Nilo', 'shore-excursions': 'Escursioni a terra' } as Record<TourCategory, string>)[item], ar: ({ 'one-day-tours': 'رحلات اليوم الواحد', 'multi-days-tours': 'رحلات متعددة الأيام', 'nile-cruises': 'كروز النيل', 'shore-excursions': 'الرحلات الشاطئية' } as Record<TourCategory, string>)[item] })}</span><small>{liveCatalog.filter((tour) => tour.category === item).length}</small></label>)}
          </fieldset>
          <div className="trips-filter-group"><label className="trips-select-label" htmlFor="trips-destination">{t.destination}</label><div className="trips-select"><MapPin size={17}/><SharedSelect id="trips-destination" value={destination} onChange={(next) => update({ destination: next })} locale={locale} options={[{ value: '', label: t.anyDestination }, ...destinationOptions.map((place) => ({ value: place, label: place }))]} /></div></div>
          <div className="trips-filter-group"><label className="trips-select-label" htmlFor="trips-duration">{t.duration}</label><div className="trips-select"><SharedSelect id="trips-duration" value={duration} onChange={(next) => update({ duration: next })} locale={locale} options={[{ value: '', label: t.anyDuration }, ...durations.map((item, index) => ({ value: item, label: t.durationLabels[index] }))]} /></div></div>
          <div className="trips-filter-group"><label className="trips-select-label" htmlFor="trips-price">{t.price}</label><div className="trips-select"><SharedSelect id="trips-price" value={price} onChange={(next) => update({ price: next })} locale={locale} options={[{ value: '', label: t.anyPrice }, ...tourPriceBands.slice(1).map((band) => {const lo = formatPrice(200, currency, locale); const hi = formatPrice(400, currency, locale); const label = band.id === 'under-200' ? tx(locale, { en: `Under ${lo}`, es: `Menos de ${lo}`, it: `Meno di ${lo}`, ar: `أقل من ${lo}` }) : band.id === '200-400' ? `${lo} - ${hi}` : tx(locale, { en: `Over ${hi}`, es: `Más de ${hi}`, it: `Più di ${hi}`, ar: `أكثر من ${hi}` }); return { value: band.id, label }})]} /></div></div>
          <div className="trips-promo">
            <span className="trips-promo-badge"><Sparkles size={14}/>{tx(locale, { en: 'Explore the Nile', es: 'Explora el Nilo', it: 'Esplora il Nilo', ar: 'استكشف النيل' })}</span>
            <h3>{tx(locale, { en: 'Nile journeys between Luxor and Aswan', es: 'Viajes por el Nilo entre Luxor y Asuán', it: 'Viaggi sul Nilo tra Luxor e Assuan', ar: 'رحلات نيلية بين الأقصر وأسوان' })}</h3>
            <p>{tx(locale, { en: 'Compare routes and trip lengths to find your preferred journey.', es: 'Compara rutas y duraciones para encontrar tu viaje ideal.', it: 'Confronta itinerari e durate per trovare il tuo viaggio ideale.', ar: 'قارن المسارات والمدد المختلفة واختر الرحلة المناسبة لك.' })}</p>
            <div className="trips-promo-price">{tx(locale, { en: 'Starting from', es: 'Desde', it: 'A partire da', ar: 'يبدأ من' })} <strong>{formatPrice(liveMinNilePrice, currency, locale)}</strong></div>
            <Link className="trips-promo-btn" href="/egypt-tours/nile-cruises">{tx(locale, { en: 'Browse Nile Cruises', es: 'Ver cruceros por el Nilo', it: 'Sfoglia le crociere sul Nilo', ar: 'تصفّح رحلات النيل' })} <ArrowRight size={15}/></Link>
          </div>
        </aside>
        <div className="trips-catalog">
          <div className="trips-toolbar"><div><strong role="status">{filtered.length} {t.results}</strong><span>{filtered.length ? `${t.showing} ${start + 1}-${Math.min(start + perPage, sorted.length)} ${t.of} ${sorted.length}` : ''}</span></div><div className="trips-toolbar-actions"><label>{t.sort}<SharedSelect value={sort} onChange={(next) => update({ sort: next })} locale={locale} options={tourListingSorts.map((item, index) => ({ value: item, label: t.sortLabels[index] }))} /></label><div className="trips-view" role="group" aria-label={tx(locale, { en: 'View mode', es: 'Modo de vista', it: 'Modalità di visualizzazione', ar: 'طريقة العرض' })}><button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label={t.grid} aria-pressed={view === 'grid'} title={t.grid}><LayoutGrid size={18}/></button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label={t.list} aria-pressed={view === 'list'} title={t.list}><List size={18}/></button></div></div></div>
          {visible.length ? <div className={`trips-results ${view}`}>{visible.map((tour) => <TourCard key={tour.slug} tour={tour} variant={tourCategories[tour.category].variant}/>)}</div> : <div className="trips-empty"><Search size={32}/><h2>{t.empty}</h2><p>{t.emptyHelp}</p><button type="button" onClick={() => { setSearch(''); router.replace('/trips', { scroll: false }) }}><X size={16}/>{t.clear}</button></div>}
          {totalPages > 1 && <nav className="trips-pagination" aria-label={tx(locale, { en: 'Trip pages', es: 'Páginas de viajes', it: 'Pagine dei viaggi', ar: 'صفحات الرحلات' })}><button type="button" onClick={() => update({ page: String(safePage - 1) })} disabled={safePage === 1} aria-label={t.previous}><ArrowRight className="trips-prev-icon" size={17}/></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button key={number} type="button" className={number === safePage ? 'active' : ''} onClick={() => update({ page: String(number) })} aria-label={`${t.page} ${number}`} aria-current={number === safePage ? 'page' : undefined}>{number}</button>)}<button type="button" onClick={() => update({ page: String(safePage + 1) })} disabled={safePage === totalPages} aria-label={t.next}><ArrowRight size={17}/></button></nav>}
        </div>
      </div>
    </main>
    <HelpCTA/>
  </>
}

export function TripsPage() {
  return <SiteShell><Breadcrumb items={['Trips']}/><Suspense fallback={<main className="container trips-page" aria-busy="true"/>}><TripsContent/></Suspense></SiteShell>
}
