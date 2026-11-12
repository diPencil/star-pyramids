'use client'

import { CmsPublicLink } from "@/components/cms/cms-public-link";
import { trackPublicInteraction } from "@/lib/tracking/tracking-events";
import { usePresentation, PresentationSection } from "@/components/cms/presentation-content-context";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Compass, Mail, MapPin, MessageCircle, Minus, Phone, Plus, Search, Share2, Sparkles, Ticket } from "lucide-react";
import { events } from "@/data/content";
import { useDbEvents } from "@/lib/catalogue/events-cars-client";
import { eventCity, eventMapQuery, eventPriceLabel, eventStatusLabel, getEventStatus, getPublishedEvents, getRelatedEvents, parseLegacyEventRange, resolveEventRange } from "@/lib/events/events";
import { formatCurrency } from "@/lib/payments/currency";
import { EventRequestForm } from "./event-request-form";
import type { Event } from "@/data/types";
import { useLocale, tx, type Locale } from "../locale";
import { Breadcrumb, SiteShell } from "@/components/site";
import { SharedSelect } from "@/components/shared/forms/shared-select";
import { telLink, whatsappLink } from "@/lib/core/phone";
import { useShowcaseHero } from "../cms/heroes/showcase-hero-context";
import { DetailNotFound } from "../content/public-content-pages"


/** Legacy aliases now backed by the structured helpers in `@/lib/events/events`. */
function parseEventRange(date: string): { start: Date | null; end: Date | null } {
  return parseLegacyEventRange(date)
}

function eventStatus(end: Date | null, locale: Locale, timestamp = Date.now()): string | null {
  if (!end) return null
  const today = new Date(timestamp)
  today.setHours(0, 0, 0, 0)
  return end >= today ? tx(locale, { en: 'Upcoming', es: 'Próximo', it: 'In arrivo', ar: 'قادم' }) : tx(locale, { en: 'Past', es: 'Finalizado', it: 'Concluso', ar: 'انتهى' })
}

const EVENT_IMAGE_FALLBACK = '/placeholder.jpg'

function eventImageSrc(image: string | undefined): string {
  return image && image.trim() ? image : EVENT_IMAGE_FALLBACK
}

function onEventImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget
  if (!el.src.endsWith('/placeholder.jpg')) el.src = '/placeholder.jpg'
}

export function EventCard({ item }: { item: Event }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const range = resolveEventRange(item)
  const badge = range.start ? { day: String(range.start.getDate()).padStart(2, '0'), mon: range.start.toLocaleString(locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-US', { month: 'short' }) } : null
  const status = getEventStatus(item)
  const statusLabel = eventStatusLabel(status, locale)
  const title = (locale === 'ar' ? item.titleAr : undefined) || item.title
  const copy = (locale === 'ar' ? item.copyAr : undefined) || item.copy
  const venue = (locale === 'ar' ? item.locationAr : undefined) || eventCity(item)
  const category = (locale === 'ar' ? item.categoryAr : undefined) || item.category
  return <article className="event-card">
    <Link href={`/events/${item.slug}`} className="event-card-img" aria-label={title}>
      <img src={eventImageSrc(item.image)} alt={title} loading="lazy" onError={onEventImageError} />
      {badge && <span className="event-date-badge"><b>{badge.day}</b><small>{badge.mon}</small></span>}
      {statusLabel && <span className={`event-card-status is-${status}`}>{statusLabel}</span>}
    </Link>
    <div className="event-card-body">
      <p className="event-card-date"><CalendarDays size={14} />{item.date}</p>
      {category && <p className="event-card-category">{category}</p>}
      <h3><Link href={`/events/${item.slug}`}>{title}</Link></h3>
      <p className="event-card-venue"><MapPin size={14} />{venue}</p>
      <p>{copy}</p>
      <p className="event-card-price">{eventPriceLabel(item, locale)}</p>
      <Link href={`/events/${item.slug}`} className="event-card-cta">{tx(locale, { en: 'Details & request', es: 'Detalles y solicitud', it: 'Dettagli e richiesta', ar: 'التفاصيل وطلب الحضور' })} <ArrowRight size={15} /></Link>
    </div>
  </article>
}

export function EventsPage() {
  return <SiteShell><EventsPageContent /></SiteShell>
}

const EVENTS_PAGE_SIZE = 6

function EventsPageContent() {
  const { locale } = useLocale()
  const heroState = useShowcaseHero()
  const heroContent = heroState?.content
  const heroText = heroContent && locale !== 'ar' ? heroContent.text[locale] : {}
  const ar = locale === 'ar'
  const liveEvents = useDbEvents(events)
  const published = useMemo(() => getPublishedEvents(liveEvents), [liveEvents])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [city, setCity] = useState('all')
  const [state, setState] = useState<'all' | 'upcoming' | 'past'>('all')
  const [sort, setSort] = useState<'soonest' | 'latest' | 'name'>('soonest')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => [...new Set(published.map((e) => ((locale === 'ar' ? e.categoryAr : undefined) || e.category)).filter(Boolean))] as string[], [published, ar])
  const cities = useMemo(() => [...new Set(published.map((e) => eventCity({ city: (locale === 'ar' ? e.cityAr : undefined) ?? e.city, location: (locale === 'ar' ? e.locationAr : undefined) ?? e.location })))].filter(Boolean), [published, ar])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    const rows = published.filter((item) => {
      const title = (locale === 'ar' ? item.titleAr : undefined) || item.title
      const copy = (locale === 'ar' ? item.copyAr : undefined) || item.copy
      if (q && !`${title} ${copy} ${item.location} ${item.city ?? ''} ${item.category ?? ''}`.toLowerCase().includes(q)) return false
      const itemCategory = (locale === 'ar' ? item.categoryAr : undefined) || item.category
      if (category !== 'all' && itemCategory !== category) return false
      const itemCity = eventCity({ city: (locale === 'ar' ? item.cityAr : undefined) ?? item.city, location: (locale === 'ar' ? item.locationAr : undefined) ?? item.location })
      if (city !== 'all' && itemCity !== city) return false
      const st = getEventStatus(item, now)
      if (state === 'upcoming' && !(st === 'upcoming' || st === 'ongoing')) return false
      if (state === 'past' && st !== 'past') return false
      return true
    })
    const withTime = rows.map((item) => ({ item, t: resolveEventRange(item).start?.getTime() ?? Number.MAX_SAFE_INTEGER }))
    if (sort === 'name') withTime.sort((a, b) => ((locale === 'ar' ? a.item.titleAr : undefined) || a.item.title).localeCompare(((locale === 'ar' ? b.item.titleAr : undefined) || b.item.title), locale === 'ar' ? 'ar' : locale === 'es' ? 'es' : locale === 'it' ? 'it' : 'en'))
    else if (sort === 'latest') withTime.sort((a, b) => b.t - a.t)
    else withTime.sort((a, b) => a.t - b.t)
    return withTime.map((r) => r.item)
  }, [published, query, category, city, state, sort, ar])

  const now = Date.now()
  const upcomingCount = published.filter((e) => { const s = getEventStatus(e, now); return s === 'upcoming' || s === 'ongoing' }).length
  const cityCount = new Set(published.map((e) => eventCity(e))).size
  const sortedAll = useMemo(() => [...published].map((item) => ({ item, t: resolveEventRange(item).start?.getTime() ?? Number.MAX_SAFE_INTEGER })).sort((a, b) => a.t - b.t), [published])
  const featured = sortedAll.find(({ item }) => { const s = getEventStatus(item, now); return s === 'upcoming' || s === 'ongoing' })?.item ?? sortedAll[0]?.item

  useEffect(() => { setPage(1) }, [query, category, city, state, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / EVENTS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * EVENTS_PAGE_SIZE, safePage * EVENTS_PAGE_SIZE)

  return <main>
    {!heroState?.hidden && !heroState?.unavailable && <section className="events-page-hero">
      {heroContent?.image || heroContent?.mobileImage ? <picture>{heroContent.mobileImage && <source media="(max-width: 760px)" srcSet={heroContent.mobileImage} />}<img className="hero-bg-img" src={heroContent.image || (featured ? eventImageSrc(featured.image) : EVENT_IMAGE_FALLBACK)} alt={locale !== 'ar' ? heroContent.alt[locale] : ''} onError={onEventImageError} style={heroContent.position !== 'source' ? { objectPosition: heroContent.position } : undefined} /></picture> : <img src={featured ? eventImageSrc(featured.image) : EVENT_IMAGE_FALLBACK} alt={heroContent && locale !== 'ar' ? heroContent.alt[locale] : ''} onError={onEventImageError} style={heroContent && heroContent.position !== 'source' ? { objectPosition: heroContent.position } : undefined} />}
      <div className="events-page-hero-shade" style={heroContent?.overlay != null ? { background: `rgba(10,32,76,${heroContent.overlay})` } : undefined} />
      <div className="container events-page-hero-content">
        <div className="events-page-hero-copy">
          <span className="eyebrow">{heroText.eyebrow ?? tx(locale, { en: 'Egypt events calendar', es: 'Calendario de eventos de Egipto', it: 'Calendario eventi dell\'Egitto', ar: 'أجندة فعاليات مصر' })}</span>
          <h1>{heroText.title ?? tx(locale, { en: 'Egypt events & seasonal journeys', es: 'Eventos y viajes de temporada en Egipto', it: 'Eventi e viaggi stagionali in Egitto', ar: 'فعاليات ورحلات موسمية تستحق السفر' })}</h1>
          <p>{heroText.intro ?? tx(locale, { en: 'Celebrations, cultural escapes, and limited-time experiences shaped around Egypt at its most alive.', es: 'Celebraciones, escapadas culturales y experiencias por tiempo limitado en torno al Egipto más vibrante.', it: 'Celebrazioni, fughe culturali ed esperienze a tempo limitato intorno all\'Egitto più vivo.', ar: 'احتفالات وعطلات ثقافية وتجارب محدودة التوقيت، مرتبة لتعيش مصر في أكثر لحظاتها حيوية.' })}</p>
          <div className="events-page-hero-actions">
            <a href={heroContent?.links.primaryHref ?? "#events-list"} className="primary-btn">{heroText.primaryLabel ?? tx(locale, { en: 'Explore upcoming events', es: 'Descubre los próximos eventos', it: 'Scopri i prossimi eventi', ar: 'استكشف الفعاليات' })} <ArrowRight size={17} /></a>
            {featured && <Link href={`/events/${featured.slug}`} className="events-hero-link">{heroText.secondaryLabel ?? tx(locale, { en: 'View the next event', es: 'Ver el próximo evento', it: 'Vedi il prossimo evento', ar: 'تفاصيل الفعالية القادمة' })} <ArrowRight size={16} /></Link>}
          </div>
        </div>
        <div className="events-hero-rail">
          {featured ? <Link href={`/events/${featured.slug}`} className="events-next-event">
            <span>{heroText.railLabel ?? tx(locale, { en: 'Next event', es: 'Próximo evento', it: 'Prossimo evento', ar: 'الفعالية القادمة' })}</span>
            <strong>{(locale === 'ar' ? featured.titleAr : undefined) || featured.title}</strong>
            <small><CalendarDays size={14} />{featured.date}<i aria-hidden="true"/><MapPin size={14} />{(locale === 'ar' ? featured.locationAr : undefined) || featured.location}</small>
          </Link> : <p className="events-next-empty">{tx(locale, { en: 'No published events right now.', es: 'No hay eventos publicados ahora mismo.', it: 'Nessun evento pubblicato al momento.', ar: 'لا توجد فعاليات منشورة حاليًا.' })}</p>}
          <div className="events-hero-stats" aria-label={heroText.statsLabel ?? tx(locale, { en: 'Events summary', es: 'Resumen de eventos', it: 'Riepilogo eventi', ar: 'ملخص الفعاليات' })}>
            <span><b>{upcomingCount}</b>{heroText.stat0 ?? tx(locale, { en: 'Upcoming events', es: 'Próximos eventos', it: 'Prossimi eventi', ar: 'فعاليات قادمة' })}</span>
            <span><b>{cityCount}</b>{heroText.stat1 ?? tx(locale, { en: 'Egyptian cities', es: 'Ciudades egipcias', it: 'Città egiziane', ar: 'مدن مصرية' })}</span>
          </div>
        </div>
      </div>
    </section>}
    <div id="events-list" className="section container">
      {published.length === 0 ? (
        <div className="account-empty events-empty" role="status">
          <h3>{tx(locale, { en: 'No published events right now', es: 'Sin eventos publicados ahora mismo', it: 'Nessun evento pubblicato al momento', ar: 'لا توجد فعاليات منشورة حاليًا' })}</h3>
          <p>{tx(locale, { en: 'Check back soon for upcoming events across Egypt.', es: 'Vuelve pronto para ver los próximos eventos en Egipto.', it: 'Torna presto per i prossimi eventi in Egitto.', ar: 'تابعنا قريبًا لاكتشاف أجندة الفعاليات القادمة في مصر.' })}</p>
          <Link href="/make-your-trip" className="primary-btn">{tx(locale, { en: 'Make your trip', es: 'Crea tu viaje', it: 'Crea il tuo viaggio', ar: 'خطط رحلتك' })} <ArrowRight size={17} /></Link>
        </div>
      ) : (
        <>
          <div className="events-discovery" role="search" aria-label={tx(locale, { en: 'Search events', es: 'Buscar eventos', it: 'Cerca eventi', ar: 'البحث في الفعاليات' })}>
            <label className="events-discovery-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value.slice(0, 120))} placeholder={tx(locale, { en: 'Search events or cities...', es: 'Busca eventos o ciudades...', it: 'Cerca eventi o città...', ar: 'ابحث عن فعالية أو مدينة...' })} aria-label={tx(locale, { en: 'Search', es: 'Buscar', it: 'Cerca', ar: 'بحث' })} /></label>
            <div className="events-discovery-filters">
              <label>{tx(locale, { en: 'Category', es: 'Categoría', it: 'Categoria', ar: 'التصنيف' })}<SharedSelect value={category} onChange={setCategory} locale={locale} options={[{ value: 'all', label: tx(locale, { en: 'All categories', es: 'Todas las categorías', it: 'Tutte le categorie', ar: 'كل التصنيفات' }) }, ...categories.map((c) => ({ value: c, label: c }))]} /></label>
              <label>{tx(locale, { en: 'City', es: 'Ciudad', it: 'Città', ar: 'المدينة' })}<SharedSelect value={city} onChange={setCity} locale={locale} options={[{ value: 'all', label: tx(locale, { en: 'All cities', es: 'Todas las ciudades', it: 'Tutte le città', ar: 'كل المدن' }) }, ...cities.map((c) => ({ value: c, label: c }))]} /></label>
              <label>{tx(locale, { en: 'Status', es: 'Estado', it: 'Stato', ar: 'الحالة' })}<SharedSelect value={state} onChange={(next) => setState(next as typeof state)} locale={locale} options={[{ value: 'all', label: tx(locale, { en: 'All', es: 'Todos', it: 'Tutti', ar: 'الكل' }) }, { value: 'upcoming', label: tx(locale, { en: 'Upcoming', es: 'Próximos', it: 'Prossimi', ar: 'القادمة' }) }, { value: 'past', label: tx(locale, { en: 'Past', es: 'Pasados', it: 'Passati', ar: 'السابقة' }) }]} /></label>
              <label>{tx(locale, { en: 'Sort', es: 'Ordenar', it: 'Ordina', ar: 'الترتيب' })}<SharedSelect value={sort} onChange={(next) => setSort(next as typeof sort)} locale={locale} options={[{ value: 'soonest', label: tx(locale, { en: 'Soonest', es: 'Más próximos', it: 'I più vicini', ar: 'الأقرب' }) }, { value: 'latest', label: tx(locale, { en: 'Latest', es: 'Más lejanos', it: 'I più lontani', ar: 'الأبعد' }) }, { value: 'name', label: tx(locale, { en: 'Name', es: 'Nombre', it: 'Nome', ar: 'الاسم' }) }]} /></label>
            </div>
          </div>
          <p className="events-results-count" role="status">{tx(locale, { en: `${filtered.length} event${filtered.length === 1 ? '' : 's'}`, es: `${filtered.length} evento${filtered.length === 1 ? '' : 's'}`, it: `${filtered.length} evento${filtered.length === 1 ? '' : 'i'}`, ar: `${filtered.length} فعالية` })}</p>
          {pageRows.length ? <div className="event-grid">{pageRows.map((item) => <EventCard item={item} key={item.slug} />)}</div> : (
            <div className="account-empty events-empty" role="status">
              <h3>{tx(locale, { en: 'No matching events', es: 'Sin eventos coincidentes', it: 'Nessun evento corrispondente', ar: 'لا توجد نتائج مطابقة' })}</h3>
              <p>{tx(locale, { en: 'Try changing the search or filters.', es: 'Prueba a cambiar la búsqueda o los filtros.', it: 'Prova a modificare la ricerca o i filtri.', ar: 'جرب تغيير البحث أو الفلاتر.' })}</p>
              <button type="button" className="primary-btn" onClick={() => { setQuery(''); setCategory('all'); setCity('all'); setState('all') }}>{tx(locale, { en: 'Reset filters', es: 'Restablecer filtros', it: 'Reimposta filtri', ar: 'إعادة التعيين' })}</button>
            </div>
          )}
          {pageCount > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Events pages', es: 'Páginas de eventos', it: 'Pagine eventi', ar: 'صفحات الفعاليات' })}>{Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => <button key={n} type="button" disabled={n === safePage} onClick={() => setPage(n)} aria-current={n === safePage ? 'page' : undefined}>{n}</button>)}</nav>}
        </>
      )}
    </div>
  </main>
}

export function EventDetailPage({ slug }: { slug: string }) {
  const cms = usePresentation("event-detail")

  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveEvents = useDbEvents(events)
  const item = liveEvents.find((e) => e.slug === slug)
  const [now, setNow] = useState<number | null>(null)
  const [shared, setShared] = useState(false)
  const range = resolveEventRange({ startDate: item?.startDate, endDate: item?.endDate, date: item?.date ?? '' })
  const rangeKey = range.start?.getTime() ?? 0
  useEffect(() => {
    if (!rangeKey) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [rangeKey])
  if (!item) return <DetailNotFound title={tx(locale, { en: 'Event not found', es: 'Evento no encontrado', it: 'Evento non trovato', ar: 'الفعالية غير موجودة' })} copy={tx(locale, { en: 'The event you were looking for has taken a different route.', es: 'El evento que buscabas ha tomado otro camino.', it: 'L\'evento che cercavi ha preso un\'altra strada.', ar: 'الفعالية التي تبحث عنها سلكت طريقًا آخر.' })} backHref="/events" backLabel={tx(locale, { en: 'See all events', es: 'Ver todos los eventos', it: 'Vedi tutti gli eventi', ar: 'شاهد كل الفعاليات' })}/>
  if (item.isPublished === false) return <SiteShell><main className="container section"><div className="account-empty" role="status"><h1>{cms.text("presentation","description0",tx(locale, { en: 'This event is currently hidden', es: 'Este evento está oculto ahora mismo', it: 'Questo evento è attualmente nascosto', ar: 'هذه الفعالية مخفية حاليًا' }))}</h1><p>{cms.text("presentation","description1",tx(locale, { en: 'Browse the other published events.', es: 'Descubre los otros eventos publicados.', it: 'Scopri gli altri eventi pubblicati.', ar: 'تصفح الفعاليات المنشورة الأخرى.' }))}</p><Link href="/events" className="primary-btn">{cms.text("presentation","description2",tx(locale, { en: 'See all events', es: 'Ver todos los eventos', it: 'Vedi tutti gli eventi', ar: 'شاهد كل الفعاليات' }))}</Link></div></main></SiteShell>
  const title = (locale === 'ar' ? item.titleAr : undefined) || item.title
  const copy = (locale === 'ar' ? item.copyAr : undefined) || item.copy
  const intro = (locale === 'ar' ? item.introAr : undefined) || (item.intro ?? copy)
  const venue = (locale === 'ar' ? item.locationAr : undefined) || item.location
  const category = (locale === 'ar' ? item.categoryAr : undefined) || item.category
  const included = ar && item.includedAr?.length ? item.includedAr : item.included
  const excluded = ar && item.excludedAr?.length ? item.excludedAr : item.excluded
  const status = getEventStatus(item, now ?? Date.now())
  const statusLabel = now === null ? null : eventStatusLabel(status, locale)
  const msLeft = range.start && now !== null ? Math.max(0, range.start.getTime() - now) : 0
  const cd = [Math.floor(msLeft / 86400000), Math.floor(msLeft / 3600000) % 24, Math.floor(msLeft / 60000) % 60, Math.floor(msLeft / 1000) % 60]
  const cdLabels = locale === 'ar' ? ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'] : locale === 'es' ? ['Días', 'Horas', 'Min', 'Seg'] : locale === 'it' ? ['Giorni', 'Ore', 'Min', 'Sec'] : ['Days', 'Hours', 'Mins', 'Secs']
  const related = getRelatedEvents(item, getPublishedEvents(liveEvents), 2)
  const hasProgram = Boolean(item.program?.length)
  const mapQ = eventMapQuery(item)
  const timeLine = [item.startTime, item.endTime].filter(Boolean).join(' - ')
  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `/events/${item.slug}`
    try {
      if (navigator.share) { await navigator.share({ title, url }) ; return }
      await navigator.clipboard.writeText(url)
    } catch { try { await navigator.clipboard.writeText(url) } catch { /* clipboard unavailable */ } }
    setShared(true)
    window.setTimeout(() => setShared(false), 2000)
  }
  return <SiteShell><main className="event-detail-page">
    <Breadcrumb items={[cms.text("presentation","description3",tx(locale, { en: 'Events', es: 'Eventos', it: 'Eventi', ar: 'الفعاليات' })), title]} />
    <section className="event-detail-hero container">
      <img src={eventImageSrc(item.image)} alt={title} onError={onEventImageError} />
      <div className="event-detail-shade" />
      <div className="event-detail-content">
        <div className="event-detail-main">
          <span className="event-detail-kicker"><Ticket size={15}/>{category ?? (tx(locale, { en: 'Seasonal event', es: 'Evento de temporada', it: 'Evento stagionale', ar: 'فعالية موسمية' }))}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="event-detail-pills"><span><CalendarDays size={15} />{item.date}</span><span><MapPin size={15} />{venue}</span>{timeLine && <span><Clock3 size={15} />{timeLine}</span>}<span className="event-price-pill">{eventPriceLabel(item, locale)}</span>{statusLabel && <span className="event-status">{statusLabel}</span>}</div>
          <div className="event-detail-actions"><a href="#event-book" className="primary-btn">{tx(locale, { en: 'Request your place', es: 'Reserva tu plaza', it: 'Richiedi il tuo posto', ar: 'اطلب مكانك' })} <ArrowRight size={17} /></a>{hasProgram && <a href="#event-program" className="event-detail-text-link">{tx(locale, { en: 'Explore the program', es: 'Descubre el programa', it: 'Scopri il programma', ar: 'شاهد البرنامج' })} <ArrowRight size={16}/></a>}<button type="button" className="event-detail-text-link event-share-btn" onClick={share} aria-live="polite"><Share2 size={16} />{shared ? (tx(locale, { en: 'Link copied', es: 'Enlace copiado', it: 'Link copiato', ar: 'تم نسخ الرابط' })) : (tx(locale, { en: 'Share', es: 'Compartir', it: 'Condividi', ar: 'مشاركة' }))}</button></div>
        </div>
        <aside className="event-hero-summary" aria-label={tx(locale, { en: 'Event at a glance', es: 'El evento en resumen', it: 'L\'evento in breve', ar: 'ملخص الفعالية' })}>
          <span>{tx(locale, { en: 'Event at a glance', es: 'El evento en resumen', it: 'L\'evento in breve', ar: 'ملخص الفعالية' })}</span>
          <dl>
            <div><dt><CalendarDays size={17}/>{tx(locale, { en: 'When', es: 'Cuándo', it: 'Quando', ar: 'الموعد' })}</dt><dd>{item.date}{timeLine ? ` · ${timeLine}` : ''}</dd></div>
            <div><dt><MapPin size={17}/>{tx(locale, { en: 'Where', es: 'Dónde', it: 'Dove', ar: 'الوجهة' })}</dt><dd>{item.venueName ?? venue}{item.city ? ` · ${(locale === 'ar' ? item.cityAr : undefined) || item.city}` : ''}</dd></div>
            <div><dt><Compass size={17}/>{tx(locale, { en: 'Format', es: 'Formato', it: 'Formato', ar: 'شكل الرحلة' })}</dt><dd>{item.program?.length ?? 0} {tx(locale, { en: 'program chapters', es: 'capítulos del programa', it: 'capitoli del programma', ar: 'محطات في البرنامج' })}</dd></div>
          </dl>
          <Link href="/events">{tx(locale, { en: 'View all events', es: 'Ver todos los eventos', it: 'Vedi tutti gli eventi', ar: 'عرض كل الفعاليات' })} <ArrowRight size={15}/></Link>
        </aside>
      </div>
    </section>
    <div className="container event-layout">
      <div className="event-main">
        <PresentationSection pageId="event-detail" id="event-about"><section className="event-about">
          <span className="eyebrow">{cms.text("event-about","description0",tx(locale, { en: 'About this event', es: 'Sobre este evento', it: 'Su questo evento', ar: 'عن الفعالية' }))}</span>
          <h2>{copy}</h2>
          {intro !== copy && <p className="event-lede">{intro}</p>}
          {item.gallery && item.gallery.length > 0 && <div className="event-gallery" role="list" aria-label={tx(locale, { en: 'Event photos', es: 'Fotos del evento', it: 'Foto dell\'evento', ar: 'صور الفعالية' })}>{item.gallery.map((src) => <img key={src} role="listitem" src={eventImageSrc(src)} alt={title} loading="lazy" onError={onEventImageError} />)}</div>}
        </section></PresentationSection>
        {item.highlights && item.highlights.length > 0 && <PresentationSection pageId="event-detail" id="event-experience"><section className="event-experience">
          <span className="eyebrow">{cms.text("event-experience","description0",tx(locale, { en: 'Why this journey works', es: 'Por qué funciona este viaje', it: 'Perché questo viaggio funziona', ar: 'ليه الرحلة دي مميزة' }))}</span>
          <div className="event-experience-grid">{item.highlights.map((highlight, index) => <article key={highlight.title}><span>{String(index + 1).padStart(2, '0')}</span><Sparkles size={20}/><h3>{(locale === 'ar' ? highlight.titleAr : undefined) || highlight.title}</h3><p>{(locale === 'ar' ? highlight.descriptionAr : undefined) || highlight.description}</p></article>)}</div>
        </section></PresentationSection>}
        {range.start && now !== null && msLeft > 0 && (status === 'upcoming') && <section className="event-countdown-wrap" aria-label={tx(locale, { en: 'Countdown', es: 'Cuenta atrás', it: 'Conto alla rovescia', ar: 'العد التنازلي' })}>
          <span className="eyebrow">{tx(locale, { en: 'Countdown to the event', es: 'Cuenta atrás para el evento', it: 'Conto alla rovescia per l\'evento', ar: 'العد التنازلي لبداية الفعالية' })}</span>
          <div className="event-countdown" role="timer">{cd.map((v, i) => <span key={cdLabels[i]}><b>{String(v).padStart(2, '0')}</b><small>{cdLabels[i]}</small></span>)}</div>
        </section>}
        {hasProgram && <PresentationSection pageId="event-detail" id="event-program"><section id="event-program" className="event-program">
          <span className="eyebrow">{cms.text("event-program","description0",tx(locale, { en: 'Event program', es: 'Programa del evento', it: 'Programma dell\'evento', ar: 'برنامج الفعالية' }))}</span>
          <h2>{cms.text("event-program","description1",tx(locale, { en: 'Day by day', es: 'Día a día', it: 'Giorno per giorno', ar: 'يوم بيوم' }))}</h2>
          <div className="event-program-list">{item.program!.map((d) => <article key={`${d.day}-${d.title}`}><span className="event-program-day">{d.day}</span><div><h3>{d.title}</h3><p>{d.description}</p></div></article>)}</div>
        </section></PresentationSection>}
        {(included?.length || excluded?.length) && <section className="event-inclusions">
          <span className="eyebrow">{tx(locale, { en: 'Included & excluded', es: 'Incluido y no incluido', it: 'Incluso ed escluso', ar: 'المشمول والمستبعد' })}</span>
          <h2>{tx(locale, { en: 'Know exactly what the arrangement covers.', es: 'Descubre exactamente qué cubre la organización.', it: 'Scopri esattamente cosa copre l\'organizzazione.', ar: 'اعرف بالضبط إيه الموجود في الترتيب.' })}</h2>
          <div className="event-inclusion-grid">
            {included && included.length > 0 && <article><h3>{tx(locale, { en: "What's included", es: "Incluido", it: "Incluso", ar: 'مشمول' })}</h3><ul className="check-list">{included.map((x) => <li key={x}><Check size={16} />{x}</li>)}</ul></article>}
            {excluded && excluded.length > 0 && <article><h3>{tx(locale, { en: 'Not included', es: 'No incluido', it: 'Escluso', ar: 'غير مشمول' })}</h3><ul className="excluded-list">{excluded.map((x) => <li key={x}><Minus size={16} />{x}</li>)}</ul></article>}
          </div>
        </section>}
        {item.addOns && item.addOns.length > 0 && <PresentationSection pageId="event-detail" id="event-addons-wrap"><section className="event-addons-wrap">
          <span className="eyebrow">{cms.text("event-addons-wrap","description0",tx(locale, { en: 'Optional add-ons', es: 'Extras opcionales', it: 'Extra facoltativi', ar: 'إضافات اختيارية' }))}</span>
          <h2>{cms.text("event-addons-wrap","description1",tx(locale, { en: 'Enhance your experience', es: 'Mejora tu experiencia', it: 'Arricchisci la tua esperienza', ar: 'زوّد تجربتك' }))}</h2>
          <ul className="event-addons">{item.addOns.map((a) => <li key={a.title}><Plus size={15} />{a.title}{typeof a.price === 'number' ? ` · ${formatCurrency(a.price, item.currency, locale)}` : ''}</li>)}</ul>
        </section></PresentationSection>}
        <section className="event-venue">
          <span className="eyebrow">{tx(locale, { en: 'Venue & area', es: 'Lugar y zona', it: 'Sede e zona', ar: 'مكان الانعقاد' })}</span>
          <h2>{item.venueName ?? venue}</h2>
          {item.address && <p>{(locale === 'ar' ? item.addressAr : undefined) || item.address}</p>}
          <iframe title={tx(locale, { en: `${venue} map`, es: `Mapa de ${venue}`, it: `Mappa di ${venue}`, ar: `خريطة ${venue}` })} src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQ)}&t=&z=11&ie=UTF8&iwloc=&output=embed`} loading="lazy" className="location-map" />
          <p>{tx(locale, { en: 'Attendance requests are preliminary and pending review. No payment or confirmed ticket here.', es: 'Las solicitudes de asistencia son preliminares y están pendientes de revisión. Sin pago ni entrada confirmada aquí.', it: 'Le richieste di partecipazione sono preliminari e in attesa di revisione. Nessun pagamento né biglietto confermato qui.', ar: 'طلب الحضور مبدئي وقيد المراجعة. لا يوجد دفع أو تذكرة مؤكدة هنا.' })}</p>
        </section>
        {(item.organizerName || item.organizerPhone || item.organizerWhatsapp || item.organizerEmail) && <section className="event-organizer">
          <span className="eyebrow">{tx(locale, { en: 'Organizer & contact', es: 'Organizador y contacto', it: 'Organizzatore e contatti', ar: 'المنظم والتواصل' })}</span>
          <h2>{(((locale === 'ar' ? item.organizerNameAr : undefined) || item.organizerName) ?? (tx(locale, { en: 'Contact', es: 'Contacto', it: 'Contatto', ar: 'تواصل' })))}</h2>
          <ul className="event-organizer-list">
            {item.organizerPhone && telLink(undefined, item.organizerPhone) !== '' && <li><Phone size={15} /><a href={telLink(undefined, item.organizerPhone)} onClick={() => trackPublicInteraction({ event: 'sp_contact_click', channel: 'phone', placement: 'event_organizer' })}>{item.organizerPhone}</a></li>}
            {item.organizerWhatsapp && whatsappLink(undefined, item.organizerWhatsapp) !== '' && <li><MessageCircle size={15} /><a href={whatsappLink(undefined, item.organizerWhatsapp)} target="_blank" rel="noreferrer" onClick={() => trackPublicInteraction({ event: 'sp_contact_click', channel: 'whatsapp', placement: 'event_organizer' })}>WhatsApp</a></li>}
            {item.organizerEmail && <li><Mail size={15} /><a href={`mailto:${item.organizerEmail}`} onClick={() => trackPublicInteraction({ event: 'sp_contact_click', channel: 'email', placement: 'event_organizer' })}>{item.organizerEmail}</a></li>}
          </ul>
        </section>}
        {related.length > 0 && <PresentationSection pageId="event-detail" id="event-related"><section className="event-related">
          <div className="section-title-row"><h2>{cms.text("event-related","description0",tx(locale, { en: 'More events', es: 'Más eventos', it: 'Altri eventi', ar: 'فعاليات أخرى' }))}</h2><CmsPublicLink href={cms.link("event-related","links0","/events")} className="text-link">{cms.text("event-related","description1",tx(locale, { en: 'View all', es: 'Ver todo', it: 'Vedi tutto', ar: 'شاهد الكل' }))} <ArrowRight size={15} /></CmsPublicLink></div>
          <div className="event-grid two">{related.map((e) => <EventCard item={e} key={e.slug} />)}</div>
        </section></PresentationSection>}
      </div>
      <aside id="event-book" className="event-book" aria-label={tx(locale, { en: 'Event request', es: 'Solicitud del evento', it: 'Richiesta evento', ar: 'طلب حضور الفعالية' })}>
        <EventRequestForm event={item} />
      </aside>
    </div>
  </main></SiteShell>
}
