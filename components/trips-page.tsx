'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, LayoutGrid, List, MapPin, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { catalogTours, getToursByCategory, tourCategories } from '@/data/tours'
import type { TourCategory } from '@/data/types'
import { matchPriceBand, tourListingSorts, tourPriceBands, type TourListingSort } from '@/lib/query'
import { Breadcrumb, HelpCTA, SiteShell, TourCard } from '@/components/site'
import { formatPrice, useLocale } from '@/components/locale'
import { useLiveTours } from '@/lib/admin-store'

const categories = Object.keys(tourCategories) as TourCategory[]
const destinations = [...new Set(catalogTours.flatMap((tour) => tour.location.split(',').map((place) => place.trim())))].sort()
const durations = ['day', 'short', 'long'] as const
type Duration = (typeof durations)[number]

const minNilePrice = Math.min(...getToursByCategory('nile-cruises').map((tour) => tour.price))

const copy = {
  en: {
    title: 'Find your Egypt trip', subtitle: 'From one memorable day to a journey across the country. Explore every trip in one place.',
    all: 'All trips', search: 'Search trips', searchPlaceholder: 'Search by place or experience', filters: 'Filters', type: 'Trip type',
    destination: 'Destination', anyDestination: 'All destinations', duration: 'Duration', anyDuration: 'Any duration',
    durationLabels: ['One day', '2-4 days / nights', '5+ days / nights'],     price: 'Price', anyPrice: 'Any price', clear: 'Clear filters', results: 'trips found',
    showing: 'Showing', of: 'of', sort: 'Sort by', sortLabels: ['Recommended', 'Price: low to high', 'Price: high to low'],
    grid: 'Grid view', list: 'List view', empty: 'No trips match these filters.', emptyHelp: 'Try another search or clear the filters.',
    previous: 'Previous page', next: 'Next page', page: 'Page',
  },
  ar: {
    title: 'اعثر على رحلتك في مصر', subtitle: 'من يوم واحد مميز إلى رحلة بين مدن مصر. تصفح كل الرحلات في مكان واحد.',
    all: 'كل الرحلات', search: 'ابحث عن رحلة', searchPlaceholder: 'ابحث عن مكان أو تجربة', filters: 'الفلاتر', type: 'نوع الرحلة',
    destination: 'الوجهة', anyDestination: 'كل الوجهات', duration: 'المدة', anyDuration: 'أي مدة',
    durationLabels: ['يوم واحد', '٢-٤ أيام / ليالٍ', '٥ أيام / ليالٍ أو أكثر'], price: 'السعر', anyPrice: 'أي سعر', clear: 'مسح الفلاتر', results: 'رحلة متاحة',
    showing: 'عرض', of: 'من', sort: 'الترتيب', sortLabels: ['الموصى بها', 'السعر: من الأقل', 'السعر: من الأعلى'],
    grid: 'عرض شبكي', list: 'عرض قائمة', empty: 'لا توجد رحلات تطابق بحثك.', emptyHelp: 'جرّب بحثًا آخر أو امسح الفلاتر.',
    previous: 'الصفحة السابقة', next: 'الصفحة التالية', page: 'صفحة',
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
  const liveCatalog = useLiveTours(catalogTours)
  const t = copy[locale]
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCategory = searchParams.get('category')
  const category = categories.find((item) => item === rawCategory) ?? ''
  const rawDestination = searchParams.get('destination')
  const destination = destinations.find((item) => item === rawDestination) ?? ''
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
        <div className="trips-intro-count"><strong>{catalogTours.length}</strong><span>{t.all}</span></div>
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
            <label><input type="radio" name="trip-category" checked={!category} onChange={() => update({ category: '' })}/><span>{t.all}</span><small>{catalogTours.length}</small></label>
            {categories.map((item) => <label key={item}><input type="radio" name="trip-category" checked={category === item} onChange={() => update({ category: item })}/><span>{locale === 'ar' ? ({ 'one-day-tours': 'رحلات اليوم الواحد', 'multi-days-tours': 'رحلات متعددة الأيام', 'nile-cruises': 'كروز النيل', 'shore-excursions': 'الرحلات الشاطئية' } as Record<TourCategory, string>)[item] : tourCategories[item].title}</span><small>{catalogTours.filter((tour) => tour.category === item).length}</small></label>)}
          </fieldset>
          <div className="trips-filter-group"><label className="trips-select-label" htmlFor="trips-destination">{t.destination}</label><div className="trips-select"><MapPin size={17}/><select id="trips-destination" value={destination} onChange={(event) => update({ destination: event.target.value })}><option value="">{t.anyDestination}</option>{destinations.map((place) => <option key={place} value={place}>{place}</option>)}</select></div></div>
          <div className="trips-filter-group"><label className="trips-select-label" htmlFor="trips-duration">{t.duration}</label><div className="trips-select"><select id="trips-duration" value={duration} onChange={(event) => update({ duration: event.target.value })}><option value="">{t.anyDuration}</option>{durations.map((item, index) => <option key={item} value={item}>{t.durationLabels[index]}</option>)}</select></div></div>
          <div className="trips-filter-group"><label className="trips-select-label" htmlFor="trips-price">{t.price}</label><div className="trips-select"><select id="trips-price" value={price} onChange={(event) => update({ price: event.target.value })}><option value="">{t.anyPrice}</option>{tourPriceBands.slice(1).map((band) => {const lo = formatPrice(200, currency, locale); const hi = formatPrice(400, currency, locale); const label = band.id === 'under-200' ? (locale === 'ar' ? `أقل من ${lo}` : `Under ${lo}`) : band.id === '200-400' ? `${lo} - ${hi}` : (locale === 'ar' ? `أكثر من ${hi}` : `Over ${hi}`); return <option key={band.id} value={band.id}>{label}</option>})}</select></div></div>
          <div className="trips-promo">
            <span className="trips-promo-badge"><Sparkles size={14}/>{locale === 'ar' ? 'استكشف النيل' : 'Explore the Nile'}</span>
            <h3>{locale === 'ar' ? 'رحلات نيلية بين الأقصر وأسوان' : 'Nile journeys between Luxor and Aswan'}</h3>
            <p>{locale === 'ar' ? 'قارن المسارات والمدد المختلفة واختر الرحلة المناسبة لك.' : 'Compare routes and trip lengths to find your preferred journey.'}</p>
            <div className="trips-promo-price">{locale === 'ar' ? 'يبدأ من' : 'Starting from'} <strong>{formatPrice(minNilePrice, currency, locale)}</strong></div>
            <Link className="trips-promo-btn" href="/egypt-tours/nile-cruises">{locale === 'ar' ? 'تصفّح رحلات النيل' : 'Browse Nile Cruises'} <ArrowRight size={15}/></Link>
          </div>
        </aside>
        <div className="trips-catalog">
          <div className="trips-toolbar"><div><strong role="status">{filtered.length} {t.results}</strong><span>{filtered.length ? `${t.showing} ${start + 1}-${Math.min(start + perPage, sorted.length)} ${t.of} ${sorted.length}` : ''}</span></div><div className="trips-toolbar-actions"><label>{t.sort}<select value={sort} onChange={(event) => update({ sort: event.target.value })}>{tourListingSorts.map((item, index) => <option key={item} value={item}>{t.sortLabels[index]}</option>)}</select></label><div className="trips-view" role="group" aria-label={locale === 'ar' ? 'طريقة العرض' : 'View mode'}><button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label={t.grid} aria-pressed={view === 'grid'} title={t.grid}><LayoutGrid size={18}/></button><button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label={t.list} aria-pressed={view === 'list'} title={t.list}><List size={18}/></button></div></div></div>
          {visible.length ? <div className={`trips-results ${view}`}>{visible.map((tour) => <TourCard key={tour.slug} tour={tour} variant={tourCategories[tour.category].variant}/>)}</div> : <div className="trips-empty"><Search size={32}/><h2>{t.empty}</h2><p>{t.emptyHelp}</p><button type="button" onClick={() => { setSearch(''); router.replace('/trips', { scroll: false }) }}><X size={16}/>{t.clear}</button></div>}
          {totalPages > 1 && <nav className="trips-pagination" aria-label={locale === 'ar' ? 'صفحات الرحلات' : 'Trip pages'}><button type="button" onClick={() => update({ page: String(safePage - 1) })} disabled={safePage === 1} aria-label={t.previous}><ArrowRight className="trips-prev-icon" size={17}/></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <button key={number} type="button" className={number === safePage ? 'active' : ''} onClick={() => update({ page: String(number) })} aria-label={`${t.page} ${number}`} aria-current={number === safePage ? 'page' : undefined}>{number}</button>)}<button type="button" onClick={() => update({ page: String(safePage + 1) })} disabled={safePage === totalPages} aria-label={t.next}><ArrowRight size={17}/></button></nav>}
        </div>
      </div>
    </main>
    <HelpCTA/>
  </>
}

export function TripsPage() {
  return <SiteShell><Breadcrumb items={['Trips']}/><Suspense fallback={<main className="container trips-page" aria-busy="true"/>}><TripsContent/></Suspense></SiteShell>
}
