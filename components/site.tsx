'use client'
import { Header, COMPANY_LABELS, Logo } from "./layout/site-header"
export { Logo, NotificationDropdown, useActiveNav, getNavConfig, getEgyptTourNavLinks, NavLinks, Header } from "./layout/site-header"

import { TripSearchEngine } from "./shared/trip-search-engine"
export { FilterField, HeroField, TripSearchEngine } from "./shared/trip-search-engine"

import { TourCard } from "./tours/tour-card"
export { CardGallery, TourCard, TourCardPresentation } from "./tours/tour-card"

import { trackPublicInteraction, trackPublicNavigation } from '@/lib/tracking/tracking-events'




import { useShowcaseHero } from './cms/heroes/showcase-hero-context'

import { useSharedCopy } from './cms/presentation-content-context'
import { SharedHelpCTA } from './shared/shared-help-cta'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from "react";
import { Search, ArrowRight, ArrowUp, MapPin, Clock3, Users, Mail, Phone, Star, Sun, Ship, Anchor, Package, Gift } from "lucide-react";
import { blogs, destinations, events, offers } from '@/data/content'
import { assignableOneDayTours, catalogTours, getMultiDayToursForCategory, getOneDayToursForDestination, getPublishedMultiDayCategories, getPublishedOneDayDestinations, getToursByCategory, multiDayCategories, seasonalTours, tourCategories, tourImages } from "@/data/tours";
import { matchPriceBand, parseTourListingQuery, tourListingSorts, tourPriceBands, type TourListingQuery } from '@/lib/query'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tours/tour-format'
import { phoneHref, whatsappHref } from '@/data/company'
import { useBrandSettings } from '@/lib/admin-store'
import { useDbOffers } from '@/lib/catalogue/offers-blogs-client'
import { campaignCtaHref, placedOffers, readCampaign } from "@/lib/marketing/marketing-campaigns";
import { BarIcons } from './cms/promo-bar-icons'
import { DEFAULT_ACCESS_ICON } from '@/lib/cms/promo-bar/promo-bar-defaults'
import { useDbCategories, useDbDestinations } from '@/lib/catalogue/catalogue-client'
import { useDbTours } from '@/lib/tours/tours-client'


import type { Tour, TourCategory, TourVariant } from '@/data/types'
import { LocaleProvider, tx, useLocale, formatPrice, type Locale } from './locale'
import { LiveChatWidget } from './support/live-chat'
import { WhatsAppGlyph, WhatsAppWidget } from './support/whatsapp-chat'
import { FooterSocials } from "./layout/social-icons";

import { pickLocaleText } from "@/lib/i18n/locale-config";
import { InternationalPhoneInput } from './shared/forms/international-phone-input'
import { CountrySelect } from './shared/forms/country-select'
import { SharedSelect } from './shared/forms/shared-select'
import { defaultCountry } from '@/data/countries'




export const images = tourImages

const oneDayTourBase = assignableOneDayTours
const multiDayTourBase = getToursByCategory('multi-days-tours')

import { copy, extra } from '@/lib/i18n/site-copy'
export { extra } from '@/lib/i18n/site-copy'



export function SupportWidgets(){const [active,setActive]=useState<'live'|'wa'|null>(null); return <div className="support-widgets"><LiveChatWidget open={active==='live'} onOpen={()=>setActive('live')} onClose={()=>setActive((a)=>a==='live'?null:a)}/><WhatsAppWidget open={active==='wa'} onOpen={()=>setActive('wa')} onClose={()=>setActive((a)=>a==='wa'?null:a)}/></div>}

// Commercial footer promotional bar  -  database records are the single source
// of truth (placement `footer-promo`). The original accessibility notice is
// itself a managed record, so no separate static strip is rendered here.
function FooterPromoStrip(){
  const {locale}=useLocale();
  const ex=extra[locale];
  const bars=placedOffers(useDbOffers(offers),'footer-promo');
  const tours=useDbTours(catalogTours,{includeNew:true});
  const [show,setShow]=useState(true);
  const item=bars[0];
  if(!show||!item) return null;
  const campaign=readCampaign(item.campaign);
  const href=campaignCtaHref(item,tours);
  const label=campaign.ctaLabel||ex.viewOffers;
  const icons=campaign.icons.length?campaign.icons:[DEFAULT_ACCESS_ICON];
  return <div className="access-strip"><span className="promo-icons"><BarIcons ids={icons} size={20}/></span><p>{item.title}</p>{href.startsWith('/')?<Link href={href}>{label}</Link>:<a href={href} target="_blank" rel="noopener noreferrer">{label}</a>}<button type="button" onClick={()=>setShow(false)} aria-label="Dismiss">×</button></div>
}

function ScrollTop(){const [show,setShow]=useState(false); useEffect(()=>{const onScroll=()=>setShow(window.scrollY>500); onScroll(); window.addEventListener('scroll',onScroll,{passive:true}); return ()=>window.removeEventListener('scroll',onScroll);},[]); const goTop=()=>{const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({top:0,behavior:reduced?'auto':'smooth'});}; return <button type="button" className={'scroll-top'+(show?' show':'')} onClick={goTop} aria-label="Scroll to top"><ArrowUp size={20}/></button>}

export function SiteShell({children, initialLocale}:{children:React.ReactNode; initialLocale?: Locale}){return <LocaleProvider initialLocale={initialLocale}><Header/>{children}<FooterPromoStrip/><SupportWidgets/><ScrollTop/><DynamicFooter/></LocaleProvider>}


function DynamicFooter() {
  const { locale } = useLocale()
  const navExtra = useSharedCopy(extra[locale], 'navigation')
  const ex = useSharedCopy({ ...navExtra, allTrips: tx(locale, { en: 'All Trips', es: 'Todos los viajes', it: 'Tutti i viaggi', ar: 'كل الرحلات' }) }, 'footer')
  const t = useSharedCopy({ ...copy[locale], companyLabel: COMPANY_LABELS[locale] ?? COMPANY_LABELS.en }, 'navigation')
  const brand = useBrandSettings()
  const footerTag = locale === 'ar' ? (brand.aboutAr || ex.footerTag) : (brand.aboutEn || ex.footerTag)
  const copyright = locale === 'ar' ? (brand.copyrightAr || ex.rights) : (brand.copyrightEn || ex.rights)

  return <footer onClickCapture={event => trackPublicNavigation(event.target, 'footer')}>
    <div className="container footer-grid">
      <div className="foot-brand">
        <Logo />
        <p>{footerTag}</p>
        <span className="cert-badge"><Gift size={14} /><span>{ex.certBadge}</span></span>
        <div className="socials foot-socials"><FooterSocials /></div>
      </div>
      <div>
        <h3>{ex.footExplore}</h3>
        <Link href="/">{t.home}</Link>
        <Link href="/trips">{ex.allTrips}</Link>
        <Link href="/egypt-tours/one-day-tours">{ex.cat1}</Link>
        <Link href="/egypt-tours/multi-days-tours">{ex.cat2}</Link>
        <Link href="/egypt-tours/nile-cruises">{ex.cat3}</Link>
        <Link href="/egypt-tours/shore-excursions">{ex.cat4}</Link>
        <Link href="/special-offers">{t.offer}</Link>
      </div>
      <div>
        <h3>{ex.footCompany}</h3>
        <Link href="/rent-car">{t.rent}</Link>
        <Link href="/about">{t.about}</Link>
        <Link href="/contact">{t.contact}</Link>
        <Link href="/egypt-travel-guide">{ex.guideLink}</Link>
        <Link href="/faq">{ex.faqsLink}</Link>
        <Link href="/events">{t.events}</Link>
        <Link href="/accessible-travel">{ex.accessLink}</Link>
      </div>
      <div>
        <h3>{ex.contactInfo}</h3>
        <div className="foot-contact">
          <a href={phoneHref(brand.phone)} aria-label={tx(locale, { en: 'Call STAR PYRAMIDS', es: 'Llama a STAR PYRAMIDS', it: 'Chiama STAR PYRAMIDS', ar: 'اتصل بستار بيراميدز' })}><Phone size={15} /><span>{brand.phone}</span></a>
          <a href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer" aria-label={tx(locale, { en: 'Chat with STAR PYRAMIDS on WhatsApp', es: 'Habla con STAR PYRAMIDS por WhatsApp', it: 'Chatta con STAR PYRAMIDS su WhatsApp', ar: 'راسل ستار بيراميدز على واتساب' })}><WhatsAppGlyph size={16} /><span>{brand.whatsapp}</span></a>
          <a href={`mailto:${brand.email}`}><Mail size={15} /><span>{brand.email}</span></a>
          <span className="foot-addr"><MapPin size={15} /><span>{brand.address}</span></span>
        </div>
      </div>
    </div>
    <div className="container copyright">
      {copyright} <span className="powered-by">| {ex.poweredBy} <a href="https://panel.dipencil.com" target="_blank" rel="noreferrer" aria-label="Dipencil"><img src="https://panel.dipencil.com/pencil-logo.png" alt="Dipencil" /></a></span>
      <span><Link href="/privacy">{ex.privacy}</Link>&nbsp;<Link href="/terms">{ex.terms}</Link></span>
    </div>
  </footer>
}

type PageShowcaseHeroProps = {
  showFeatured?: boolean
  image: string
  eyebrow: string
  title: string
  intro: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  railLabel: string
  railTitle: string
  railHref: string
  railMeta: readonly { Icon: typeof Clock3; label: string }[]
  statsLabel: string
  stats: readonly { value: string | number; label: string }[]
}

export function PageShowcaseHero({ showFeatured = true, image, eyebrow, title, intro, primaryLabel, primaryHref, secondaryLabel, secondaryHref, railLabel, railTitle, railHref, railMeta, statsLabel, stats }: PageShowcaseHeroProps) {
  const state = useShowcaseHero()
  const { locale } = useLocale()
  if (state?.hidden || state?.unavailable) return null
  const content = state?.content
  const text = content && locale !== 'ar' ? content.text[locale] : {}
  eyebrow = text.eyebrow ?? eyebrow; title = text.title ?? title; intro = text.intro ?? intro
  primaryLabel = text.primaryLabel ?? primaryLabel; secondaryLabel = text.secondaryLabel ?? secondaryLabel
  railLabel = text.railLabel ?? railLabel; railTitle = text.railTitle ?? railTitle; statsLabel = text.statsLabel ?? statsLabel
  primaryHref = content?.links.primaryHref ?? primaryHref; secondaryHref = content?.links.secondaryHref ?? secondaryHref; railHref = content?.links.railHref ?? railHref
  railMeta = railMeta.map((item, index) => ({ ...item, label: text['meta' + index] ?? item.label }))
  stats = stats.map((item, index) => ({ ...item, label: text['stat' + index] ?? item.label }))
  // The shipped square fallback contains white top/bottom bands. Trim those
  // on phones only; uploaded desktop/mobile media retain their CMS crop.
  const mobileLetterbox = (content?.mobileImage || content?.image || image) === '/egypt-hero.png' ? true : undefined
  return <section className="events-page-hero tour-category-page-hero">
    {content?.image || content?.mobileImage ? <picture><source media="(max-width: 760px)" srcSet={content.mobileImage || content.image || image} /><img src={content.image || image} alt={locale !== 'ar' ? content.alt[locale] : ''} className="hero-bg-img" data-mobile-letterbox={mobileLetterbox} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: content.position === 'source' ? undefined : content.position }} fetchPriority="high" /></picture> : <Image src={image} alt={content && locale !== 'ar' ? content.alt[locale] : ''} fill priority sizes="100vw" className="hero-bg-img" data-mobile-letterbox={mobileLetterbox} style={content && content.position !== 'source' ? { objectPosition: content.position } : undefined} />}
    <div className="events-page-hero-shade" style={content?.overlay != null ? { background: `rgba(10,32,76,${content.overlay})` } : undefined} />
    <div className="container events-page-hero-content">
      <div className="events-page-hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <div className="events-page-hero-actions">
          <a href={primaryHref} className="primary-btn" onClick={() => trackPublicInteraction({ event: 'sp_cta_click', ctaId: 'hero_primary' })}>{primaryLabel} <ArrowRight size={17}/></a>
          {showFeatured && <Link href={secondaryHref} className="events-hero-link" onClick={() => trackPublicInteraction({ event: 'sp_cta_click', ctaId: 'hero_secondary' })}>{secondaryLabel} <ArrowRight size={16}/></Link>}
        </div>
      </div>
      {showFeatured && <div className="events-hero-rail">
        <Link href={railHref} className="events-next-event" onClick={() => trackPublicInteraction({ event: 'sp_cta_click', ctaId: 'hero_rail' })}>
          <span>{railLabel}</span>
          <strong>{railTitle}</strong>
          <small>{railMeta.map(({ Icon, label }, index) => <span className="showcase-hero-meta" key={`${label}-${index}`}>{index > 0 && <i aria-hidden="true"/>}<Icon size={14}/>{label}</span>)}</small>
        </Link>
        <div className="events-hero-stats" aria-label={statsLabel}>
          {stats.map((stat) => <span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}
        </div>
      </div>}
    </div>
  </section>
}

type TourCategoryHeroProps = Omit<PageShowcaseHeroProps, 'secondaryLabel' | 'secondaryHref' | 'railLabel' | 'railTitle' | 'railHref' | 'railMeta'> & {
  featuredLabel: string
  featuredTitle: string
  featuredHref: string
  featuredLocation: string
  featuredDuration: string
}

export function TourCategoryHero({ featuredLabel, featuredTitle, featuredHref, featuredLocation, featuredDuration, ...hero }: TourCategoryHeroProps) {
  return <PageShowcaseHero {...hero} secondaryLabel={featuredLabel} secondaryHref={featuredHref} railLabel={featuredLabel} railTitle={featuredTitle} railHref={featuredHref} railMeta={[{ Icon: Clock3, label: featuredDuration }, { Icon: MapPin, label: featuredLocation }]}/>
}

export function OneDayToursRegions(){return <SiteShell><OneDayToursRegionsContent/></SiteShell>}

function OneDayToursRegionsContent(){const {locale:dl}=useLocale(); const set=tourCategories['one-day-tours']; const meta=catMeta.day;  const catTitle=pickLocaleText(dl, { en: set.title, ar: categoryCopy['one-day-tours'].titleAr }); const catIntro=pickLocaleText(dl, { en: set.intro, ar: categoryCopy['one-day-tours'].introAr }); const catEyebrow=dl === 'ar' ? meta.eyebrowAr : meta.eyebrow; const liveDestinations=useDbDestinations(destinations);const liveTours=useDbTours(oneDayTourBase,{includeNew:true,category:'one-day-tours'});const regions=getPublishedOneDayDestinations(liveDestinations).map((d)=>({slug:d.slug,title:dl==='ar'?(d.nameAr??d.title):d.title,copy:dl==='ar'?(d.copyAr??d.copy):d.copy,items:getOneDayToursForDestination(liveTours,d.slug)})).filter((r)=>r.items.length>0); const total=regions.reduce((n,r)=>n+r.items.length,0); const featured=regions.flatMap((region)=>region.items)[0]??liveTours[0]; return <><TourCategoryHero showFeatured={!!featured} image={featured?.image || '/egypt-hero.png'} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore day tours', es: 'Explora los circuitos de un día', it: 'Esplora i tour di un giorno', ar: 'استكشف رحلات اليوم الواحد' })} primaryHref="#one-day-regions" featuredLabel={tx(dl, { en: 'Featured day tour', es: 'Circuito destacado de un día', it: 'Tour di un giorno in evidenza', ar: 'رحلة يوم مميزة' })} featuredTitle={pickLocaleText(dl, { en: featured?.title ?? '', ar: featured?.titleAr })} featuredHref={`/egypt-tours/${featured?.slug ?? ''}`} featuredLocation={dl === 'ar' ? localizeTourLocation((featured?.location ?? '')) : (featured?.location ?? '')} featuredDuration={dl === 'ar' ? localizeTourDuration((featured?.duration ?? '')) : (featured?.duration ?? '')} statsLabel={tx(dl, { en: 'One-day tours summary', es: 'Resumen de circuitos de un día', it: 'Riepilogo dei tour di un giorno', ar: 'ملخص رحلات اليوم الواحد' })} stats={[{value:total,label:tx(dl, { en: 'Tours available', es: 'Circuitos disponibles', it: 'Tour disponibili', ar: 'رحلات متاحة' })},{value:regions.length,label:tx(dl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'وجهات مصرية' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="one-day-regions" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Governorates', es: 'Gobernaciones', it: 'Governatorati', ar: 'المحافظات' })}>{regions.map(r=><a key={r.slug} href={'#'+r.slug}>{r.title}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'تصفح' })} <strong>{total}</strong> {tx(dl, { en: 'one-day tours across', es: 'circuitos de un día en', it: 'tour di un giorno in', ar: 'رحلة يوم واحد في' })} <strong>{regions.length}</strong> {tx(dl, { en: 'governorates', es: 'gobernaciones', it: 'governatorati', ar: 'محافظات' })}</p>{regions.map(r=><section key={r.slug} id={r.slug} className="region-block" aria-label={r.title}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{r.title}</h2><p>{r.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{r.items.length} {tx(dl, { en: 'tours', es: 'circuitos', it: 'tour', ar: 'رحلات' })}</span><Link href={`/egypt-tours/one-day-tours/${r.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver más', it: 'Vedi di più', ar: 'شاهد الكل' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{r.items.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='day'/>)}</div></section>)}<HelpCTA/></main></>}

type RegionTourProps = {
  region: { name: string; nameAr: string; slug: string; copy: string; copyAr?: string; tourSlugs: readonly string[] }
  tours: Tour[]
  page: number
  category?: TourCategory
}

export function RegionTourPage(props: RegionTourProps) {
  return <SiteShell><RegionTourContent {...props}/></SiteShell>
}

function RegionTourContent({ region, tours, page, category = 'one-day-tours' }: RegionTourProps) {
  const { locale } = useLocale()
  const hero = useShowcaseHero()
  const heroText = hero?.content && locale !== 'ar' ? hero.content.text[locale] : undefined
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const set = tourCategories[category]
  const variant = set.variant
  const meta = catMeta[variant]
  const HeroIcon = meta.HeroIcon
  const isCruise = category === 'nile-cruises'
  const regionTitle = locale === 'ar' ? region.nameAr : region.name
  const [durFilter, setDurFilter] = useState('')
  const filteredTours = durFilter ? tours.filter((tour) => tour.duration === durFilter) : tours
  const durationOptions = isCruise ? Array.from(new Set(tours.map((tour) => tour.duration))) : []
  const perPage = 9
  const totalPages = Math.max(1, Math.ceil(filteredTours.length / perPage))
  const queryPage = Number(searchParams.get('page'))
  const requestedPage = Number.isInteger(queryPage) && queryPage > 0 && queryPage <= 999 ? queryPage : page
  const safePage = Math.max(1, Math.min(requestedPage, totalPages))
  const start = (safePage - 1) * perPage
  const paged = filteredTours.slice(start, start + perPage)
  const makeHref = (number: number) => `/egypt-tours/${category}/${region.slug}${number > 1 ? `?page=${number}` : ''}`
  const setDuration = (value: string) => {
    setDurFilter(value)
    if (requestedPage > 1) router.replace(pathname, { scroll: false })
  }

  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), pickLocaleText(locale, { en: set.title, ar: categoryCopy[category].titleAr }), regionTitle]}/>
    <main className="listing-page container">
      {!hero?.hidden && !hero?.unavailable && <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{heroText?.eyebrow ?? tx(locale, { en: meta.eyebrow, es: isCruise ? 'Navega por el Nilo' : (eyebrowEs[meta.eyebrow] ?? meta.eyebrow), it: isCruise ? 'Naviga sul Nilo' : (eyebrowIt[meta.eyebrow] ?? meta.eyebrow), ar: isCruise ? 'أبحر في النيل' : meta.eyebrowAr })}</span>
          <h1>{heroText?.title ?? regionTitle}</h1>
          <p>{heroText?.intro ?? pickLocaleText(locale, { en: region.copy, ar: region.copyAr })}</p>
          <div className="cat-feats">{(isCruise ? [{ Icon: Ship, text: heroText?.stat0 ?? featLabel(locale, 'Nile itineraries', 'مسارات نيلية') }, { Icon: Users, text: heroText?.stat1 ?? featLabel(locale, 'Cruise options', 'خيارات متعددة') }] : meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) }))).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>}
      <div className="results-bar"><span>{tx(locale, { en: 'Showing', es: 'Mostrando', it: 'Visualizzati', ar: 'عرض' })} <strong>{paged.length}</strong> {tx(locale, { en: 'of', es: 'de', it: 'di', ar: 'من' })} <strong>{filteredTours.length}</strong> {tx(locale, { en: 'tours', es: 'recorridos', it: 'tour', ar: 'رحلة' })}</span></div>
      {durationOptions.length > 1 && <nav className="category-pills" aria-label={tx(locale, { en: 'Filter by duration', es: 'Filtrar por duración', it: 'Filtra per durata', ar: 'تصفية حسب المدة' })}>
        {['', ...durationOptions].map((duration) => <button key={duration || 'all'} type="button" className={durFilter === duration ? 'active' : ''} aria-pressed={durFilter === duration} onClick={() => setDuration(duration)}>{duration ? (locale === 'ar' ? localizeTourDuration(duration) : duration) : tx(locale, { en: 'All', es: 'Todo', it: 'Tutto', ar: 'الكل' })}</button>)}
      </nav>}
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant}/>)}</div> : <p className="region-count">{tx(locale, { en: 'No tours available at the moment.', es: 'No hay viajes disponibles por el momento.', it: 'Nessun viaggio disponibile al momento.', ar: 'لا توجد رحلات حالياً' })}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Pagination', es: 'Paginación', it: 'Paginazione', ar: 'صفحات الرحلات' })}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }}/> {tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente', ar: 'السابق' })}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Avanti', ar: 'التالي' })} <ArrowRight size={14}/></Link>
      </nav>}
    </main>
  </>
}

function MultiDayToursCategoriesContent(){
  const {locale:dl}=useLocale();
  const set=tourCategories['multi-days-tours'];
  const meta=catMeta.multi;
  const catTitle=pickLocaleText(dl, { en: set.title, ar: categoryCopy['multi-days-tours'].titleAr });
  const catIntro=pickLocaleText(dl, { en: set.intro, ar: categoryCopy['multi-days-tours'].introAr });
  const catEyebrow=dl === 'ar' ? meta.eyebrowAr : meta.eyebrow;
  const liveCategories=useDbCategories(multiDayCategories);const liveMultiTours=useDbTours(multiDayTourBase,{includeNew:true,category:'multi-days-tours'});const entries=getPublishedMultiDayCategories(liveCategories).map((category)=>({category,tours:getMultiDayToursForCategory(liveMultiTours,category.slug)})).filter((entry)=>entry.tours.length>0);
  const total=entries.reduce((n,entry)=>n+entry.tours.length,0);
  const featured=entries.flatMap((entry)=>entry.tours)[0]??liveMultiTours[0];
  return <><TourCategoryHero showFeatured={!!featured} image={featured?.image || '/egypt-hero.png'} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={tx(dl, { en: 'Explore multi-day journeys', es: 'Explora los viajes de varios días', it: 'Esplora i viaggi di più giorni', ar: 'استكشف رحلات متعددة الأيام' })} primaryHref="#multi-day-categories" featuredLabel={tx(dl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'رحلة مميزة' })} featuredTitle={pickLocaleText(dl, { en: featured?.title ?? '', ar: featured?.titleAr })} featuredHref={`/egypt-tours/${featured?.slug ?? ''}`} featuredLocation={dl === 'ar' ? localizeTourLocation((featured?.location ?? '')) : (featured?.location ?? '')} featuredDuration={dl === 'ar' ? localizeTourDuration((featured?.duration ?? '')) : (featured?.duration ?? '')} statsLabel={tx(dl, { en: 'Multi-day tours summary', es: 'Resumen de viajes de varios días', it: 'Riepilogo dei viaggi di più giorni', ar: 'ملخص رحلات متعددة الأيام' })} stats={[{value:total,label:tx(dl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'رحلات متاحة' })},{value:entries.length,label:tx(dl, { en: 'Travel categories', es: 'Categorías de viaje', it: 'Categorie di viaggio', ar: 'فئات سفر' })}]}/><Breadcrumb items={[tx(dl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="multi-day-categories" className="listing-page container"><nav className="category-pills region-nav" aria-label={tx(dl, { en: 'Travel categories', es: 'Categorías de viaje', it: 'Categorie di viaggio', ar: 'فئات السفر' })}>{entries.map(({category})=><a key={category.slug} href={'#'+category.slug}>{dl==='ar'?category.nameAr:category.name}</a>)}</nav><p className="region-count">{tx(dl, { en: 'Browse', es: 'Explora', it: 'Sfoglia', ar: 'تصفح' })} <strong>{total}</strong> {tx(dl, { en: 'multi-day journeys across', es: 'viajes de varios días en', it: 'viaggi di più giorni in', ar: 'رحلة متعددة الأيام في' })} <strong>{entries.length}</strong> {tx(dl, { en: 'travel categories', es: 'categorías de viaje', it: 'categorie di viaggio', ar: 'فئات سفر' })}</p>{entries.map(({category,tours})=><section key={category.slug} id={category.slug} className="region-block" aria-label={dl==='ar'?category.nameAr:category.name}><div className="region-head"><div><span className="eyebrow">{catTitle}</span><h2>{dl==='ar'?category.nameAr:category.name}</h2><p>{dl==='ar'?category.copyAr:category.copy}</p></div><div className="region-badge-wrap"><span className="region-badge">{tours.length} {tx(dl, { en: 'tours', es: 'viajes', it: 'viaggi', ar: 'رحلات' })}</span><Link href={`/egypt-tours/multi-days-tours/${category.slug}`} className="region-see-more">{tx(dl, { en: 'See more', es: 'Ver más', it: 'Vedi di più', ar: 'شاهد المزيد' })} <ArrowRight size={14}/></Link></div></div><div className="compact-tour-grid region-tours">{tours.slice(0,4).map(t=><TourCard key={t.slug} tour={t} variant='multi'/>)}</div></section>)}<HelpCTA/></main></>
}

export function MultiDayCategoryPage({ categorySlug }: { categorySlug: string }) {
  return <SiteShell><Suspense><MultiDayCategoryContent categorySlug={categorySlug}/></Suspense></SiteShell>
}

function MultiDayCategoryContent({ categorySlug }: { categorySlug: string }) {
  const { locale } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const liveCategories = useDbCategories(multiDayCategories); const liveCatTours = useDbTours(multiDayTourBase,{includeNew:true,category:'multi-days-tours'}); const category = liveCategories.find((c) => c.slug === categorySlug); const tours = category ? getMultiDayToursForCategory(liveCatTours, category.slug) : []; const set = tourCategories['multi-days-tours']
  const variant = set.variant
  const meta = catMeta[variant]
  const HeroIcon = meta.HeroIcon

  const parentTitle = pickLocaleText(locale, { en: set.title, ar: categoryCopy['multi-days-tours'].titleAr })
  const categoryTitle = category ? pickLocaleText(locale, { en: category.name, ar: category.nameAr }) : categorySlug
  const categoryDesc = category ? pickLocaleText(locale, { en: category.copy, ar: category.copyAr }) : ''
  const sortLabel = (o: string) => tx(locale, { en: o, es: o === 'Price: low to high' ? 'Precio: de menor a mayor' : o === 'Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o === 'Price: low to high' ? 'Prezzo: dal più basso' : o === 'Price: high to low' ? 'Prezzo: dal più alto' : 'Consigliati', ar: o === 'Price: low to high' ? 'السعر: من الأقل' : o === 'Price: high to low' ? 'السعر: من الأعلى' : 'الموصى بها' })
  const destinationOptions = Array.from(new Set(tours.map((tour) => tour.location)))
  const durationOptions = Array.from(new Set(tours.map((tour) => tour.duration)))
  const query = parseTourListingQuery(searchParams, destinationOptions, durationOptions)
  const [destination, setDestination] = useState(query.destination)
  const [duration, setDuration] = useState(query.duration)
  const [price, setPrice] = useState(query.price)
  useEffect(() => { setDestination(query.destination); setDuration(query.duration); setPrice(query.price) }, [query.destination, query.duration, query.price])
  const perPage = 6
  const go = (next: TourListingQuery) => {
    const params = new URLSearchParams()
    if (next.destination) params.set('destination', next.destination)
    if (next.duration) params.set('duration', next.duration)
    if (next.price) params.set('price', next.price)
    if (next.sort !== 'Recommended') params.set('sort', next.sort)
    if (next.page > 1) params.set('page', String(next.page))
    const qs = params.toString()
    router.replace(pathname + (qs ? `?${qs}` : ''), { scroll: false })
  }
  const applyFilters = () => go({ destination, duration, price, sort: query.sort, page: 1 })
  const resetFilters = () => { setDestination(''); setDuration(''); setPrice(''); go({ destination: '', duration: '', price: '', sort: query.sort, page: 1 }) }
  const appliedCount = [query.destination, query.duration, query.price].filter(Boolean).length
  const filtered = tours.filter((t) => (!query.destination || t.location === query.destination) && (!query.duration || t.duration === query.duration) && matchPriceBand(t.price, query.price))
  const sorted = [...filtered].sort((a, b) => query.sort === 'Price: low to high' ? (a.price - b.price || (a.slug < b.slug ? -1 : 1)) : query.sort === 'Price: high to low' ? (b.price - a.price || (a.slug < b.slug ? -1 : 1)) : 0)
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage = Math.min(Math.max(1, query.page), totalPages)
  const paged = sorted.slice((safePage - 1) * perPage, safePage * perPage)

  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), parentTitle, categoryTitle]}/>{category && category.image ? <div className="mdc-cover"><img src={category.image} alt={categoryTitle}/></div> : null}
    <main className="listing-page container">
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34}/></span>
        <div>
          <span className="eyebrow">{tx(locale, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr })}</span>
          <h1>{categoryTitle}</h1>
          <p>{categoryDesc}</p>
          <div className="cat-feats">{meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) })).map((feature) => <span key={feature.text}><feature.Icon size={14}/>{feature.text}</span>)}</div>
        </div>
      </div>
      {!category || !category.active ? <div className="account-empty"><h3>{tx(locale, { en: 'Category not found.', es: 'Categoría no encontrada.', it: 'Categoria non trovata.', ar: 'الفئة غير موجودة.' })}</h3><p>{tx(locale, { en: 'The category you are looking for is not available right now.', es: 'La categoría que buscas no está disponible ahora mismo.', it: 'La categoria che cerchi non è disponibile al momento.', ar: 'الفئة التي تبحث عنها غير متاحة حاليا.' })}</p><Link href="/egypt-tours/multi-days-tours" className="primary-btn">{tx(locale, { en: 'Multi day tours', es: 'Viajes de varios días', it: 'Viaggi di più giorni', ar: 'رحلات متعددة الأيام' })}</Link></div> : tours.length ? <>
        <CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/>
        <div className="results-bar"><strong role="status">{tx(locale, { en: `${sorted.length} tour${sorted.length === 1 ? '' : 's'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} رحلات متاحة` })}</strong><SharedSelect value={query.sort} onChange={(o) => go({ ...query, sort: o as TourListingQuery['sort'], page: 1 })} locale={locale} label={tx(locale, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ترتيب حسب' })} options={tourListingSorts.map((o) => ({ value: o, label: sortLabel(o) }))} /></div>
        {paged.length ? <div className="listing-grid">{paged.map(t => <TourCard key={t.slug} tour={t} variant={variant}/>)}</div> : <div className="account-empty"><h3>{tx(locale, { en: 'No tours match your filters.', es: 'Ningún viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'لا توجد رحلات تطابق الفلاتر.' })}</h3><p>{tx(locale, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o restablece los filtros para verlo todo.', it: 'Prova un’altra destinazione o reimposta i filtri per vedere tutto.', ar: 'جرّب وجهة مختلفة أو أعد ضبط الفلاتر لرؤية كل شيء.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(locale, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'إعادة ضبط الفلاتر' })}</button></div>}
        <nav className="pagination" aria-label={tx(locale, { en: 'Tour listing pages', es: 'Páginas de viajes', it: 'Pagine dei viaggi', ar: 'صفحات الرحلات' })}><button type="button" onClick={() => go({ ...query, page: Math.max(1, safePage - 1) })} aria-label={tx(locale, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })} disabled={safePage <= 1} style={safePage <= 1 ? { opacity: .5 } : undefined}>{tx(locale, { en: '‹ Back', es: '‹ Atrás', it: '‹ Indietro', ar: '‹ السابق' })}</button>{Array.from({ length: totalPages }, (_, i) => safePage === i + 1 ? <b key={i + 1} aria-current="page">{i + 1}</b> : <button key={i + 1} type="button" aria-label={tx(locale, { en: `Go to page ${i + 1}`, es: `Ve a la página ${i + 1}`, it: `Vai alla pagina ${i + 1}`, ar: `انتقل إلى الصفحة ${i + 1}` })} onClick={() => go({ ...query, page: i + 1 })}>{i + 1}</button>)}<button type="button" onClick={() => go({ ...query, page: Math.min(totalPages, safePage + 1) })} aria-label={tx(locale, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })} disabled={safePage >= totalPages} style={safePage >= totalPages ? { opacity: .5 } : undefined}>{tx(locale, { en: 'Next ›', es: 'Siguiente ›', it: 'Avanti ›', ar: 'التالي ›' })}</button></nav>
      </> : <div className="account-empty"><h3>{tx(locale, { en: 'No journeys in this category yet.', es: 'Aún no hay viajes en esta categoría.', it: 'Non ci sono ancora viaggi in questa categoria.', ar: 'لا توجد رحلات في هذه الفئة بعد.' })}</h3><p>{tx(locale, { en: 'New journeys are added regularly  -  check back soon.', es: 'Añadimos viajes nuevos con frecuencia; vuelve pronto.', it: 'Aggiungiamo regolarmente nuovi viaggi; torna presto.', ar: 'نضيف رحلات جديدة باستمرار  -  عاود الزيارة قريباً.' })}</p></div>}
      <HelpCTA/>
    </main>
  </>
}

export function OneDayDestinationPage({ slug }: { slug: string }) {
  return <SiteShell><Suspense><OneDayDestinationContent slug={slug} /></Suspense></SiteShell>
}

function OneDayDestinationContent({ slug }: { slug: string }) {
  const { locale } = useLocale()
  const searchParams = useSearchParams()
  const set = tourCategories['one-day-tours']
  const variant = set.variant
  const meta = catMeta.day
  const HeroIcon = meta.HeroIcon

  const liveDestinations = useDbDestinations(destinations)
  const liveTours = useDbTours(oneDayTourBase,{includeNew:true,category:'one-day-tours'})
  const destination = liveDestinations.find((item) => item.slug === slug && item.showInOneDayTours === true)
  const tours = destination ? getOneDayToursForDestination(liveTours, destination.slug) : []
  const perPage = 9
  const queryPage = Number(searchParams.get('page'))
  const requestedPage = Number.isInteger(queryPage) && queryPage > 0 && queryPage <= 999 ? queryPage : 1
  const totalPages = Math.max(1, Math.ceil(tours.length / perPage))
  const safePage = Math.max(1, Math.min(requestedPage, totalPages))
  const paged = tours.slice((safePage - 1) * perPage, safePage * perPage)
  const makeHref = (number: number) => `/egypt-tours/one-day-tours/${slug}${number > 1 ? `?page=${number}` : ''}`
  const parentTitle = pickLocaleText(locale, { en: set.title, ar: categoryCopy['one-day-tours'].titleAr })
  if (!destination || destination.isPublished === false) {
    return <>
      <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), parentTitle]} />
      <main className="listing-page container"><div className="account-empty"><h3>{tx(locale, { en: 'Destination not found.', es: 'Destino no encontrado.', it: 'Destinazione non trovata.', ar: 'الوجهة غير موجودة.' })}</h3><p>{tx(locale, { en: 'The destination you are looking for is not available right now.', es: 'El destino que buscas no está disponible ahora mismo.', it: 'La destinazione che cerchi non è disponibile al momento.', ar: 'الوجهة التي تبحث عنها غير متاحة حاليا.' })}</p><Link href="/egypt-tours/one-day-tours" className="primary-btn">{tx(locale, { en: 'One day tours', es: 'Circuitos de un día', it: 'Tour di un giorno', ar: 'رحلات اليوم الواحد' })}</Link></div></main>
    </>
  }
  const destTitle = pickLocaleText(locale, { en: destination.title, ar: destination.nameAr })
  const destDesc = pickLocaleText(locale, { en: destination.copy, ar: destination.copyAr })
  return <>
    <Breadcrumb items={[tx(locale, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), parentTitle, destTitle]} />
    <main className="listing-page container">
      <div className={`cat-hero ${variant}`}>
        <span className="cat-hero-ic" aria-hidden="true"><HeroIcon size={34} /></span>
        <div>
          <span className="eyebrow">{tx(locale, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr })}</span>
          <h1>{destTitle}</h1>
          <p>{destDesc}</p>
          <div className="cat-feats">{meta.feats.map((feature, index) => ({ Icon: feature.Icon, text: featLabel(locale, feature.text, meta.featsAr[index]?.text ?? feature.text) })).map((feature) => <span key={feature.text}><feature.Icon size={14} />{feature.text}</span>)}</div>
        </div>
      </div>
      <div className="results-bar"><span>{tx(locale, { en: 'Showing', es: 'Mostrando', it: 'Visualizzati', ar: 'عرض' })} <strong>{paged.length}</strong> {tx(locale, { en: 'of', es: 'de', it: 'di', ar: 'من' })} <strong>{tours.length}</strong> {tx(locale, { en: 'tours', es: 'recorridos', it: 'tour', ar: 'رحلة' })}</span></div>
      {paged.length ? <div className="compact-tour-grid region-tours">{paged.map((tour) => <TourCard key={tour.slug} tour={tour} variant={variant} />)}</div> : <p className="region-count">{tx(locale, { en: 'No tours available at the moment.', es: 'No hay viajes disponibles por el momento.', it: 'Nessun viaggio disponibile al momento.', ar: 'لا توجد رحلات حالياً' })}</p>}
      {totalPages > 1 && <nav className="pagination" aria-label={tx(locale, { en: 'Pagination', es: 'Paginación', it: 'Paginazione', ar: 'صفحات الرحلات' })}>
        <Link href={makeHref(safePage - 1)} className={safePage <= 1 ? 'disabled' : ''} aria-disabled={safePage <= 1} onClick={(event) => { if (safePage <= 1) event.preventDefault() }}><ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> {tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente', ar: 'السابق' })}</Link>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link key={number} href={makeHref(number)} className={number === safePage ? 'active' : ''} aria-current={number === safePage ? 'page' : undefined}>{number}</Link>)}
        <Link href={makeHref(safePage + 1)} className={safePage >= totalPages ? 'disabled' : ''} aria-disabled={safePage >= totalPages} onClick={(event) => { if (safePage >= totalPages) event.preventDefault() }}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Avanti', ar: 'التالي' })} <ArrowRight size={14} /></Link>
      </nav>}
    </main>
  </>
}

export function MultiDayToursCategories(){return <SiteShell><MultiDayToursCategoriesContent/></SiteShell>}
export const catMeta: Record<TourVariant, { eyebrow: string; eyebrowAr: string; HeroIcon: typeof Sun; feats: { Icon: typeof Sun; text: string }[]; featsAr: { Icon: typeof Sun; text: string }[] }> = {
  multi: { eyebrow: 'Take your time', eyebrowAr: 'خذ وقتك', HeroIcon: Package, feats: [{ Icon: MapPin, text: 'Multi-city routes' }, { Icon: Users, text: 'Private groups' }], featsAr: [{ Icon: MapPin, text: 'مسارات متعددة المدن' }, { Icon: Users, text: 'مجموعات خاصة' }] },
  day: { eyebrow: 'One day, zero rush', eyebrowAr: 'يوم واحد بدون استعجال', HeroIcon: Sun, feats: [{ Icon: Clock3, text: 'Hours, not days' }, { Icon: MapPin, text: 'Single city' }], featsAr: [{ Icon: Clock3, text: 'ساعات لا أيام' }, { Icon: MapPin, text: 'مدينة واحدة' }] },
  cruise: { eyebrow: 'Sail in style', eyebrowAr: 'أبحر بأناقة', HeroIcon: Ship, feats: [{ Icon: Star, text: '5-star decks' }, { Icon: Users, text: 'Full board' }], featsAr: [{ Icon: Star, text: 'أجنحة 5 نجوم' }, { Icon: Users, text: 'إقامة شاملة' }] },
  shore: { eyebrow: 'From port to wonders', eyebrowAr: 'من الميناء إلى العجائب', HeroIcon: Anchor, feats: [{ Icon: Anchor, text: 'Port pickup' }, { Icon: Clock3, text: 'Back on time' }], featsAr: [{ Icon: Anchor, text: 'استلام من الميناء' }, { Icon: Clock3, text: 'عودة في الموعد' }] },
}

export const categoryCopy: Record<TourCategory, { titleAr: string; introAr: string }> = {
  'one-day-tours': { titleAr: 'رحلات اليوم الواحد', introAr: 'اكتشف أعظم كنوز مصر في يوم واحد لا يُنسى.' },
  'multi-days-tours': { titleAr: 'رحلات متعددة الأيام', introAr: 'خذ وقتك واستمتع بمصر أبعد من المعالم.' },
  'nile-cruises': { titleAr: 'كروز النيل', introAr: 'أبحر بين المعابد القديمة براحة وخدمة ومناظر لا تُنسى.' },
  'shore-excursions': { titleAr: 'رحلات الشواطئ', introAr: 'استغل كل ميناء مع رحلات شاطئية مخططة بخبرة.' },
}
const eyebrowEs: Record<string, string> = { 'Take your time': 'Tómate tu tiempo', 'One day, zero rush': 'Un día sin prisas', 'Sail in style': 'Navega con estilo', 'From port to wonders': 'Del puerto a las maravillas' }
const eyebrowIt: Record<string, string> = { 'Take your time': 'Prenditi il tuo tempo', 'One day, zero rush': 'Un giorno senza fretta', 'Sail in style': 'Naviga con stile', 'From port to wonders': 'Dal porto alle meraviglie' }
const featEs: Record<string, string> = { 'Multi-city routes': 'Rutas por varias ciudades', 'Private groups': 'Grupos privados', 'Hours, not days': 'Horas, no días', 'Single city': 'Una sola ciudad', '5-star decks': 'Cubiertas de 5 estrellas', 'Full board': 'Pensión completa', 'Port pickup': 'Recogida en el puerto', 'Back on time': 'Regreso a tiempo', 'Nile itineraries': 'Itinerarios por el Nilo', 'Cruise options': 'Opciones de crucero' }
const featIt: Record<string, string> = { 'Multi-city routes': 'Itinerari multi-città', 'Private groups': 'Gruppi privati', 'Hours, not days': 'Ore, non giorni', 'Single city': 'Una sola città', '5-star decks': 'Ponti a 5 stelle', 'Full board': 'Pensione completa', 'Port pickup': 'Prelievo al porto', 'Back on time': 'Rientro in orario', 'Nile itineraries': 'Itinerari sul Nilo', 'Cruise options': 'Opzioni di crociera' }
function featLabel(locale: Locale, text: string, arText: string) { return tx(locale, { en: text, es: featEs[text] ?? text, it: featIt[text] ?? text, ar: arText }) }

const crumbNames: Record<string, { ar: string; es: string; it: string }> = {'Egypt Tours': { ar: 'جولات مصر', es: 'Circuitos por Egipto', it: 'Tour in Egitto' }, 'Nile Cruises': { ar: 'رحلات النيل', es: 'Cruceros por el Nilo', it: 'Crociere sul Nilo' }, Trips: { ar: 'كل الرحلات', es: 'Viajes', it: 'Viaggi' }}
export function Breadcrumb({items}:{items:string[]}){const {locale}=useLocale(); return <div className="breadcrumb"><div className="container"><Link href="/">{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link>{items.map(i=><span key={i}>› {tx(locale, { en: i, es: crumbNames[i]?.es, it: crumbNames[i]?.it, ar: crumbNames[i]?.ar })}</span>)}</div></div>}

export function Heading({title,copy}:{title:string;copy?:string}){return <div className="section-heading"><h1>{title}</h1>{copy&&<p>{copy}</p>}</div>}

export type TourFilters={destination:string;duration:string;price:string}

export function CategoryFilter({destination,duration,price,destinationOptions,durationOptions,appliedCount,onDestination,onDuration,onPrice,onSearch,onReset}:{destination:string;duration:string;price:string;destinationOptions:readonly string[];durationOptions:readonly string[];appliedCount:number;onDestination:(v:string)=>void;onDuration:(v:string)=>void;onPrice:(v:string)=>void;onSearch:()=>void;onReset:()=>void}){const {currency,locale:fl}=useLocale(); const lo=formatPrice(200,currency,fl); const hi=formatPrice(400,currency,fl); const bandLabel=(id:string)=>tx(fl, { en: id==='under-200' ? `Under ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Over ${hi}`, es: id==='under-200' ? `Menos de ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Más de ${hi}`, it: id==='under-200' ? `Meno di ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `Più di ${hi}`, ar: id==='under-200' ? `أقل من ${lo}` : id==='200-400' ? `${lo} - ${hi}` : `أكثر من ${hi}` }); const rtl=typeof document!=='undefined'&&document.documentElement.dir==='rtl'; return <div className="category-filter"><div className="filter-wrapper" dir={rtl ? 'rtl' : 'ltr'}><div className="filter-grid"><label className="filter-field"><span>{tx(fl, { en: 'Destination', es: 'Destino', it: 'Destinazione', ar: 'الوجهة' })}</span><SharedSelect value={destination} onChange={onDestination} locale={fl} options={[{value:'',label:tx(fl, { en: 'All destinations', es: 'Todos los destinos', it: 'Tutte le destinazioni', ar: 'كل الوجهات' })},...destinationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Duration', es: 'Duración', it: 'Durata', ar: 'المدة' })}</span><SharedSelect value={duration} onChange={onDuration} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any duration', es: 'Cualquier duración', it: 'Qualsiasi durata', ar: 'أي مدة' })},...durationOptions.map((d)=>({value:d,label:d}))]} /></label><label className="filter-field"><span>{tx(fl, { en: 'Price', es: 'Precio', it: 'Prezzo', ar: 'السعر' })}</span><SharedSelect value={price} onChange={onPrice} locale={fl} options={[{value:'',label:tx(fl, { en: 'Any price', es: 'Cualquier precio', it: 'Qualsiasi prezzo', ar: 'أي سعر' })},...tourPriceBands.filter((band)=>band.id!=='').map((band)=>({value:band.id,label:bandLabel(band.id)}))]} /></label></div><div className="filter-actions">{appliedCount>0?<div className="applied-count">{tx(fl, { en: `${appliedCount} filter${appliedCount!==1?'s':''} applied`, es: `${appliedCount} filtro${appliedCount!==1?'s':''} aplicado`, it: `${appliedCount} filtro${appliedCount!==1?'i':''} applicati`, ar: `${appliedCount} فلتر${appliedCount!==1?'s':''} مطبق` })}</div>:null}<button type="button" className="reset-btn" onClick={onReset}>{tx(fl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'إعادة ضبط الفلاتر' })}</button><button type="button" className="primary-btn search-btn" onClick={onSearch}>{tx(fl, { en: 'Search', es: 'Buscar', it: 'Cerca', ar: 'بحث' })}</button></div></div></div>}

export function TourListing({slug}:{slug:TourCategory}){return <SiteShell><Suspense><TourListingInner slug={slug}/></Suspense></SiteShell>}

function TourListingInner({slug}:{slug:TourCategory}){const set=tourCategories[slug]; const variant=set.variant; const meta=catMeta[variant]; const {locale:tl}=useLocale(); const catTitle=pickLocaleText(tl, { en: set.title, ar: categoryCopy[slug].titleAr }); const catIntro=pickLocaleText(tl, { en: set.intro, ar: categoryCopy[slug].introAr }); const catEyebrow=tx(tl, { en: meta.eyebrow, es: eyebrowEs[meta.eyebrow] ?? meta.eyebrow, it: eyebrowIt[meta.eyebrow] ?? meta.eyebrow, ar: meta.eyebrowAr }); const sortLabel=(o:string)=>tx(tl, { en: o, es: o==='Price: low to high' ? 'Precio: de menor a mayor' : o==='Price: high to low' ? 'Precio: de mayor a menor' : 'Recomendados', it: o==='Price: low to high' ? 'Prezzo: dal più basso' : o==='Price: high to low' ? 'Prezzo: dal più alto' : 'Consigliati', ar: o==='Price: low to high' ? 'السعر: من الأقل' : o==='Price: high to low' ? 'السعر: من الأعلى' : 'الموصى بها' }); const allTours=useDbTours(getToursByCategory(slug),{includeNew:true,category:slug}); const featured=allTours[0]; const destinationOptions=Array.from(new Set(allTours.map((tour)=>tour.location))); const durationOptions=Array.from(new Set(allTours.map((tour)=>tour.duration))); const searchParams=useSearchParams(); const router=useRouter(); const pathname=usePathname(); const query=parseTourListingQuery(searchParams,destinationOptions,durationOptions); const [destination,setDestination]=useState(query.destination); const [duration,setDuration]=useState(query.duration); const [price,setPrice]=useState(query.price); useEffect(()=>{setDestination(query.destination);setDuration(query.duration);setPrice(query.price)},[query.destination,query.duration,query.price]); const perPage=6; const go=(next:TourListingQuery)=>{const params=new URLSearchParams(); if(next.destination)params.set('destination',next.destination); if(next.duration)params.set('duration',next.duration); if(next.price)params.set('price',next.price); if(next.sort!=='Recommended')params.set('sort',next.sort); if(next.page>1)params.set('page',String(next.page)); const qs=params.toString(); router.replace(pathname+(qs?`?${qs}`:''),{scroll:false})}; const applyFilters=()=>go({destination,duration,price,sort:query.sort,page:1}); const resetFilters=()=>{setDestination('');setDuration('');setPrice('');go({destination:'',duration:'',price:'',sort:query.sort,page:1})}; const appliedCount=[query.destination,query.duration,query.price].filter(Boolean).length; const filtered=allTours.filter((t)=>(!query.destination||t.location===query.destination)&&(!query.duration||t.duration===query.duration)&&matchPriceBand(t.price,query.price)); const sorted=[...filtered].sort((a,b)=>query.sort==='Price: low to high'?(a.price-b.price||(a.slug<b.slug?-1:1)):query.sort==='Price: high to low'?(b.price-a.price||(a.slug<b.slug?-1:1)):0); const totalPages=Math.max(1,Math.ceil(sorted.length/perPage)); const safePage=Math.min(Math.max(1,query.page),totalPages); const paged=sorted.slice((safePage-1)*perPage,safePage*perPage); const isShore=slug==='shore-excursions'; return <><TourCategoryHero showFeatured={!!featured} image={featured?.image || '/egypt-hero.png'} eyebrow={catEyebrow} title={catTitle} intro={catIntro} primaryLabel={isShore ? tx(tl, { en: 'Explore shore excursions', es: 'Explora las excursiones en tierra', it: 'Esplora le escursioni a terra', ar: 'استكشف رحلات الموانئ' }) : tx(tl, { en: 'Explore journeys', es: 'Explora los viajes', it: 'Esplora i viaggi', ar: 'استكشف الباقات' })} primaryHref="#tour-listing" featuredLabel={isShore ? tx(tl, { en: 'Featured shore excursion', es: 'Excursión en tierra destacada', it: 'Escursione a terra in evidenza', ar: 'رحلة ميناء مميزة' }) : tx(tl, { en: 'Featured journey', es: 'Viaje destacado', it: 'Viaggio in evidenza', ar: 'باقة مميزة' })} featuredTitle={pickLocaleText(tl, { en: featured?.title ?? '', ar: featured?.titleAr })} featuredHref={`/egypt-tours/${featured?.slug ?? ''}`} featuredLocation={tl === 'ar' ? localizeTourLocation((featured?.location ?? '')) : (featured?.location ?? '')} featuredDuration={tl === 'ar' ? localizeTourDuration((featured?.duration ?? '')) : (featured?.duration ?? '')} statsLabel={tx(tl, { en: 'Tours summary', es: 'Resumen de viajes', it: 'Riepilogo dei viaggi', ar: 'ملخص الرحلات' })} stats={[{value:allTours.length,label:isShore ? tx(tl, { en: 'Shore excursions', es: 'Excursiones en tierra', it: 'Escursioni a terra', ar: 'رحلات موانئ' }) : tx(tl, { en: 'Journeys available', es: 'Viajes disponibles', it: 'Viaggi disponibili', ar: 'باقات متاحة' })},{value:destinationOptions.length,label:isShore ? tx(tl, { en: 'Ports & destinations', es: 'Puertos y destinos', it: 'Porti e destinazioni', ar: 'موانئ ووجهات' }) : tx(tl, { en: 'Egypt destinations', es: 'Destinos egipcios', it: 'Destinazioni egiziane', ar: 'وجهات مصرية' })}]}/><Breadcrumb items={[tx(tl, { en: 'Egypt Tours', es: 'Circuitos por Egipto', it: 'Tour in Egitto', ar: 'جولات مصر' }), catTitle]}/><main id="tour-listing" className="listing-page container"><CategoryFilter destination={destination} duration={duration} price={price} destinationOptions={destinationOptions} durationOptions={durationOptions} appliedCount={appliedCount} onDestination={setDestination} onDuration={setDuration} onPrice={setPrice} onSearch={applyFilters} onReset={resetFilters}/><div className="results-bar"><strong role="status">{tx(tl, { en: `${sorted.length} tour${sorted.length===1?'':'s'} found`, es: `${sorted.length} recorridos disponibles`, it: `${sorted.length} tour disponibili`, ar: `${sorted.length} رحلات متاحة` })}</strong><SharedSelect value={query.sort} onChange={(o)=>go({...query,sort:o as TourListingQuery['sort'],page:1})} locale={tl} label={tx(tl, { en: 'Sort by', es: 'Ordenar por', it: 'Ordina per', ar: 'ترتيب حسب' })} options={tourListingSorts.map((o)=>({value:o,label:sortLabel(o)}))} /></div>{paged.length?<div className="listing-grid">{paged.map(t=><TourCard key={t.slug} tour={t} variant={variant}/>)}</div>:<div className="account-empty"><h3>{tx(tl, { en: 'No tours match your filters.', es: 'Ningún viaje coincide con tus filtros.', it: 'Nessun viaggio corrisponde ai tuoi filtri.', ar: 'لا توجد رحلات تطابق الفلاتر.' })}</h3><p>{tx(tl, { en: 'Try a different destination or reset the filters to see everything.', es: 'Prueba otro destino o borra los filtros para verlo todo.', it: 'Prova un’altra destinazione o cancella i filtri per vedere tutto.', ar: 'جرّب وجهة مختلفة أو امسح الفلاتر لعرض كل الرحلات.' })}</p><button type="button" className="primary-btn" onClick={resetFilters}>{tx(tl, { en: 'Reset Filters', es: 'Borrar filtros', it: 'Cancella i filtri', ar: 'مسح الفلاتر' })}</button></div>}<nav className="pagination" aria-label={tx(tl, { en: 'Tour listing pages', es: 'Páginas de viajes', it: 'Pagine dei viaggi', ar: 'صفحات الرحلات' })}><button type="button" onClick={()=>go({...query,page:Math.max(1,safePage-1)})} aria-label={tx(tl, { en: 'Previous page', es: 'Página anterior', it: 'Pagina precedente', ar: 'الصفحة السابقة' })} disabled={safePage<=1} style={safePage<=1?{opacity:.5}:undefined}>{tx(tl, { en: '‹ Back', es: '‹ Atrás', it: '‹ Indietro', ar: '› السابق' })}</button>{Array.from({length:totalPages},(_,i)=>safePage===i+1?<b key={i+1} aria-current="page">{i+1}</b>:<button key={i+1} type="button" aria-label={tx(tl, { en: `Go to page ${i+1}`, es: `Ve a la página ${i+1}`, it: `Vai alla pagina ${i+1}`, ar: `انتقل إلى صفحة ${i+1}` })} onClick={()=>go({...query,page:i+1})}>{i+1}</button>)}<button type="button" onClick={()=>go({...query,page:Math.min(totalPages,safePage+1)})} aria-label={tx(tl, { en: 'Next page', es: 'Página siguiente', it: 'Pagina successiva', ar: 'الصفحة التالية' })} disabled={safePage>=totalPages} style={safePage>=totalPages?{opacity:.5}:undefined}>{tx(tl, { en: 'Next ›', es: 'Siguiente ›', it: 'Avanti ›', ar: 'التالي ‹' })}</button></nav></main><HelpCTA/></>}

export function HelpCTA(){return <SharedHelpCTA />}

export function HomePage(){return <SiteShell><main><section className="hero"><img src="/egypt-hero.png" alt="Egyptian temple and desert"/><div className="hero-overlay"/><div className="hero-copy"><span>Get started your</span><h1>Exciting Journey With Us</h1></div><TripSearchEngine/></section><section className="stats container">{[['+100K','Happy customers'],['+50','Years of experience'],['+60','Total destinations'],['5.0','Rating in Tripadvisor']].map(([a,b])=><div key={b}><b>{a}</b><span>{b}</span></div>)}</section><section className="section container"><Heading title="Explore Egypt's Top Tours" copy="From the Pyramids to the Nile - find your perfect adventure."/><div className="tour-grid">{seasonalTours.map(t=><TourCard key={t.slug} tour={t}/>)}</div></section><section className="section pale"><div className="container"><Heading title="Popular Destination" copy="Every corner of Egypt has a story waiting for you."/><div className="destination-grid">{['Pyramids & Giza','White Desert','Nile Valley','Red Sea','Luxor Temples','Cairo Markets'].map((x,i)=><article className="destination" key={x}><img src={images[(i+1)%images.length]} alt={x}/><div><small>Explore now</small><h3>{x}</h3></div></article>)}</div></div></section><section className="section how"><div className="container"><Heading title="How it works?" copy="Only three steps away from Egypt."/><div className="steps">{['Finding Trip','Booking','Enjoy'].map((x,i)=><div key={x}><b>{i+1}</b><h3>{x}</h3><p>Start your journey</p></div>)}</div></div></section><section className="section container"><Heading title="Highlights of Egypt" copy="Discover the most important landmarks in Egypt."/><div className="highlight-row">{['Aswan Tours','Hurghada Tours','Sharm El Sheikh Tours','Dahab Tours'].map((x,i)=><div key={x}><img src={images[i%images.length]} alt={x}/><strong>{x}</strong></div>)}</div></section><HelpCTA/></main></SiteShell>}
