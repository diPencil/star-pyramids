'use client'

// 'use client' is required here: the access token is read from the router
// rather than passed as a prop, so the credential never enters the
// server-rendered payload that ships in the HTML.
import Link from "next/link";
import { Clock3, Heart } from "lucide-react";
import { formatPrice, tx, useLocale } from "@/components/locale";
import { catalogTours } from "@/data/tours";
import { localizeTourDuration, localizeTourLocation } from "@/lib/tours/tour-format";
import { useDbTours } from "@/lib/tours/tours-client";
import { usePagination } from "@/components/admin/admin-pagination";
import { useCustomerFavorites } from "@/lib/account/customer-account";
import { useImpersonated } from "../shared/account-hooks"
import { CustomerPagination } from "../shared/account-ui"


function MiniTour({ tour }: { tour: (typeof catalogTours)[number] }) {
  const { locale, currency } = useLocale()
  const impersonated = useImpersonated()
  const favorites = useCustomerFavorites({ accountOnly: true })

  const title = (locale === 'ar' ? tour.titleAr || undefined : undefined) ?? tour.title
  return <article className="customer-mini-tour"><Link href={`/egypt-tours/${tour.slug}`}><img src={tour.image} alt={title} /></Link><div><span>{locale === 'ar' ? localizeTourLocation(tour.location) : tour.location}</span><h3><Link href={`/egypt-tours/${tour.slug}`}>{title}</Link></h3><small>{locale === 'ar' ? localizeTourDuration(tour.duration) : tour.duration} · {formatPrice(tour.price, currency, locale)}</small></div><button type="button" onClick={() => favorites.toggle(tour.slug)} disabled={Boolean(impersonated) || favorites.loading || Boolean(favorites.error)} aria-label={tx(locale, { en: 'Remove from saved', es: 'Quitar de guardados', it: 'Rimuovi dai salvati', ar: 'إزالة من المحفوظات' })}><Heart size={17} fill={favorites.has(tour.slug) ? 'currentColor' : 'none'} /></button></article>
}

function FavoritesSection() {
  const { locale } = useLocale()

  const favorites = useCustomerFavorites({ accountOnly: true })
  const liveTours = useDbTours(catalogTours, { includeNew: true })
  const saved = favorites.slugs.map((slug) => liveTours.find((tour) => tour.slug === slug)).filter((tour) => Boolean(tour))
  const recommendations = liveTours.filter((tour) => !favorites.has(tour.slug)).slice(0, 6)
  const savedPaging = usePagination(saved)
  if (favorites.loading) {
    return <div className="customer-inline-empty" role="status"><Clock3 size={20} /><span><strong>{tx(locale, { en: 'Loading saved trips…', es: 'Cargando los viajes guardados…', it: 'Caricamento viaggi salvati…', ar: 'جارٍ تحميل الرحلات المحفوظة…' })}</strong></span></div>
  }
  if (favorites.error) return <div className="customer-inline-empty" role="alert"><span>{tx(locale, { en: 'Could not load saved trips. Your saved trips have not been changed.', es: 'No se pudieron cargar los viajes guardados. No se han modificado.', it: 'Impossibile caricare i viaggi salvati. Non sono stati modificati.' })}</span><button type="button" className="account-text-button" onClick={favorites.retry}>{tx(locale, { en: 'Try again', es: 'Intentar de nuevo', it: 'Riprova' })}</button></div>
  return <div className="customer-favorites-page">{saved.length > 0 && <section className="customer-account-block"><header><div><span>{tx(locale, { en: 'Your shortlist', es: 'Tus guardados', it: 'I tuoi salvati', ar: 'قائمتك' })}</span><h2>{tx(locale, { en: 'Saved for comparison', es: 'Guardados para comparar', it: 'Salvati per confrontare', ar: 'محفوظة للمقارنة' })}</h2></div><small>{saved.length} {tx(locale, { en: 'trips', es: 'viajes', it: 'viaggi', ar: 'رحلات' })}</small></header><div className="customer-saved-grid">{savedPaging.pageRows.map((tour) => tour && <MiniTour key={tour.slug} tour={tour} />)}</div><CustomerPagination page={savedPaging.page} pageCount={savedPaging.pageCount} onPage={savedPaging.setPage} pageSize={savedPaging.pageSize} onPageSize={savedPaging.setPageSize} from={savedPaging.from} to={savedPaging.to} total={savedPaging.total} /></section>}<section className="customer-account-block"><header><div><span>{saved.length ? (tx(locale, { en: 'More ideas', es: 'Más ideas', it: 'Altre idee', ar: 'أفكار إضافية' })) : (tx(locale, { en: 'Start your shortlist', es: 'Empieza tu lista', it: 'Inizia la tua lista', ar: 'ابدأ قائمتك' }))}</span><h2>{tx(locale, { en: 'Trips you may like', es: 'Viajes que te pueden gustar', it: 'Viaggi che potrebbero piacerti', ar: 'رحلات قد تعجبك' })}</h2></div></header><div className="customer-saved-grid">{recommendations.map((tour) => <MiniTour key={tour.slug} tour={tour} />)}</div></section></div>
}

export { MiniTour, FavoritesSection }
