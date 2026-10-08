"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Heart, MapPin, Minus, Plus, Share2, ShieldCheck, Users } from "lucide-react"
import { dayTourTerms, getBookingTotal, getTourDestinationSlug, getToursByCategory, normalizeTourPricePeriods } from "@/data/tours"
import { destinations, findDestination, siteImages } from "@/data/content"
import type { Tour, TourAddOn } from "@/data/types"
import { formatPrice, tx, useLocale } from "./locale"
import { pickLocaleText } from "@/lib/locale-config"
import { addToCart } from "@/lib/cart"
import { useCustomerFavorites } from "@/lib/customer-account"
import { formatTourDateRange, localizeTourDuration, localizeTourLocation } from "@/lib/tour-format"
import { TourReviewsSection } from "./reviews"
import { TourVideoGallery } from "./tour-video-gallery"
import { AskQuestionButton } from "./ask-question"
import { HorizontalSlider } from "./horizontal-slider"
import { TourLocationMap } from "./tour-detail"
import { useDbDestinations } from '@/lib/catalogue-client'
import { DateInput } from "./date-input"

type GalleryImage = { src: string; alt: string }

const cairoStreet = "https://images.unsplash.com/photo-1707172889437-dc6f210ea44a?auto=format&fit=crop&w=1400&q=86"
const redSeaReef = "https://images.unsplash.com/photo-1581088053806-9ea7682a41e8?auto=format&fit=crop&w=1400&q=86"

const luxorHeroFallback = findDestination("luxor")!.detail.heroImage
const aswanHeroFallback = findDestination("aswan")!.detail.heroImage

const buildRegionGalleries = (luxorHero: string, aswanHero: string): Record<string, readonly GalleryImage[]> => ({
  Cairo: [
    { src: cairoStreet, alt: "Historic street in Cairo" },
    { src: siteImages.pyramids, alt: "Pyramids and Sphinx in nearby Giza" },
  ],
  Giza: [
    { src: siteImages.pyramids, alt: "Great Sphinx and pyramids in Giza" },
    { src: "https://images.unsplash.com/photo-1636020833630-89d4a5a75807?auto=format&fit=crop&w=1400&q=86", alt: "Sphinx and Pyramid of Khafre" },
  ],
  Luxor: [
    { src: luxorHero, alt: "Karnak Temple in Luxor" },
    { src: "/egypt-hero.png", alt: "Temple columns in Luxor" },
  ],
  Aswan: [
    { src: aswanHero, alt: "Nubian village beside the Nile in Aswan" },
    { src: "https://images.unsplash.com/photo-1655163394179-8b30a553dd6c?auto=format&fit=crop&w=1400&q=86", alt: "Nubian houses beside the Nile" },
  ],
  Hurghada: [
    { src: siteImages.redSea, alt: "Red Sea diving scene" },
    { src: redSeaReef, alt: "Coral and fish in the Red Sea" },
  ],
  "Sharm El Sheikh": [
    { src: siteImages.redSea, alt: "Red Sea diving scene" },
    { src: redSeaReef, alt: "Coral and fish in the Red Sea" },
  ],
})

export function DayTourDetailPage({ tour: sourceTour, related: relatedProp }: { tour: Tour; related?: Tour[] }) {
  const { currency, locale } = useLocale()
  const tour = { ...sourceTour, title: pickLocaleText(locale, { en: sourceTour.title, ar: sourceTour.titleAr }) }
  const detail = tour.dayDetail
  const included = detail?.included ?? dayTourTerms.included
  const excluded = detail?.excluded ?? dayTourTerms.excluded
  const addOns: readonly TourAddOn[] = detail?.addOns ?? dayTourTerms.addOns
  const dbDestinations = useDbDestinations(destinations)
  const galleries = buildRegionGalleries(
    dbDestinations.find((d) => d.slug === 'luxor')?.detail.heroImage || luxorHeroFallback,
    dbDestinations.find((d) => d.slug === 'aswan')?.detail.heroImage || aswanHeroFallback,
  )
  const gallery = detail?.gallery?.length ? detail.gallery : galleries[tour.location] ?? [{ src: tour.image, alt: `${tour.location} travel scene` }]
  const region = dbDestinations.find((item) => item.slug === getTourDestinationSlug(sourceTour))
  const regionName = region ? pickLocaleText(locale, { en: region.title, ar: region.nameAr }) : tour.location
  const locationName = locale === 'ar' ? localizeTourLocation(tour.location) : tour.location
  const durationName = locale === 'ar' ? localizeTourDuration(tour.duration) : tour.duration
  const regionHref = region ? `/egypt-tours/one-day-tours/${region.slug}` : "/egypt-tours/one-day-tours"
  const related = relatedProp ?? getToursByCategory("one-day-tours").filter((item) => item.slug !== tour.slug && item.location === tour.location).slice(0, 4)
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState("overview")
  const [openStop, setOpenStop] = useState(0)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [travelDate, setTravelDate] = useState("")
  const router = useRouter()
  const favorites = useCustomerFavorites()
  const favorite = favorites.has(tour.slug)
  const [selectedAddOns, setSelectedAddOns] = useState<number[]>([])
  const selectedAddOnTotal = selectedAddOns.reduce((sum, index) => sum + (addOns[index]?.price ?? 0), 0)
  const hasUnpricedAddOns = selectedAddOns.some((index) => addOns[index]?.price === undefined)
  const heads = Math.max(1, adults + children + infants)
  const pricing = getBookingTotal(tour, adults, children, infants)
  const locations = detail?.locations?.length ? detail.locations : [tour.location]
  const pricePeriods = normalizeTourPricePeriods(detail?.priceRows, tx(locale, { en: 'Available travel dates', es: 'Fechas de viaje disponibles', it: 'Date di viaggio disponibili', ar: 'مواعيد السفر المتاحة' }))
  const planHref = `/make-your-trip?tour=${encodeURIComponent(tour.slug)}&adults=${adults}&children=${children}&infants=${infants}&guests=${heads}${travelDate ? `&date=${encodeURIComponent(travelDate)}` : ""}${selectedAddOns.length ? `&addons=${selectedAddOns.join(",")}` : ""}`
  const tabs = [{ id: "overview", label: tx(locale, { en: "Overview", es: "Resumen", it: "Panoramica", ar: "نظرة عامة" }) }, { id: "highlights", label: tx(locale, { en: "Highlights", es: "Lo destacado", it: "Punti salienti", ar: "أبرز المعالم" }) }, { id: "itinerary", label: tx(locale, { en: "Itinerary", es: "Itinerario", it: "Itinerario", ar: "برنامج الزيارة" }) }, { id: "inclusions", label: tx(locale, { en: "Inclusions", es: "Inclusiones", it: "Inclusioni", ar: "المشمول" }) }, { id: "add-ons", label: tx(locale, { en: "Add-ons", es: "Extras", it: "Extra", ar: "إضافات" }) }, { id: "location", label: tx(locale, { en: "Location", es: "Ubicación", it: "Posizione", ar: "الموقع" }) }, ...(pricePeriods.length ? [{ id: "prices", label: tx(locale, { en: "Prices", es: "Precios", it: "Prezzi", ar: "الأسعار" }) }] : []), { id: "reviews", label: tx(locale, { en: "Reviews", es: "Reseñas", it: "Recensioni", ar: "التقييمات" }) }]
  const reviewCopy = {
    en: { heading: 'Write a review', forTour: 'Reviewing', title: 'Reviews', summaryReviews: 'reviews', beFirst: 'Be the first to review this trip', justNow: 'Just now', more: 'Read more', less: 'Show less', reviewTitle: 'Review title', reviewTitlePh: 'e.g. Amazing trip!', platform: 'Platform', rating: 'Rating', review: 'Your review', reviewPh: 'Tell us about your trip...', cancel: 'Cancel', submit: 'Submit review' },
    es: { heading: 'Escribe una reseña', forTour: 'Reseña del viaje', title: 'Reseñas', summaryReviews: 'reseñas', beFirst: 'Sé el primero en reseñar este viaje', justNow: 'Ahora mismo', more: 'Leer más', less: 'Mostrar menos', reviewTitle: 'Título de la reseña', reviewTitlePh: 'p. ej. ¡Viaje increíble!', platform: 'Plataforma', rating: 'Valoración', review: 'Tu reseña', reviewPh: 'Cuéntanos sobre tu viaje...', cancel: 'Cancelar', submit: 'Enviar reseña' },
    it: { heading: 'Scrivi una recensione', forTour: 'Recensione del viaggio', title: 'Recensioni', summaryReviews: 'recensioni', beFirst: 'Sii il primo a recensire questo viaggio', justNow: 'Proprio ora', more: 'Leggi di più', less: 'Mostra meno', reviewTitle: 'Titolo della recensione', reviewTitlePh: 'es. Viaggio fantastico!', platform: 'Piattaforma', rating: 'Valutazione', review: 'La tua recensione', reviewPh: 'Raccontaci il tuo viaggio...', cancel: 'Annulla', submit: 'Invia recensione' },
    ar: { heading: 'اكتب تقييمك', forTour: 'تقييم رحلة', title: 'التقييمات', summaryReviews: 'تقييمات', beFirst: 'كن أول من يقيّم هذه الرحلة', justNow: 'الآن', more: 'اقرأ المزيد', less: 'عرض أقل', reviewTitle: 'عنوان التقييم', reviewTitlePh: 'مثال: رحلة رائعة!', platform: 'المنصة', rating: 'التقييم', review: 'تقييمك', reviewPh: 'حدثنا عن رحلتك...', cancel: 'إلغاء', submit: 'إرسال التقييم' },
  } as const
  const shareTour = async () => {
    try {
      if (navigator.share) await navigator.share({ title: tour.title, url: window.location.href })
      else await navigator.clipboard.writeText(window.location.href)
    } catch { /* Share can be dismissed without changing the page. */ }
  }

  return <>
    <div className="tour-breadcrumb day-tour-breadcrumb container"><Link href="/">{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link><span>/</span><Link href="/egypt-tours/one-day-tours">{tx(locale, { en: 'One Day Tours', es: 'Circuitos de un día', it: 'Tour di un giorno', ar: 'رحلات اليوم الواحد' })}</Link>{region && <><span>/</span><Link href={regionHref}>{regionName}</Link></>}<span>/</span><span>{tour.title}</span></div>
    <main className="tour-detail-page day-tour-detail container">
      <header className="tour-detail-header"><div><span className="eyebrow">{tx(locale, { en: 'One day Egypt experience', es: 'Una experiencia egipcia en un día', it: 'Un’esperienza egiziana in un giorno', ar: 'تجربة مصرية في يوم واحد' })}</span><h1>{tour.title}</h1></div><button type="button" className={`tour-favorite ${favorite ? "active" : ""}`} onClick={() => favorites.toggle(tour.slug)} aria-label={tx(locale, { en: 'Save tour', es: 'Guardar el viaje', it: 'Salva il viaggio', ar: 'احفظ الرحلة' })} aria-pressed={favorite}><Heart size={20} fill={favorite ? "currentColor" : "none"} /></button></header>
      <div className="tour-detail-layout">
        <div className="tour-detail-main">
          <div className="tour-gallery">
            <div className="tour-gallery-main"><Image src={gallery[selectedImage].src} alt={gallery[selectedImage].alt} fill priority sizes="(max-width: 900px) 100vw, 65vw" />{gallery.length > 1 && <><button type="button" className="gallery-arrow left" aria-label={tx(locale, { en: 'Previous image', es: 'Imagen anterior', it: 'Immagine precedente', ar: 'الصورة السابقة' })} onClick={() => setSelectedImage((selectedImage + gallery.length - 1) % gallery.length)}>‹</button><button type="button" className="gallery-arrow right" aria-label={tx(locale, { en: 'Next image', es: 'Imagen siguiente', it: 'Immagine successiva', ar: 'الصورة التالية' })} onClick={() => setSelectedImage((selectedImage + 1) % gallery.length)}>›</button></>}</div>
            {gallery.length > 1 && <div className="tour-thumbs">{gallery.map((image, index) => <button type="button" key={image.src} className={selectedImage === index ? "active" : ""} aria-label={tx(locale, { en: `Show image ${index + 1}: ${image.alt}`, es: `Mostrar imagen ${index + 1}: ${image.alt}`, it: `Mostra l'immagine ${index + 1}: ${image.alt}`, ar: `عرض الصورة ${index + 1}` })} aria-pressed={selectedImage === index} onClick={() => setSelectedImage(index)}><Image src={image.src} alt="" fill sizes="80px" /></button>)}</div>}
            <p className="day-tour-gallery-note">{tx(locale, { en: 'Destination imagery; the confirmed visit stops are agreed before booking.', es: 'Imágenes ilustrativas del destino; las paradas confirmadas se acuerdan antes de reservar.', it: 'Immagini illustrative della destinazione; le tappe confermate si concordano prima della prenotazione.', ar: 'صور توضيحية للوجهة؛ تُحدد محطات الزيارة المؤكدة قبل الحجز.' })}</p>
          </div>
          <div className="tour-facts"><span><Clock3 size={18} /><b>{tx(locale, { en: 'Duration', es: 'Duración', it: 'Durata', ar: 'المدة' })}</b>{durationName}</span><span><MapPin size={18} /><b>{tx(locale, { en: 'Area', es: 'Zona', it: 'Zona', ar: 'المنطقة' })}</b>{locationName}</span><span><Users size={18} /><b>{tx(locale, { en: 'Group size', es: 'Tamaño del grupo', it: 'Dimensioni del gruppo', ar: 'حجم المجموعة' })}</b>{tour.groupSize ?? tx(locale, { en: 'On request', es: 'A petición', it: 'Su richiesta', ar: 'حسب الطلب' })}</span><span><ShieldCheck size={18} /><b>{tx(locale, { en: 'Travel style', es: 'Estilo de viaje', it: 'Stile di viaggio', ar: 'نمط الرحلة' })}</b>{tour.travelStyle ?? tx(locale, { en: 'Tailored', es: 'A medida', it: 'Su misura', ar: 'مخصص' })}</span></div>
          <nav className="tour-tabs" aria-label={tx(locale, { en: "Tour sections", es: "Secciones del viaje", it: "Sezioni del viaggio", ar: "أقسام الرحلة" })}>{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => { setActiveTab(tab.id); document.getElementById(tab.id)?.scrollIntoView({ behavior: "smooth" }) }}>{tab.label}</button>)}</nav>

          <section id="overview" className="tour-content-section"><h2>{tx(locale, { en: 'Overview', es: 'Resumen', it: 'Panoramica', ar: 'نظرة عامة' })}</h2><div className="overview-grid"><div><small>{tx(locale, { en: 'Duration', es: 'Duración', it: 'Durata', ar: 'المدة' })}</small><b>{durationName}</b></div><div><small>{tx(locale, { en: 'Tour type', es: 'Tipo de viaje', it: 'Tipo di viaggio', ar: 'نوع الرحلة' })}</small><b>{tx(locale, { en: 'Private day tour', es: 'Circuito privado de un día', it: 'Tour privato di un giorno', ar: 'رحلة يومية خاصة' })}</b></div></div>{sourceTour.summary?.trim() ? <p className="tour-summary-lead">{sourceTour.summary}</p> : null}{(detail?.overview ?? [tx(locale, { en: 'The visit route, meeting point, timings, and inclusions are confirmed with our team before booking.', es: 'La ruta, el punto de encuentro, los horarios y las inclusiones se confirman con nuestro equipo antes de reservar.', it: 'Itinerario, punto di incontro, orari e inclusioni si confermano con il nostro team prima della prenotazione.', ar: 'خط سير الزيارة ونقطة المقابلة والمواعيد والمشمول تُؤكد مع فريقنا قبل الحجز.' })]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>

          <section id="highlights" className="tour-content-section"><h2>{tx(locale, { en: 'Highlights', es: 'Lo destacado', it: 'Punti salienti', ar: 'أبرز المعالم' })}</h2><div className="highlight-card"><Image src={detail?.highlightImage ?? gallery[0].src} alt={gallery[0].alt} fill sizes="(max-width: 700px) 100vw, 260px" /><div><h3>{tx(locale, { en: `${tour.location}, at your pace`, es: `${tour.location}, a tu ritmo`, it: `${tour.location}, al tuo ritmo`, ar: `${locationName} بوتيرتك الخاصة` })}</h3><p>{tour.summary}</p></div></div>{detail?.highlights?.length ? <ul className="day-tour-highlight-list">{detail.highlights.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul> : <p>{tx(locale, { en: 'Ask our team which stops and experiences can fit the duration of this tour. We will confirm them with your proposed itinerary.', es: 'Pregunta a nuestro equipo qué paradas y experiencias encajan en la duración de este viaje. Las confirmaremos con tu itinerario propuesto.', it: 'Chiedi al nostro team quali tappe ed esperienze rientrano nella durata di questo tour. Le confermeremo con il tuo itinerario proposto.', ar: 'استفسر من فريقنا عن المحطات والتجارب الممكنة في مدة هذه الرحلة. سنؤكدها مع برنامجك المقترح.' })}</p>}</section>

          <section id="itinerary" className="tour-content-section"><h2>{tx(locale, { en: 'Visit itinerary', es: 'Itinerario de la visita', it: 'Itinerario della visita', ar: 'برنامج الزيارة' })}</h2><p className="tour-itinerary-note"><ShieldCheck size={17} />{detail?.itineraryNote ?? tx(locale, { en: 'Suggested flow only. Exact stops, sequence, and timing are confirmed with your quote.', es: 'Solo un flujo sugerido. Las paradas exactas, el orden y los horarios se confirman con tu presupuesto.', it: 'Solo un flusso suggerito. Tappe esatte, ordine e orari si confermano con il tuo preventivo.', ar: 'خط سير مقترح فقط. المحطات والترتيب والتوقيت تُؤكد مع عرض السعر.' })}</p>{detail?.stops?.length ? <div className="itinerary-list">{detail.stops.map((stop, index) => { const open = openStop === index; return <article key={`${stop.title}-${index}`} className={open ? "open" : "closed"}><span className="day-dot" /><div className="day-board"><button type="button" className="day-toggle" aria-expanded={open} onClick={() => setOpenStop(open ? -1 : index)}><span className="day-pill">{tx(locale, { en: `Stop ${index + 1}`, es: `Parada ${index + 1}`, it: `Tappa ${index + 1}`, ar: `محطة ${index + 1}` })}</span><span className="day-title">{stop.title}</span><ChevronDown size={17} /></button>{open && <div className="day-body">{stop.image&&<Image src={stop.image} alt={stop.title} width={300} height={240} className="day-thumb"/>}<div><p>{stop.description}</p>{stop.meals&&<p className="tour-day-meals"><b>{tx(locale, { en: 'Meals:', es: 'Comidas:', it: 'Pasti:', ar: 'الوجبات:' })}</b> {stop.meals}</p>}</div></div>}</div></article> })}</div> : <div className="day-tour-route-request"><p>{tx(locale, { en: 'No fixed stop-by-stop itinerary has been published for this tour yet. We will send the proposed route for your preferred date before you commit.', es: 'Aún no hay un itinerario detallado publicado para este viaje. Te enviaremos la ruta propuesta para tu fecha preferida antes de confirmar.', it: 'Non è ancora stato pubblicato un itinerario dettagliato per questo tour. Ti invieremo il percorso proposto per la tua data preferita prima della conferma.', ar: 'لا يوجد برنامج مفصل منشور لهذه الرحلة بعد. سنرسل خط السير المقترح لتاريخك المفضل قبل الحجز.' })}</p><Link href={planHref} className="text-link">{tx(locale, { en: 'Request the visit plan', es: 'Solicita el plan de visita', it: 'Richiedi il programma di visita', ar: 'اطلب برنامج الزيارة' })} <ArrowRight size={16} /></Link></div>}</section>

          <section id="inclusions" className="tour-content-section"><h2>{tx(locale, { en: "What's Included?", es: "¿Qué incluye?", it: "Cosa è incluso?", ar: 'ما الذي يشمله السعر؟' })}</h2><ul className="check-list">{included.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul><h2 className="excluded-heading">{tx(locale, { en: "What's Excluded?", es: "¿Qué no incluye?", it: "Cosa non è incluso?", ar: 'ما الذي لا يشمله السعر؟' })}</h2><ul className="excluded-list">{excluded.map((item) => <li key={item}><Minus size={16} />{item}</li>)}</ul><p className="day-tour-terms-note">{tx(locale, { en: 'Exact services and exclusions for your chosen date are itemized in the quote before booking.', es: 'Los servicios exactos y las exclusiones para tu fecha se detallan en el presupuesto antes de reservar.', it: 'Servizi esatti ed esclusioni per la tua data sono dettagliati nel preventivo prima della prenotazione.', ar: 'الخدمات والاستثناءات الدقيقة لتاريخك المختار تُذكر في عرض السعر قبل الحجز.' })}</p></section>

          <section id="add-ons" className="tour-content-section"><div className="section-title-row"><h2>{tx(locale, { en: 'Add-ons', es: 'Extras', it: 'Extra', ar: 'إضافات' })}</h2><span className="muted">{tx(locale, { en: 'Shape the day around you', es: 'Diseña el día a tu manera', it: 'Disegna la giornata a modo tuo', ar: 'صمم اليوم وفق ذوقك' })}</span></div><div className="addon-list">{addOns.map((item, index) => <label key={item.title}><input type="checkbox" checked={selectedAddOns.includes(index)} onChange={() => setSelectedAddOns((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} /><span>{item.title}</span><b>{item.price === undefined ? tx(locale, { en: 'Price on request', es: 'Precio a petición', it: 'Prezzo su richiesta', ar: 'السعر حسب الطلب' }) : formatPrice(item.price, currency, locale)}</b></label>)}</div><p className="day-tour-terms-note">{tx(locale, { en: 'Optional experiences and their prices are confirmed with availability in your quote.', es: 'Las experiencias opcionales y sus precios se confirman según disponibilidad en tu presupuesto.', it: 'Le esperienze opzionali e i loro prezzi si confermano in base alla disponibilità nel tuo preventivo.', ar: 'التجارب الاختيارية وأسعارها تُؤكد مع التوافر في عرض السعر.' })}</p></section>

          <section id="location" className="tour-content-section"><h2>{tx(locale, { en: 'Location', es: 'Ubicación', it: 'Posizione', ar: 'الموقع' })}</h2><TourLocationMap locations={locations} locale={locale} /></section>

          {pricePeriods.length>0&&<section id="prices" className="tour-price-breakdown"><h2><span className="price-breakdown-icon">✦</span>{tx(locale, { en: 'Tour Prices', es: 'Precios del viaje', it: 'Prezzi del tour', ar: 'أسعار الرحلة' })}</h2><div className="price-cards-grid">{pricePeriods.map((row,index)=><div key={`${row.category}-${index}`} className="price-season-card"><div className="price-season-header"><CalendarDays size={16}/><div><b>{row.category}</b>{(row.startDate||row.endDate)&&<small>{formatTourDateRange(row.startDate,row.endDate,locale)}</small>}</div></div><div className="price-season-body">{row.tiers?.length ? row.tiers.map((tier)=><div key={tier.label} className="price-tier"><span>{tier.label}</span><strong>{row.prefix}{formatPrice(tier.price,currency,locale)} {tier.suffix&&<small>{tier.suffix}</small>}</strong></div>) : <div className="price-tier"><span>{row.note || tx(locale, { en: 'Per person', es: 'Por persona', it: 'Per persona', ar: 'للفرد' })}</span><strong>{row.prefix}{formatPrice(row.price,currency,locale)}</strong></div>}</div></div>)}</div></section>}

          <section id="reviews" className="tour-content-section tour-reviews-section"><h2>{tx(locale, { en: 'Reviews', es: 'Reseñas', it: 'Recensioni', ar: 'التقييمات' })}</h2><TourReviewsSection tourSlug={tour.slug} tourTitle={tour.title} locale={locale} copy={reviewCopy[locale]} /></section>

          <TourVideoGallery videos={tour.journeyVideos} posters={gallery.map((item) => item.src)} locale={locale} tourTitle={tour.title} />

          {related.length > 0 && <section className="tour-content-section"><div className="section-title-row"><h2>{tx(locale, { en: 'Related Tours', es: 'Viajes relacionados', it: 'Viaggi correlati', ar: 'رحلات ذات صلة' })}</h2><Link href={regionHref} className="text-link">{tx(locale, { en: 'View all', es: 'Ver todo', it: 'Vedi tutto', ar: 'شاهد الكل' })} <ArrowRight size={16} /></Link></div><HorizontalSlider className="related-tours" ariaLabel={tx(locale, { en: 'Related Tours', es: 'Viajes relacionados', it: 'Viaggi correlati', ar: 'رحلات ذات صلة' })} previousLabel={tx(locale, { en: 'Previous tours', es: 'Viajes anteriores', it: 'Viaggi precedenti', ar: 'الرحلات السابقة' })} nextLabel={tx(locale, { en: 'Next tours', es: 'Viajes siguientes', it: 'Viaggi successivi', ar: 'الرحلات التالية' })} autoAdvanceMs={5000}>{related.map((item) => <Link key={item.slug} href={`/egypt-tours/${item.slug}`}><Image src={galleries[item.location]?.[0]?.src ?? item.image} alt={`${item.location} travel scene`} width={260} height={150} /><b>{item.title}</b><span>{tx(locale, { en: 'From', es: 'Desde', it: 'Da', ar: 'يبدأ من' })} {formatPrice(item.price, currency, locale)}</span></Link>)}</HorizontalSlider></section>}
        </div>

        <aside className="tour-booking-card" aria-label={tx(locale, { en: 'Plan this day tour', es: 'Planifica este circuito de un día', it: 'Pianifica questo tour di un giorno', ar: 'خطط لرحلة اليوم' })}><div className="booking-top"><div><small>{tx(locale, { en: 'From', es: 'Desde', it: 'Da', ar: 'يبدأ من' })}</small><strong>{formatPrice(tour.price, currency, locale)}</strong><span>{tx(locale, { en: 'per person', es: 'por persona', it: 'per persona', ar: 'للشخص' })}</span></div></div><div className="booking-divider" /><label>{tx(locale, { en: 'Preferred date', es: 'Fecha preferida', it: 'Data preferita', ar: 'التاريخ المفضل' })}<DateInput hideNativeIndicator value={travelDate} onChange={(event) => setTravelDate(event.target.value)} /></label><div className="guest-rows">{([['adults', adults, setAdults, tx(locale, { en: 'Adults', es: 'Adultos', it: 'Adulti', ar: 'بالغون' }), tx(locale, { en: 'Ages 12+', es: '12 años o más', it: '12 anni o più', ar: '12 سنة فأكثر' }), 1], ['children', children, setChildren, tx(locale, { en: 'Children', es: 'Niños', it: 'Bambini', ar: 'أطفال' }), tx(locale, { en: 'Ages 3-11', es: '3-11 años', it: '3-11 anni', ar: '3 - 11 سنة' }), 0], ['infants', infants, setInfants, tx(locale, { en: 'Infants', es: 'Bebés', it: 'Neonati', ar: 'رضّع' }), tx(locale, { en: 'Under 3', es: 'Menores de 3', it: 'Sotto i 3 anni', ar: 'أقل من 3 سنوات' }), 0]] as const).map(([key, value, set, label, ages, min]) => <div key={key} className="guest-row"><span><Users size={15}/><b>{label}</b><small>{ages}</small></span><div><button type="button" aria-label={label} disabled={value <= min} onClick={() => set(Math.max(min, value - 1))}><Minus size={14}/></button><b aria-live="polite">{value}</b><button type="button" aria-label={label} disabled={value >= 50} onClick={() => set(Math.min(50, value + 1))}><Plus size={14}/></button></div></div>)}</div><div className="booking-total"><span>{tx(locale, { en: 'Estimated total', es: 'Total estimado', it: 'Totale stimato', ar: 'الإجمالي التقديري' })}{hasUnpricedAddOns ? tx(locale, { en: ' + add-ons on request', es: ' + extras a petición', it: ' + extra su richiesta', ar: ' + إضافات حسب الطلب' }) : ''}</span><strong>{formatPrice(pricing.total + selectedAddOnTotal, currency, locale)}</strong></div><button type="button" className="primary-btn booking-cta" onClick={() => { addToCart({ tourSlug: tour.slug, title: tour.title, image: gallery[0].src, date: travelDate, adults, children, infants, addons: selectedAddOns.map((i) => addOns[i]?.title ?? ''), addonTotal: selectedAddOnTotal, adultUnit: pricing.adult, childUnit: pricing.child, infantUnit: pricing.infant, total: pricing.total + selectedAddOnTotal }); router.push('/cart') }}>{tx(locale, { en: 'Book now', es: 'Reserva ahora', it: 'Prenota ora', ar: 'احجز الآن' })} <ArrowRight size={17} /></button><div className="booking-side-row"><button type="button" className="outline-btn booking-half" onClick={shareTour}><Share2 size={16} /> {tx(locale, { en: 'Share', es: 'Compartir', it: 'Condividi', ar: 'مشاركة' })}</button><button type="button" className="outline-btn booking-half" onClick={() => favorites.toggle(tour.slug)} aria-pressed={favorite}><Heart size={16} fill={favorite ? "#f7951d" : "none"} /> {favorite ? tx(locale, { en: 'Saved', es: 'Guardado', it: 'Salvato', ar: 'محفوظ' }) : tx(locale, { en: 'Favorites', es: 'Favoritos', it: 'Preferiti', ar: 'المفضلة' })}</button></div><AskQuestionButton tourSlug={tour.slug} tourTitle={tour.title} label={tx(locale, { en: 'Ask a question', es: 'Haz una pregunta', it: 'Fai una domanda', ar: 'اسألنا' })} /><small className="booking-note"><ShieldCheck size={14} /> {tx(locale, { en: 'Final price, route, and terms are confirmed before booking.', es: 'El precio final, la ruta y las condiciones se confirman antes de reservar.', it: 'Prezzo finale, itinerario e condizioni si confermano prima della prenotazione.', ar: 'السعر النهائي وخط السير والشروط تُؤكد قبل الحجز.' })}</small></aside>
      </div>
    </main>
  </>
}
