"use client"

import "leaflet/dist/leaflet.css"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Heart, MapPin, Minus, Plus, Share2, ShieldCheck, Users } from "lucide-react"
import { getBookingTotal, getDealOriginalPrice, getDealPrice, getRelatedTours, getTravelerUnitPrices, normalizeTourPricePeriods } from "@/data/tours"
import { addToCart } from "@/lib/cart"
import { useCustomerFavorites } from "@/lib/customer-account"
import { cruiseArabicCopy } from "@/data/cruise-ar"
import { shoreArabicCopy } from "@/data/shore-ar"
import type { Tour, TourLocation } from "@/data/types"
import { formatTourDateRange, localizeTourDuration, localizeTourLocation } from "@/lib/tour-format"
import { tx, useLocale, formatPrice } from "./locale"
import { TourReviewsSection } from "./reviews"
import { TourVideoGallery } from "./tour-video-gallery"
import { AskQuestionButton } from "./ask-question"
import { HorizontalSlider } from "./horizontal-slider"
import { DateInput } from "./date-input"
import { isLocaleRTL, pickLocaleText, type Locale } from '@/lib/locale-config'

const arabicUi: Record<string, string> = {
  Home: 'الرئيسية', 'Egypt Tours': 'جولات مصر', 'Egypt travel experience': 'تجربة سياحية في مصر',
  'Nile cruise journey': 'رحلة نيلية', 'Multi-day Egypt journey': 'رحلة مصرية متعددة الأيام',
  'Shore excursion': 'رحلة من الميناء', 'Shore excursion journey': 'رحلة ساحلية من الميناء',
  'Departure port': 'ميناء الانطلاق', 'Ship schedule': 'جدول السفينة',
  'Meeting and return are confirmed with your ship schedule.': 'تُحدد المقابلة والعودة وفق جدول سفينتك.',
  'Services to confirm': 'الخدمات قيد التأكيد', 'The exact included and excluded services are itemized in your written quote before booking.': 'تُذكر الخدمات المشمولة وغير المشمولة بالتفصيل في عرض السعر المكتوب قبل الحجز.',
  'Optional changes can be requested with your ship details; availability and prices are confirmed in your quote.': 'يمكن طلب تعديلات اختيارية بعد مشاركة بيانات السفينة؛ التوافر والأسعار تُؤكد في عرض السعر.',
  'Enquire about this excursion': 'استفسر عن الرحلة',
  'Indicative price': 'سعر استرشادي', 'Final quote on request': 'السعر النهائي حسب الطلب',
  'Ship call date': 'تاريخ توقف السفينة',
  'Price, inclusions, meeting point, and return time are confirmed against your ship call before booking.': 'يُؤكد السعر والمشمول ونقطة المقابلة وموعد العودة وفق توقف سفينتك قبل الحجز.',
  Duration: 'المدة', Destinations: 'الوجهات', 'Group size': 'حجم المجموعة', 'Travel style': 'نمط الرحلة',
  'On request': 'حسب الطلب', Cruise: 'رحلة نيلية', 'Tour type': 'نوع الرحلة',
  Overview: 'نظرة عامة', Highlights: 'أبرز المعالم', Itinerary: 'برنامج الرحلة', Inclusions: 'المشمول',
  'Add-ons': 'إضافات', Location: 'الموقع', Reviews: 'التقييمات', 'Guest reviews': 'تقييمات الضيوف',
  'View Destinations': 'استكشف الوجهات', 'Collapse all': 'إغلاق الكل', 'Expand all': 'عرض الكل',
  'Download itinerary': 'تنزيل البرنامج', "What's Included?": 'ما الذي يشمله السعر؟',
  "What's Excluded?": 'ما الذي لا يشمله السعر؟', 'Package inclusions': 'تفاصيل الباقة',
  'Price on request': 'السعر حسب الطلب', 'Make your journey your own': 'خصص رحلتك',
  Prices: 'الأسعار', 'Cruise Prices': 'أسعار الرحلة النيلية', 'Tour Prices': 'أسعار الرحلة',
  'Gallery of Exciting Journeys': 'فيديوهات من رحلاتنا', 'Related Tours': 'رحلات ذات صلة',
  'View all': 'شاهد الكل', From: 'يبدأ من', 'per person': 'للشخص', 'Preferred date': 'التاريخ المفضل',
  Travelers: 'المسافرون', Total: 'الإجمالي التقديري', 'Estimated total': 'الإجمالي التقديري',
  'Plan this trip': 'خطط لهذه الرحلة', 'Plan this cruise': 'استفسر عن الرحلة',
  Share: 'مشاركة', Saved: 'محفوظ', Favorites: 'المفضلة', 'Ask a question': 'اسألنا',
  'Final price and package terms are confirmed before booking.': 'السعر النهائي وشروط الرحلة يحددهما فريقنا قبل الحجز.',
  'Final cruise price, dates, and terms are confirmed before booking.': 'السعر النهائي والمواعيد والشروط تؤكد قبل الحجز.',
  'Prices shown are indicative. Confirm the sailing year, availability, and final quote with our team.': 'الأسعار المعروضة استرشادية. تأكد من سنة الإبحار والتوافر والسعر النهائي مع فريقنا.',
  Solo: 'مسافر واحد', '2-2 PAX': 'مسافران', '3-100 PAX': '٣ مسافرين فأكثر',
  'Solo cabin': 'كابينة فردية', 'Double cabin': 'كابينة مزدوجة', 'Group (3-6)': 'مجموعة (٣-٦)', 'Full boat (7-10)': 'حجز المركب (٧-١٠)',
  'Standard cabin': 'كابينة عادية', 'Superior cabin': 'كابينة مميزة', 'Single cabin': 'كابينة فردية', 'Single supplement': 'إضافة الفردي',
  'Write a review': 'اكتب تقييمك', 'Reviewing': 'تقييم رحلة', 'Your name': 'اسمك', 'e.g. Alex M.': 'مثال: أحمد م.',
  'Platform': 'المنصة', 'Rating': 'التقييم',   'Your review': 'تقييمك', 'Tell us about your trip...': 'حدثنا عن رحلتك...',
  'Cancel': 'إلغاء', 'Submit review': 'إرسال التقييم', 'reviews': 'تقييمات', 'Traveler reviews': 'آراء المسافرين',
  'Be the first to review this trip': 'كن أول من يقيّم هذه الرحلة', 'Just now': 'الآن', 'Read more': 'اقرأ المزيد', 'Show less': 'عرض أقل',
  'Per person': 'للشخص', 'Additional charge': 'رسوم إضافية',
  Adults: 'بالغون', Children: 'أطفال', Infants: 'رضّع', 'Ages 12+': '12 سنة فأكثر', 'Ages 3-11': '3 - 11 سنة', 'Under 3': 'أقل من 3 سنوات', 'Book now': 'احجز الآن',
}
const spanishUi: Record<string, string> = {
  Home: 'Inicio', 'Egypt Tours': 'Circuitos por Egipto', 'Egypt travel experience': 'Experiencia de viaje por Egipto',
  'Nile cruise journey': 'Crucero por el Nilo', 'Multi-day Egypt journey': 'Viaje de varios días por Egipto',
  'Shore excursion': 'Excursión en tierra', 'Shore excursion journey': 'Excursión en tierra desde el puerto',
  'Departure port': 'Puerto de salida', 'Ship schedule': 'Horario del barco',
  'Meeting and return are confirmed with your ship schedule.': 'El encuentro y el regreso se confirman según el horario de tu barco.',
  'Services to confirm': 'Servicios por confirmar', 'The exact included and excluded services are itemized in your written quote before booking.': 'Los servicios incluidos y excluidos exactos se detallan en tu presupuesto escrito antes de reservar.',
  'Optional changes can be requested with your ship details; availability and prices are confirmed in your quote.': 'Puedes solicitar cambios opcionales con los datos de tu barco; la disponibilidad y los precios se confirman en tu presupuesto.',
  'Enquire about this excursion': 'Pregunta por esta excursión',
  'Indicative price': 'Precio orientativo', 'Final quote on request': 'Presupuesto final a petición',
  'Ship call date': 'Fecha de escala del barco',
  'Price, inclusions, meeting point, and return time are confirmed against your ship call before booking.': 'El precio, las inclusiones, el punto de encuentro y la hora de regreso se confirman según la escala de tu barco antes de reservar.',
  Duration: 'Duración', Destinations: 'Destinos', 'Group size': 'Tamaño del grupo', 'Travel style': 'Estilo de viaje',
  'On request': 'A petición', Cruise: 'Crucero', 'Tour type': 'Tipo de viaje',
  Overview: 'Resumen', Highlights: 'Lo destacado', Itinerary: 'Itinerario', Inclusions: 'Inclusiones',
  'Add-ons': 'Extras', Location: 'Ubicación', Reviews: 'Reseñas', 'Guest reviews': 'Reseñas de viajeros',
  'View Destinations': 'Ver destinos', 'Collapse all': 'Contraer todo', 'Expand all': 'Expandir todo',
  'Download itinerary': 'Descargar itinerario', "What's Included?": '¿Qué incluye?',
  "What's Excluded?": '¿Qué no incluye?', 'Package inclusions': 'Inclusiones del paquete',
  'Price on request': 'Precio a petición', 'Make your journey your own': 'Haz tuyo el viaje',
  Prices: 'Precios', 'Cruise Prices': 'Precios del crucero', 'Tour Prices': 'Precios del viaje',
  'Gallery of Exciting Journeys': 'Galería de viajes fascinantes', 'Related Tours': 'Viajes relacionados',
  'View all': 'Ver todo', From: 'Desde', 'per person': 'por persona', 'Preferred date': 'Fecha preferida',
  Travelers: 'Viajeros', Total: 'Total', 'Estimated total': 'Total estimado',
  'Plan this trip': 'Planifica este viaje', 'Plan this cruise': 'Planifica este crucero',
  Share: 'Compartir', Saved: 'Guardado', Favorites: 'Favoritos', 'Ask a question': 'Haz una pregunta',
  'Final price and package terms are confirmed before booking.': 'El precio final y las condiciones del paquete se confirman antes de reservar.',
  'Final cruise price, dates, and terms are confirmed before booking.': 'El precio final, las fechas y las condiciones del crucero se confirman antes de reservar.',
  'Prices shown are indicative. Confirm the sailing year, availability, and final quote with our team.': 'Los precios mostrados son orientativos. Confirma el año de navegación, la disponibilidad y el presupuesto final con nuestro equipo.',
  Solo: 'Individual', '2-2 PAX': '2 viajeros', '3-100 PAX': '3+ viajeros',
  'Solo cabin': 'Cabina individual', 'Double cabin': 'Cabina doble', 'Group (3-6)': 'Grupo (3-6)', 'Full boat (7-10)': 'Barco completo (7-10)',
  'Standard cabin': 'Cabina estándar', 'Superior cabin': 'Cabina superior', 'Single cabin': 'Cabina individual', 'Single supplement': 'Suplemento individual',
  'Write a review': 'Escribe una reseña', 'Reviewing': 'Reseña del viaje', 'Your name': 'Tu nombre', 'e.g. Alex M.': 'p. ej., Alex M.',
  'Platform': 'Plataforma', 'Rating': 'Valoración', 'Your review': 'Tu reseña', 'Tell us about your trip...': 'Cuéntanos sobre tu viaje...',
  'Cancel': 'Cancelar', 'Submit review': 'Enviar reseña', 'reviews': 'reseñas', 'Traveler reviews': 'Reseñas de viajeros',
  'Be the first to review this trip': 'Sé el primero en reseñar este viaje', 'Just now': 'Ahora mismo', 'Read more': 'Leer más', 'Show less': 'Mostrar menos',
  'Per person': 'Por persona', 'Additional charge': 'Cargo adicional',
  Adults: 'Adultos', Children: 'Niños', Infants: 'Bebés', 'Ages 12+': '12 años o más', 'Ages 3-11': '3-11 años', 'Under 3': 'Menores de 3', 'Book now': 'Reserva ahora',
}

const italianUi: Record<string, string> = {
  Home: 'Home', 'Egypt Tours': 'Tour in Egitto', 'Egypt travel experience': 'Esperienza di viaggio in Egitto',
  'Nile cruise journey': 'Crociera sul Nilo', 'Multi-day Egypt journey': 'Viaggio di più giorni in Egitto',
  'Shore excursion': 'Escursione a terra', 'Shore excursion journey': 'Escursione a terra dal porto',
  'Departure port': 'Porto di partenza', 'Ship schedule': 'Orario della nave',
  'Meeting and return are confirmed with your ship schedule.': 'Incontro e rientro si confermano in base all’orario della tua nave.',
  'Services to confirm': 'Servizi da confermare', 'The exact included and excluded services are itemized in your written quote before booking.': 'I servizi inclusi ed esclusi esatti sono dettagliati nel tuo preventivo scritto prima della prenotazione.',
  'Optional changes can be requested with your ship details; availability and prices are confirmed in your quote.': 'Puoi richiedere modifiche opzionali con i dati della tua nave; disponibilità e prezzi si confermano nel tuo preventivo.',
  'Enquire about this excursion': 'Richiedi informazioni su questa escursione',
  'Indicative price': 'Prezzo indicativo', 'Final quote on request': 'Preventivo finale su richiesta',
  'Ship call date': 'Data di scalo della nave',
  'Price, inclusions, meeting point, and return time are confirmed against your ship call before booking.': 'Prezzo, inclusioni, punto di incontro e orario di rientro si confermano in base allo scalo della tua nave prima della prenotazione.',
  Duration: 'Durata', Destinations: 'Destinazioni', 'Group size': 'Dimensioni del gruppo', 'Travel style': 'Stile di viaggio',
  'On request': 'Su richiesta', Cruise: 'Crociera', 'Tour type': 'Tipo di viaggio',
  Overview: 'Panoramica', Highlights: 'Punti salienti', Itinerary: 'Itinerario', Inclusions: 'Inclusioni',
  'Add-ons': 'Extra', Location: 'Posizione', Reviews: 'Recensioni', 'Guest reviews': 'Recensioni dei viaggiatori',
  'View Destinations': 'Vedi le destinazioni', 'Collapse all': 'Comprimi tutto', 'Expand all': 'Espandi tutto',
  'Download itinerary': 'Scarica l’itinerario', "What's Included?": 'Cosa è incluso?',
  "What's Excluded?": 'Cosa non è incluso?', 'Package inclusions': 'Inclusioni del pacchetto',
  'Price on request': 'Prezzo su richiesta', 'Make your journey your own': 'Rendi tuo il viaggio',
  Prices: 'Prezzi', 'Cruise Prices': 'Prezzi della crociera', 'Tour Prices': 'Prezzi del tour',
  'Gallery of Exciting Journeys': 'Galleria di viaggi emozionanti', 'Related Tours': 'Viaggi correlati',
  'View all': 'Vedi tutto', From: 'Da', 'per person': 'per persona', 'Preferred date': 'Data preferita',
  Travelers: 'Viaggiatori', Total: 'Totale', 'Estimated total': 'Totale stimato',
  'Plan this trip': 'Pianifica questo viaggio', 'Plan this cruise': 'Pianifica questa crociera',
  Share: 'Condividi', Saved: 'Salvato', Favorites: 'Preferiti', 'Ask a question': 'Fai una domanda',
  'Final price and package terms are confirmed before booking.': 'Prezzo finale e condizioni del pacchetto si confermano prima della prenotazione.',
  'Final cruise price, dates, and terms are confirmed before booking.': 'Prezzo finale, date e condizioni della crociera si confermano prima della prenotazione.',
  'Prices shown are indicative. Confirm the sailing year, availability, and final quote with our team.': 'I prezzi indicati sono orientativi. Conferma l’anno di navigazione, la disponibilità e il preventivo finale con il nostro team.',
  Solo: 'Individuale', '2-2 PAX': '2 viaggiatori', '3-100 PAX': '3+ viaggiatori',
  'Solo cabin': 'Cabina singola', 'Double cabin': 'Cabina doppia', 'Group (3-6)': 'Gruppo (3-6)', 'Full boat (7-10)': 'Intera barca (7-10)',
  'Standard cabin': 'Cabina standard', 'Superior cabin': 'Cabina superior', 'Single cabin': 'Cabina singola', 'Single supplement': 'Supplemento singola',
  'Write a review': 'Scrivi una recensione', 'Reviewing': 'Recensione del viaggio', 'Your name': 'Il tuo nome', 'e.g. Alex M.': 'es. Alex M.',
  'Platform': 'Piattaforma', 'Rating': 'Valutazione', 'Your review': 'La tua recensione', 'Tell us about your trip...': 'Raccontaci il tuo viaggio...',
  'Cancel': 'Annulla', 'Submit review': 'Invia recensione', 'reviews': 'recensioni', 'Traveler reviews': 'Recensioni dei viaggiatori',
  'Be the first to review this trip': 'Sii il primo a recensire questo viaggio', 'Just now': 'Proprio ora', 'Read more': 'Leggi di più', 'Show less': 'Mostra meno',
  'Per person': 'Per persona', 'Additional charge': 'Supplemento aggiuntivo',
  Adults: 'Adulti', Children: 'Bambini', Infants: 'Neonati', 'Ages 12+': '12 anni o più', 'Ages 3-11': '3-11 anni', 'Under 3': 'Sotto i 3 anni', 'Book now': 'Prenota ora',
}


function Accordion({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) { return <details className="tour-accordion" open={open}><summary>{title}<ChevronDown size={17}/></summary><div>{children}</div></details> }

const nileStopCoordinates: Record<string, readonly [number, number]> = {
  Cairo: [30.0444, 31.2357], Giza: [30.0131, 31.2089], Luxor: [25.6872, 32.6396],
  Aswan: [24.0889, 32.8998], Edfu: [24.9792, 32.8728],
  'Kom Ombo': [24.4685, 32.9463], Dendera: [26.1419, 32.6702],
  'Port Said': [31.2653, 32.3019], Alexandria: [31.2001, 29.9187],
  Safaga: [26.7292, 33.9365], 'Ain Sokhna': [29.6000, 32.3167],
  Hurghada: [27.2579, 33.8116],
}

function TourMapCanvas({ coordinates, title, locale }: { coordinates: readonly [number, number]; title: string; locale: Locale }) {
  const container = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: any
    import('leaflet').then((leaflet) => {
      if (cancelled || !container.current) return
      map = leaflet.map(container.current, { scrollWheelZoom: false }).setView([coordinates[0], coordinates[1]], 12)
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
      }).on('load', () => { if (!cancelled) setReady(true) }).on('tileerror', () => { if (!cancelled) setFailed(true) }).addTo(map)
      leaflet.circleMarker([coordinates[0], coordinates[1]], {
        radius: 9, color: '#fff', weight: 3, fillColor: '#f7951d', fillOpacity: 1,
      }).addTo(map)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; map?.remove() }
  }, [coordinates[0], coordinates[1]])

  return <div className="location-map-wrap">
    <div ref={container} className="location-map" dir="ltr" role="region" aria-label={title}/>
    {!ready && <span className="location-map-status" role="status">{failed ? tx(locale, { en: 'Map unavailable. Open the location using the link below.', es: 'Mapa no disponible. Abre la ubicación con el enlace de abajo.', it: 'Mappa non disponibile. Apri la posizione tramite il link qui sotto.', ar: 'تعذر تحميل الخريطة. افتح الموقع من الرابط أدناه.' }) : tx(locale, { en: 'Loading map...', es: 'Cargando el mapa...', it: 'Caricamento della mappa...', ar: 'جارٍ تحميل الخريطة...' })}</span>}
  </div>
}

export function TourLocationMap({ locations, locale, nileCruise = false }: { locations?: readonly TourLocation[]; locale: Locale; nileCruise?: boolean }) {
  const [selectedId, setSelectedId] = useState('')
  if (!locations?.length) return null

  const stops = locations.map((location, index) => {
    if (typeof location === 'string') return {
      id: `legacy-${index}-${location}`, name: location, nameAr: localizeTourLocation(location),
      coordinates: nileStopCoordinates[location],
    }
    const validCoordinates = Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
      && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
    return {
      id: location.id, name: location.name, nameAr: location.nameAr === undefined ? localizeTourLocation(location.name) : location.nameAr,
      coordinates: validCoordinates ? [location.latitude, location.longitude] as const : undefined,
    }
  })
  const activeStop = stops.find((stop) => stop.id === selectedId) ?? stops[0]
  const activeIndex = stops.indexOf(activeStop)
  const displayName = locale === 'ar' ? activeStop.nameAr : activeStop.name
  const query = encodeURIComponent(`${activeStop.name}, Egypt`)
  const coordinates = activeStop.coordinates
  const mapUrl = `https://maps.google.com/maps?q=${query}&t=&z=12&ie=UTF8&iwloc=&output=embed`
  const externalUrl = coordinates
    ? `https://www.openstreetmap.org/?mlat=${coordinates[0]}&mlon=${coordinates[1]}#map=12/${coordinates[0]}/${coordinates[1]}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`

  return <>
    {stops.length > 1 && <div className="location-stops" role="tablist" aria-label={tx(locale, { en: 'Tour stop maps', es: 'Mapas de las paradas', it: 'Mappe delle tappe', ar: 'خرائط محطات الرحلة' })}>
      {stops.map((stop, index) => <button key={stop.id} id={`location-tab-${index}`} type="button" role="tab" tabIndex={stop.id === activeStop.id ? 0 : -1} aria-selected={stop.id === activeStop.id} aria-controls="tour-location-map" className={stop.id === activeStop.id ? 'active' : ''} onClick={() => setSelectedId(stop.id)} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const direction = event.key === 'ArrowRight' ? 1 : -1
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? stops.length - 1 : (activeIndex + (isLocaleRTL(locale) ? -direction : direction) + stops.length) % stops.length
        setSelectedId(stops[next].id)
        document.getElementById(`location-tab-${next}`)?.focus()
      }}><MapPin size={15}/>{locale === 'ar' ? stop.nameAr : stop.name}</button>)}
    </div>}
    <div id="tour-location-map" role={stops.length > 1 ? 'tabpanel' : undefined} aria-labelledby={stops.length > 1 ? `location-tab-${activeIndex}` : undefined}>
      {coordinates ? <TourMapCanvas key={activeStop.id} coordinates={coordinates} title={tx(locale, { en: `${displayName} map`, es: `Mapa de ${displayName}`, it: `Mappa di ${displayName}`, ar: `خريطة ${displayName}` })} locale={locale}/> : <iframe key={activeStop.id} title={tx(locale, { en: `${displayName} map`, es: `Mapa de ${displayName}`, it: `Mappa di ${displayName}`, ar: `خريطة ${displayName}` })} src={mapUrl} loading="lazy" className="location-map"/>}
      <a className="location-map-link" href={externalUrl} target="_blank" rel="noopener noreferrer">{coordinates ? tx(locale, { en: 'Open location in OpenStreetMap', es: 'Abrir la ubicación en OpenStreetMap', it: 'Apri la posizione in OpenStreetMap', ar: 'افتح الموقع في OpenStreetMap' }) : tx(locale, { en: 'Open location in Google Maps', es: 'Abrir la ubicación en Google Maps', it: 'Apri la posizione in Google Maps', ar: 'افتح الموقع في خرائط Google' })} <ArrowRight size={15}/></a>
    </div>
  </>
}

export function TourDetailPage({ tour, related }: { tour: Tour; related?: Tour[] }) {
  const { currency, locale } = useLocale()
  const isShore = tour.category === 'shore-excursions'
  const rawDetail = tour.detail
  const localizedCruise = locale === 'ar' && tour.category === 'nile-cruises' ? cruiseArabicCopy[tour.slug] : undefined
  const localizedShore = locale === 'ar' && isShore ? shoreArabicCopy[tour.slug] : undefined
  const detail = rawDetail ? {
    ...rawDetail, ...localizedCruise, ...localizedShore,
    addOns: localizedCruise ? rawDetail.addOns?.map((item, index) => ({ ...item, title: localizedCruise.addOns?.[index] ?? item.title })) : rawDetail.addOns,
  } : undefined
  const gallery = tour.gallery ?? [tour.image]
  // Short summary is its own CMS field: always render the saved DB value as
  // the Overview lead so builder edits are visible even when long-form
  // detail paragraphs exist.
  const summaryLead = tour.summary?.trim() ? tour.summary : ''
  const relatedTours = related ?? getRelatedTours(tour)
  const hasInclusions = Boolean(detail?.included?.length || detail?.excluded?.length || detail?.itineraryNote)
  const pricePeriods = normalizeTourPricePeriods(detail?.priceRows, tx(locale, { en: 'Available travel dates', es: 'Fechas de viaje disponibles', it: 'Date di viaggio disponibili', ar: 'مواعيد السفر المتاحة' }))
  const detailTabs = detail ? [...(detail.highlights?.length ? ["Highlights"] : []), ...(detail.itinerary?.length ? ["Itinerary"] : []), ...(hasInclusions ? ["Inclusions"] : []), ...(isShore || detail.addOns?.length ? ["Add-ons"] : []), ...(detail.locations?.length ? ["Location"] : []), ...(pricePeriods.length ? ["Prices"] : [])] : []
  const tabs = ["Overview", ...detailTabs, "Reviews"]
  const [selectedImage, setSelectedImage] = useState(0)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const favorites = useCustomerFavorites()
  const favorite = favorites.has(tour.slug)
  const [activeTab, setActiveTab] = useState("Overview")
  const [travelDate, setTravelDate] = useState("")
  const router = useRouter()
  const ui = (key: string) => tx(locale, { en: key, es: spanishUi[key] ?? key, it: italianUi[key] ?? key, ar: arabicUi[key] ?? key })
  const title = pickLocaleText(locale, { en: tour.title, ar: tour.titleAr })
  const galleryAlt = (index: number) => { const caption = tour.galleryCaptions?.[index]; return caption ? pickLocaleText(locale, { en: caption.en, ar: caption.ar }) : `${title} - image ${index + 1}` }
  const duration = locale === 'ar' ? localizeTourDuration(tour.duration) : tour.duration
  const location = locale === 'ar' ? localizeTourLocation(tour.location) : tour.location
  const priceLabel = (label: string) => { const text = ui(label); if (locale === 'ar') return text.replace('Jan', 'يناير').replace('Apr', 'أبريل').replace('Dec', 'ديسمبر'); if (locale === 'es') return text.replace('2-2 PAX', '2 huéspedes').replace('3-100 PAX', '3+ huéspedes'); if (locale === 'it') return text.replace('2-2 PAX', '2 ospiti').replace('3-100 PAX', '3+ ospiti'); return text.replace('2-2 PAX', '2 guests').replace('3-100 PAX', '3+ guests') }
  const [selectedAddons, setSelectedAddons] = useState<number[]>([])
  const toggleAddon = (index: number) => setSelectedAddons((prev) => (prev.includes(index) ? prev.filter((x) => x !== index) : [...prev, index]))
  const [expandAll, setExpandAll] = useState<boolean | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(detail?.itinerary?.[0]?.day ?? null)
  const shareTour = async () => { const url = window.location.href; try { if (navigator.share) { await navigator.share({ title: tour.title, url }) } else { await navigator.clipboard.writeText(url) } } catch { /* dismissed */ } }
  const price = getDealPrice(tour)
  const heads = Math.max(1, adults + children + infants)
  // Deal-aware widget: traveler units come from the same engine the cart
  // and the server use, so the estimate matches the charged total.
  const dealOriginal = getDealOriginalPrice(tour)
  const bookingPrices = getBookingTotal(tour, adults, children, infants)
  const unitPrices = getTravelerUnitPrices(tour, heads)
  const unitPrice = bookingPrices.adult
  const childUnit = bookingPrices.child
  const infantUnit = bookingPrices.infant
  const originalUnitPrice = unitPrices.adult
  const addonsTotal = selectedAddons.reduce((sum, index) => sum + (detail?.addOns?.[index]?.price ?? 0), 0)
  const hasUnpricedAddons = selectedAddons.some((index) => detail?.addOns?.[index]?.price === undefined)
  const total = adults * unitPrice + children * childUnit + infants * infantUnit + addonsTotal
  const downloadItinerary = () => {
    if (!detail) return
    const text = [title, `${ui('Duration')}: ${duration}`, `${ui('From')}: ${formatPrice(price, currency, locale)} ${ui('per person')}`, detail.itineraryNote ?? "", ui('Itinerary'), ...detail.itinerary.map((item) => `${item.day}: ${item.title}\n${item.description}`), ...(detail.included?.length ? [ui("What's Included?"), ...detail.included] : []), ...(detail.excluded?.length ? [ui("What's Excluded?"), ...detail.excluded] : []), ...(detail.addOns?.length ? [ui('Add-ons'), ...detail.addOns.map((addon) => addon.price === undefined ? `${addon.title} (${ui('Price on request')})` : `${addon.title} - ${formatPrice(addon.price, currency, locale)}`)] : []), "", "https://starpyramids.com/make-your-trip"].join("\n\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `itinerary-${tour.slug}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return <>
    <div className="tour-breadcrumb container"><Link href="/">{ui('Home')}</Link><span>›</span><Link href={`/egypt-tours/${tour.category}`}>{ui('Egypt Tours')}</Link><span>›</span><span>{title}</span></div>
    <main className="tour-detail-page container">
      <header className="tour-detail-header"><div><span className="eyebrow">{ui(isShore ? 'Shore excursion journey' : tour.category === 'nile-cruises' ? 'Nile cruise journey' : tour.category === 'multi-days-tours' ? 'Multi-day Egypt journey' : 'Egypt travel experience')}</span><h1>{title}</h1></div><button className={`tour-favorite ${favorite ? "active" : ""}`} onClick={()=>favorites.toggle(tour.slug)} aria-label={ui('Favorites')}><Heart size={20} fill={favorite ? "currentColor" : "none"}/></button></header>
      <div className="tour-detail-layout">
        <section className="tour-detail-main">
          <div className="tour-gallery"><div className="tour-gallery-main"><Image src={gallery[selectedImage]} alt={galleryAlt(selectedImage)} fill priority sizes="(max-width: 900px) 100vw, 65vw"/>{gallery.length>1&&<><button aria-label={tx(locale, { en: 'Previous image', es: 'Imagen anterior', it: 'Immagine precedente', ar: 'الصورة السابقة' })} className="gallery-arrow left" onClick={()=>setSelectedImage((selectedImage + gallery.length - 1) % gallery.length)}>‹</button><button aria-label={tx(locale, { en: 'Next image', es: 'Imagen siguiente', it: 'Immagine successiva', ar: 'الصورة التالية' })} className="gallery-arrow right" onClick={()=>setSelectedImage((selectedImage + 1) % gallery.length)}>›</button></>}</div>{gallery.length>1&&<div className="tour-thumbs">{gallery.map((image,index)=><button key={image} className={selectedImage===index ? "active" : ""} onClick={()=>setSelectedImage(index)} aria-label={tx(locale, { en: `Show image ${index + 1}: ${galleryAlt(index)}`, es: `Mostrar imagen ${index + 1}: ${galleryAlt(index)}`, it: `Mostra l'immagine ${index + 1}: ${galleryAlt(index)}`, ar: `عرض الصورة ${index + 1}` })} aria-pressed={selectedImage === index}><Image src={image} alt="" fill sizes="90px"/></button>)}</div>}{Boolean(tour.photoCredits?.length)&&<p className="tour-photo-credits">{tour.photoCredits?.map((credit,index)=><span key={credit.url}>{index>0 && ', '}<a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.label}</a></span>)}</p>}</div>
          <div className="tour-facts"><span><Clock3 size={18}/><b>{ui('Duration')}</b> {duration}</span><span><MapPin size={18}/><b>{ui('Destinations')}</b> {location}</span><span><Users size={18}/><b>{ui('Group size')}</b> {ui(tour.groupSize??'On request')}</span><span><ShieldCheck size={18}/><b>{ui('Travel style')}</b> {ui(tour.travelStyle??'Tailored')}</span></div>
          {isShore && tour.departurePort && <div className="shore-port-note"><MapPin size={18}/><span><b>{ui('Departure port')}:</b> {locale === 'ar' ? localizeTourLocation(tour.departurePort) : tour.departurePort}</span><span className="shore-port-separator" aria-hidden="true"/><span><b>{ui('Ship schedule')}:</b> {ui('Meeting and return are confirmed with your ship schedule.')}</span></div>}
          {tabs.length>1&&<nav className="tour-tabs" aria-label={tx(locale, { en: 'Tour sections', es: 'Secciones del viaje', it: 'Sezioni del viaggio', ar: 'أقسام الرحلة' })}>{tabs.map(tab=><button key={tab} className={activeTab===tab ? "active" : ""} onClick={()=>{setActiveTab(tab); document.getElementById(tab.toLowerCase())?.scrollIntoView({behavior:"smooth"})}}>{ui(tab)}</button>)}</nav>}
          <section id="overview" className="tour-content-section"><h2>{ui('Overview')}</h2><div className="overview-grid"><div><small>{ui('Duration')}</small><b>{duration}</b></div><div><small>{ui('Tour type')}</small><b>{ui(tour.travelStyle??'Tailored experience')}</b></div></div>{summaryLead&&<p className="tour-summary-lead">{summaryLead}</p>}{detail?detail.overview?.map(paragraph=><p key={paragraph}>{paragraph}</p>):<p><strong>The full day-by-day itinerary and exact inclusions are available on request.</strong></p>}</section>
          {detail&&<>
          {detail.highlights?.length>0&&<section id="highlights" className="tour-content-section"><div className="section-title-row"><h2>{ui('Highlights')}</h2><span className="section-actions"><Link href="/destinations" className="text-link">{ui('View Destinations')}</Link><button type="button" className="link-btn" onClick={() => setExpandAll((v) => (v === true ? false : true))}>{expandAll === true ? ui('Collapse all') : ui('Expand all')}</button></span></div><div className="highlight-card"><Image src={detail.highlightImage ?? gallery[0]} alt={title} fill sizes="(max-width: 700px) 100vw, 260px"/><div><h3>{detail.highlights?.[0]?.title}</h3><p>{detail.highlights?.[0]?.items.join(', ')}</p></div></div><div key={'hl' + String(expandAll)}>{detail.highlights?.map((group,gi) => <Accordion key={group.title} title={group.title} open={expandAll === null ? gi === 0 : expandAll}><ul>{group.items.map(item => <li key={item}><Check size={15}/>{item}</li>)}</ul></Accordion>)}</div></section>}
          {detail.itinerary?.length>0&&<section id="itinerary" className="tour-content-section"><div className="section-title-row"><h2>{ui('Itinerary')}</h2><button type="button" className="outline-btn" onClick={downloadItinerary}>{ui('Download itinerary')}</button></div>{detail.itineraryNote&&<p className="tour-itinerary-note"><ShieldCheck size={17}/>{detail.itineraryNote}</p>}<div className="itinerary-list">{detail.itinerary?.map((item,index)=>{const open=openDay===item.day || (locale === 'ar' && openDay === rawDetail?.itinerary[index]?.day); return <article key={`${item.day}-${index}`} className={open?'open':'closed'}><span className="day-dot"/><div className="day-board"><button type="button" className="day-toggle" onClick={()=>setOpenDay(open?null:item.day)} aria-expanded={open}><span className="day-pill">{item.day}</span><span className="day-title">{item.title}</span><ChevronDown size={17}/></button><div className="day-body"><Image src={item.image ?? detail.itineraryImages?.[index] ?? gallery[index%gallery.length]} alt={item.title} width={300} height={240} className="day-thumb"/><div><p>{item.description}</p>{item.meals&&<p className="tour-day-meals"><b>{tx(locale, { en: 'Meals:', es: 'Comidas:', it: 'Pasti:', ar: 'الوجبات:' })}</b> {item.meals}</p>}</div></div></div></article>;})}</div></section>}
          {hasInclusions&&<section id="inclusions" className="tour-content-section">{Boolean(detail.included?.length)&&<><h2>{ui("What's Included?")}</h2><ul className="check-list">{detail.included?.map(item=><li key={item}><Check size={16}/>{item}</li>)}</ul></>}{Boolean(detail.excluded?.length)&&<><h2 className="excluded-heading">{ui("What's Excluded?")}</h2><ul className="excluded-list">{detail.excluded?.map(item=><li key={item}><Minus size={16}/>{item}</li>)}</ul></>}{!detail.included?.length&&!detail.excluded?.length&&(isShore ? <><h2>{ui('Services to confirm')}</h2><p>{ui('The exact included and excluded services are itemized in your written quote before booking.')}</p></> : <><h2>{ui('Package inclusions')}</h2><p>Hotels, meals, transport, guiding, entrance fees, and cancellation terms are confirmed for your chosen dates before booking. Ask our team for the complete inclusion and exclusion list for this journey.</p></>)}</section>}
          {(isShore || Boolean(detail.addOns?.length))&&<section id="add-ons" className="tour-content-section"><div className="section-title-row"><h2>{ui('Add-ons')}</h2><span className="muted">{ui('Make your journey your own')}</span></div>{Boolean(detail.addOns?.length)&&<div className="addon-list">{detail.addOns?.map((item,index)=><label key={item.title}><input type="checkbox" checked={selectedAddons.includes(index)} onChange={()=>toggleAddon(index)}/> <span>{item.title}</span><b>{item.price === undefined ? ui('Price on request') : formatPrice(item.price, currency, locale)}</b></label>)}</div>}{isShore&&!detail.addOns?.length&&<p>{ui('Optional changes can be requested with your ship details; availability and prices are confirmed in your quote.')}</p>}{detail.addOns?.some(item => item.price === undefined) && <p className="tour-addons-note">Options without a listed price are quoted separately before booking.</p>}</section>}
          <section id="location" className="tour-content-section"><h2>{ui('Location')}</h2><TourLocationMap locations={detail.locations} locale={locale} nileCruise={tour.category === 'nile-cruises'}/></section>
          {/* traveler reviews render below for every tour */}
          {pricePeriods.length>0&&<section id="prices" className="tour-price-breakdown"><h2><span className="price-breakdown-icon">✦</span> {ui(tour.category === 'nile-cruises' ? 'Cruise Prices' : 'Tour Prices')}</h2><div className="price-cards-grid">{pricePeriods.map((row,index)=><div key={`${row.category}-${index}`} className="price-season-card"><div className="price-season-header"><CalendarDays size={16}/><div><b>{tour.category === 'nile-cruises' ? priceLabel(row.category) : row.category}</b>{(row.startDate||row.endDate)&&<small>{formatTourDateRange(row.startDate,row.endDate,locale)}</small>}</div></div><div className="price-season-body">{row.tiers?.length ? row.tiers.map(tier=><div key={tier.label} className="price-tier"><span>{tour.category === 'nile-cruises' ? priceLabel(tier.label) : tier.label}</span><strong>{row.prefix}{formatPrice(tier.price,currency,locale)} {tier.suffix&&<small>{tier.suffix}</small>}</strong></div>) : <div className="price-tier"><span>{row.note || ui('per person')}</span><strong>{row.prefix}{formatPrice(row.price,currency,locale)}</strong></div>}</div></div>)}</div>{tour.category === 'nile-cruises' && <p className="cruise-price-note">{ui('Prices shown are indicative. Confirm the sailing year, availability, and final quote with our team.')}</p>}</section>}
          </>}
          <section id="reviews" className="tour-content-section tour-reviews-section"><h2>{ui('Reviews')}</h2><TourReviewsSection tourSlug={tour.slug} tourTitle={title} locale={locale} copy={{ heading: ui('Write a review'), forTour: ui('Reviewing'), title: ui('Reviews'), summaryReviews: ui('reviews'), beFirst: ui('Be the first to review this trip'), justNow: ui('Just now'), more: ui('Read more'), less: ui('Show less'), reviewTitle: ui('Review title'), reviewTitlePh: ui('e.g. Amazing trip!'), platform: ui('Platform'), rating: ui('Rating'), review: ui('Your review'), reviewPh: ui('Tell us about your trip...'), cancel: ui('Cancel'), submit: ui('Submit review') }} /></section><TourVideoGallery videos={tour.journeyVideos} posters={gallery} locale={locale} tourTitle={title}/>
          {relatedTours.length>0&&<section className="tour-content-section"><div className="section-title-row"><h2>{ui('Related Tours')}</h2><Link href={`/egypt-tours/${tour.category}`} className="text-link">{ui('View all')} <ArrowRight size={16}/></Link></div><HorizontalSlider className="related-tours" ariaLabel={ui('Related Tours')} previousLabel={tx(locale, { en: 'Previous tours', es: 'Viajes anteriores', it: 'Viaggi precedenti', ar: 'الرحلات السابقة' })} nextLabel={tx(locale, { en: 'Next tours', es: 'Viajes siguientes', it: 'Viaggi successivi', ar: 'الرحلات التالية' })} autoAdvanceMs={5000}>{relatedTours.map(item=><Link key={item.slug} href={`/egypt-tours/${item.slug}`}><Image src={item.image} alt={pickLocaleText(locale, { en: item.title, ar: item.titleAr })} width={260} height={150}/><b>{pickLocaleText(locale, { en: item.title, ar: item.titleAr })}</b><small>{ui(item.departurePort ? 'Departure port' : 'Destinations')}: {pickLocaleText(locale, { en: item.departurePort ?? item.location, ar: localizeTourLocation(item.departurePort ?? item.location) })}</small><span>{ui(isShore ? 'Indicative price' : 'From')} {formatPrice(getDealPrice(item), currency, locale)}</span></Link>)}</HorizontalSlider></section>}
        </section>
        <aside className="tour-booking-card">
          <div className="booking-top"><div><small>{ui(isShore ? 'Indicative price' : 'From')}</small><strong>{dealOriginal !== undefined && dealOriginal > unitPrice && <><del>{formatPrice(originalUnitPrice, currency, locale)}</del>{' '}</>}{formatPrice(unitPrice, currency, locale)}</strong><span>{ui('per person')} · {heads} {tx(locale, { en: heads === 1 ? 'traveler' : 'travelers', es: heads === 1 ? 'viajero' : 'viajeros', it: heads === 1 ? 'viaggiatore' : 'viaggiatori', ar: 'مسافر' })}</span></div></div>
          <div className="booking-divider"/>
          <label>{ui(isShore ? 'Ship call date' : 'Preferred date')}<DateInput hideNativeIndicator value={travelDate} onChange={(e)=>setTravelDate(e.target.value)}/></label>
          <div className="guest-rows">{([['adults', adults, setAdults, ui('Adults'), ui('Ages 12+'), 1], ['children', children, setChildren, ui('Children'), ui('Ages 3-11'), 0], ['infants', infants, setInfants, ui('Infants'), ui('Under 3'), 0]] as const).map(([key, value, set, label, ages, min]) => <div key={key} className="guest-row"><span><Users size={15}/><b>{label}</b><small>{ages}</small></span><div><button type="button" aria-label={label} onClick={() => set(Math.max(min, value - 1))}><Minus size={14}/></button><b>{value}</b><button type="button" aria-label={label} onClick={() => set(Math.min(50, value + 1))}><Plus size={14}/></button></div></div>)}</div>
          <div className="booking-total"><span>{ui(isShore ? 'Final quote on request' : 'Estimated total')}{!isShore && (hasUnpricedAddons ? tx(locale, { en: ' + add-ons on request', es: ' + extras a petición', it: ' + extra su richiesta', ar: ' + إضافات حسب الطلب' }) : selectedAddons.length ? tx(locale, { en: ` (incl. ${selectedAddons.length} add-on${selectedAddons.length===1?'':'s'})`, es: ` (incl. ${selectedAddons.length} extra${selectedAddons.length===1?'':'s'})`, it: ` (incl. ${selectedAddons.length} extra)`, ar: ` (يشمل ${selectedAddons.length} إضافات)` }) : '')}</span>{!isShore&&<strong>{formatPrice(total, currency, locale)}</strong>}</div>
          {isShore ? <Link href={`/make-your-trip?tour=${encodeURIComponent(tour.slug)}&adults=${adults}&children=${children}&infants=${infants}&guests=${heads}${travelDate?`&date=${encodeURIComponent(travelDate)}`:''}${selectedAddons.length?`&addons=${selectedAddons.join(',')}`:''}`} className="primary-btn booking-cta">{ui('Enquire about this excursion')} <ArrowRight size={17}/></Link> : <button type="button" className="primary-btn booking-cta" onClick={() => { addToCart({ tourSlug: tour.slug, title, image: gallery[0], date: travelDate, adults, children, infants, addons: selectedAddons.map((i) => detail?.addOns?.[i]?.title ?? ''), addonTotal: addonsTotal, adultUnit: unitPrice, childUnit, infantUnit, total }); router.push('/cart') }}>{ui('Book now')} <ArrowRight size={17}/></button>}
          <div className="booking-side-row"><button type="button" className="outline-btn booking-half" onClick={shareTour} aria-label={ui('Share')}><Share2 size={16}/> {ui('Share')}</button><button type="button" className="outline-btn booking-half" onClick={() => favorites.toggle(tour.slug)} aria-pressed={favorite} aria-label={ui('Favorites')}><Heart size={16} fill={favorite ? "#f7951d" : "none"} color={favorite ? "#f7951d" : "currentColor"}/> {favorite ? ui('Saved') : ui('Favorites')}</button></div>
          <AskQuestionButton tourSlug={tour.slug} tourTitle={title} label={ui('Ask a question')} />
          <small className="booking-note"><ShieldCheck size={14}/> {ui(isShore ? 'Price, inclusions, meeting point, and return time are confirmed against your ship call before booking.' : tour.category === 'nile-cruises' ? 'Prices shown are indicative. Confirm the sailing year, availability, and final quote with our team.' : tour.category === 'multi-days-tours' ? 'Final price and package terms are confirmed before booking.' : 'Free cancellation up to 24 hours before departure')}</small>
        </aside>
      </div>
    </main>
  </>
}
