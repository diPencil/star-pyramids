'use client'
import { ProviderReviewsSection } from './provider-reviews'

import Image from 'next/image'
import Link from 'next/link'
import { OfferCards } from './offer-campaigns'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Heart, Star, CalendarCheck, Sparkles, Users, Landmark, Leaf, MapPin, Award, BadgeCheck, MousePointerClick, CalendarDays, ThumbsUp, Play } from 'lucide-react'
import { useHomepageGallery } from '@/lib/journey-gallery-client'
import { galleryPlatformLabel, resolveGalleryVideoSource, type GalleryItem } from '@/lib/journey-gallery'
import { SiteShell, TripSearchEngine, TourCard } from '@/components/site'
import { useDbBlogs } from '@/lib/offers-blogs-client'
import { useDbDestinations } from '@/lib/catalogue-client'
import { useDbTours } from '@/lib/tours-client'
import { useLocale } from './locale'
import { blogs as allBlogs, destinations as allDestinations } from '@/data/content'
import { catalogTours, getDealPrice, popularTours, seasonalTours } from '@/data/tours'
import { InternationalPhoneInput } from './international-phone-input'
import { SharedSelect } from '@/components/shared-select'
import { DateInput } from '@/components/date-input'

const seasonal = seasonalTours
const popular = popularTours
const faqs = ['What is included in an Egypt tour package?','Do you offer private tours and custom itineraries?','When is the best time to visit Egypt?','Can I book airport transfers and hotels?','What payment options are available?','Is Egypt safe for travelers?']
const trustedLogos = [
  { name: 'Tripadvisor', src: '/trusted/tripadvisor.png' },
  { name: 'Booking.com', src: '/trusted/booking.png' },
  { name: 'Viator', src: '/trusted/Viator.png' },
  { name: 'Google Reviews', src: '/trusted/Google-Review.png' },
  { name: 'GetYourGuide', src: '/trusted/Get-your-guide.png' },
  { name: 'Trustindex', src: '/trusted/TrustIndex.webp' },
] as const

function SectionHeading({eyebrow,title,subtitle}:{eyebrow?:string;title:string;subtitle?:string}){return <div className="home-heading">{eyebrow&&<span>{eyebrow}</span>}<h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>}

// Reviews data, platform icons, and the write-a-review modal live in ./reviews (shared with tour pages).
function ViewAll({href='/trips'}:{href?:string}){const {locale:vl}=useLocale(); return <Link className="small-orange-btn" href={href}>{homeStrings[vl].viewAll} <ArrowRight size={15}/></Link>}

const baseHomeStrings = {
  en: { heroSpan: 'Get started your', heroTitle: 'Exciting Journey With Us', stats: ['Happy customer', 'Years of experience', 'Total Destinations', 'Rating in Tripadvisor'], xmasT: "Explore Egypt's Top Tours", xmasS: 'From the Pyramids to the Nile. Find your perfect adventure.', popT: 'Popular Destination', popS: 'Every corner of Egypt has a story waiting for you.', all: 'Recommended', oneDay: 'One Day', multiDays: 'Multi Days', nileCruises: 'Nile Cruises', shoreExcursion: 'Shore Excursion', noTours: 'No tours in', noToursEnd: 'yet.', tryOther: 'Try another category or browse every journey.', showAll: 'Show all', viewAll: 'View All', seeMore: 'See more', tripT: 'Make Your Trip', tripS: 'Tell us what you want to see and we will shape the perfect Egypt journey for you.', msDest: 'Destination', msDestPh: 'Choose a place in Egypt', msFrom: 'From', msTo: 'To', msTrav: 'Travelers', msTravPh: 'How many people?', person: 'person', people: 'people', ninePlus: '9+ people', startPlan: 'Start Planning', offE: '✦ Limited time', offT: 'Special offers for you', offS: 'More Egypt, better value, unforgettable memories.', specialPkg: 'Special package', howT: 'How it works?', howS: 'Only three simple steps away from Egypt.', howP: ['Step 01', 'Step 02', 'Step 03'], howTi: ['Finding Trip', 'Booking', 'Enjoy'], howD: ['Select your favorite trip.', 'Trip booking and payment.', 'Start your Exciting Journey.'], hlT: 'Highlights of Egypt', hlS: 'A visual taste of the places and experiences waiting for you.', blogT: 'Our Travel Blogs', blogS: 'Practical inspiration for your next Egyptian adventure.', readMore: 'Read more', susE: 'Travel with purpose', susT1: 'Tailored guidance for your', susT2: 'sustainability journey', susP: 'Explore Egypt in a way that supports local communities, protects ancient places, and leaves a positive footprint.', susA: ['Local', 'communities'], susB: ['Ancient', 'places'], susC: ['Positive', 'footprint'], susCta: 'Discover more', susB1: 'TRAVEL', susB2: 'RESPONSIBLY', susB3: 'People, Places, Planet', galT: 'Gallery of Exciting Journeys', galS: 'Follow the moments our travelers share from Egypt.', revT: 'Loved by travelers', allRev: 'All reviews', revS: 'Real experiences from guests who discovered Egypt with us.', excellent: 'Excellent', writeRev: 'Write a review', reviewTitle: 'Review title', reviewTitlePh: 'e.g. Amazing trip!', revPlat: 'Platform', revRate: 'Rating', revText: 'Your review', revTextPh: 'Tell us about your trip...', cancel: 'Cancel', submit: 'Submit review', faqT: 'Frequently Asked Questions', faqS: 'Everything you need to know before your trip.', faqAll: 'View all FAQs', faqA: 'Our travel specialists can help with this and tailor the answer to your itinerary, dates, and preferences.', helpT: 'Need help to Finding your Trip?', helpS: 'Share a few details and our team will contact you.', helpN: 'Full Name', helpE: 'Email Address', helpP: 'Phone number', contactNow: 'Contact Now', thanks1: 'Thank you', thanks2: '! Our team will contact you shortly.', trust: 'Trusted by travelers worldwide', cdD: 'Days', cdH: 'Hours', cdM: 'Mins', cdS: 'Secs',
  faqQ: [
    'What is included in an Egypt tour package?',
    'Do you offer private tours and custom itineraries?',
    'When is the best time to visit Egypt?',
    'Can I book airport transfers and hotels?',
    'What payment options are available?',
    'Is Egypt safe for travelers?'
  ]
},
  ar: { heroSpan: 'ابدأ', heroTitle: 'رحلتك الممتعة معنا', stats: ['عميل سعيد', 'سنة خبرة', 'وجهة', 'تقييم تريب أدفايزر'], xmasT: 'استكشف أفضل رحلاتنا في مصر', xmasS: 'من الأهرامات إلى النيل. اختر مغامرتك المثالية.', popT: 'وجهات مميزة', popS: 'كل ركن في مصر له حكاية مستنياك.', all: 'موصى بها', oneDay: 'يوم واحد', multiDays: 'عدة أيام', nileCruises: 'رحلات النيل', shoreExcursion: 'رحلات الشاطئ', noTours: 'لا توجد رحلات في', noToursEnd: 'بعد.', tryOther: 'جرّب فئة أخرى أو تصفح كل الرحلات.', showAll: 'عرض الكل', viewAll: 'شاهد الكل', seeMore: 'شاهد المزيد', tripT: 'خطط رحلتك', tripS: 'قولنا عايز تشوف إيه وهنصمملك رحلة مصر المثالية.', msDest: 'الوجهة', msDestPh: 'اختر مكاناً في مصر', msFrom: 'من', msTo: 'إلى', msTrav: 'المسافرون', msTravPh: 'كم عدد الأفراد؟', person: 'فرد', people: 'أفراد', ninePlus: '9+ أفراد', startPlan: 'ابدأ التخطيط', offE: '✦ لفترة محدودة', offT: 'عروض خاصة لك', offS: 'مصر أكتر، قيمة أحسن، ذكريات لا تُنسى.', specialPkg: 'باقة مميزة', howT: 'إزاي تحجز؟', howS: '3 خطوات بس وتبقى في مصر.', howP: ['الخطوة 01', 'الخطوة 02', 'الخطوة 03'], howTi: ['اختار الرحلة', 'الحجز', 'استمتع'], howD: ['اختار وجهتك المفضلة واكتشف التجربة المناسبة لك.', 'قولنا مواعيدك واحنا هنهتم بكل التفاصيل.', 'سافر بثقة واصنع ذكريات تدوم.'], hlT: 'أبرز معالم مصر', hlS: 'لمحة عن الأماكن والتجارب المستنياك.', blogT: 'مدونة رحلاتنا', blogS: 'إلهام عملي لمغامرتك المصرية الجاية.', readMore: 'اقرأ المزيد', susE: 'سافر بهدف', susT1: 'إرشادات مخصصة', susT2: 'لرحلة مستدامة', susP: 'اكتشف مصر بطريقة تدعم المجتمعات المحلية وتحمي الأماكن الأثرية وتترك أثراً إيجابياً.', susA: ['محلية', 'مجتمعات'], susB: ['أثرية', 'أماكن'], susC: ['إيجابية', 'بصمة'], susCta: 'اكتشف المزيد', susB1: 'سافر', susB2: 'بمسؤولية', susB3: 'الناس, الأماكن, الكوكب', galT: 'معرض الرحلات الممتعة', galS: 'تابع اللحظات اللي بيشاركها مسافرونا من مصر.', revT: 'محبوب من المسافرين', allRev: 'كل التقييمات', revS: 'تجارب حقيقية من ضيوف اكتشفوا مصر معنا.', excellent: 'ممتاز', writeRev: 'اكتب تقييماً', reviewTitle: 'عنوان التقييم', reviewTitlePh: 'مثال: رحلة رائعة!', revPlat: 'المنصة', revRate: 'التقييم', revText: 'تقييمك', revTextPh: 'حدثنا عن رحلتك...', cancel: 'إلغاء', submit: 'إرسال التقييم', faqT: 'الأسئلة الشائعة', faqS: 'كل اللي محتاج تعرفه قبل رحلتك.', faqAll: 'شاهد كل الأسئلة', faqA: 'متخصصو السفر عندنا يقدروا يساعدوك ويخصصوا الإجابة حسب برنامجك ومواعيدك وتفضيلاتك.', helpT: 'محتاج مساعدة في رحلتك؟', helpS: 'سيب بياناتك وفريقنا هيتواصل معاك.', helpN: 'الاسم بالكامل', helpE: 'البريد الإلكتروني', helpP: 'رقم الهاتف', contactNow: 'تواصل الآن', thanks1: 'شكراً', thanks2: '! فريقنا هيتواصل معاك قريباً.', trust: 'موثوقون من مسافرين حول العالم', cdD: 'أيام', cdH: 'ساعات', cdM: 'دقائق', cdS: 'ثواني' },
  faqQ: [
    'ماذا يشمل برنامج رحلة مصر؟',
    'هل تقدمون جولات خاصة ومسارات مخصصة؟',
    'متى أفضل وقت لزيارة مصر؟',
    'هل يمكنني حجز نقل من المطار وفنادق؟',
    'ما هي خيارات الدفع المتاحة؟',
    'هل مصر آمنة للمسافرين?'
  ]} as const

const homeStrings = { ...baseHomeStrings,
  es: { ...baseHomeStrings.en,
    heroSpan: 'Empieza tu', heroTitle: 'Viaje fascinante con nosotros', stats: ['Cliente feliz', 'Años de experiencia', 'Destinos totales', 'Valoración en Tripadvisor'], xmasT: 'Descubre los mejores circuitos de Egipto', xmasS: 'De las pirámides al Nilo. Encuentra tu aventura perfecta.', popT: 'Destino popular', popS: 'Cada rincón de Egipto tiene una historia esperándote.', all: 'Recomendados', oneDay: 'Un día', multiDays: 'Varios días', nileCruises: 'Cruceros por el Nilo', shoreExcursion: 'Excursión en tierra', noTours: 'No hay viajes en', noToursEnd: 'todavía.', tryOther: 'Prueba otra categoría o explora todos los viajes.', showAll: 'Mostrar todo', viewAll: 'Ver todo', seeMore: 'Ver más', tripT: 'Crea tu viaje', tripS: 'Cuéntanos qué quieres ver y diseñaremos el viaje perfecto por Egipto para ti.', msDest: 'Destino', msDestPh: 'Elige un lugar de Egipto', msFrom: 'Desde', msTo: 'Hasta', msTrav: 'Viajeros', msTravPh: '¿Cuántas personas?', person: 'persona', people: 'personas', ninePlus: '9+ personas', startPlan: 'Empieza a planificar', offE: '✦ Tiempo limitado', offT: 'Ofertas especiales para ti', offS: 'Más Egipto, mejor valor, recuerdos inolvidables.', specialPkg: 'Paquete especial', howT: '¿Cómo funciona?', howS: 'Solo tres simples pasos te separan de Egipto.', howP: ['Paso 01', 'Paso 02', 'Paso 03'], howTi: ['Elige el viaje', 'Reserva', 'Disfruta'], howD: ['Elige tu viaje favorito.', 'Reserva y pago del viaje.', 'Empieza tu fascinante viaje.'], hlT: 'Lo mejor de Egipto', hlS: 'Una muestra visual de los lugares y experiencias que te esperan.', blogT: 'Nuestro blog de viajes', blogS: 'Inspiración práctica para tu próxima aventura egipcia.', readMore: 'Leer más', susE: 'Viaja con propósito', susT1: 'Orientación a medida para tu', susT2: 'viaje sostenible', susP: 'Explora Egipto apoyando a las comunidades locales, protegiendo los lugares antiguos y dejando una huella positiva.', susA: ['Locales', 'comunidades'], susB: ['Antiguos', 'lugares'], susC: ['Positiva', 'huella'], susCta: 'Descubre más', susB1: 'VIAJA', susB2: 'RESPONSABLE', susB3: 'Personas, lugares, planeta', galT: 'Galería de viajes fascinantes', galS: 'Sigue los momentos que nuestros viajeros comparten desde Egipto.', revT: 'Amado por los viajeros', allRev: 'Todas las reseñas', revS: 'Experiencias reales de huéspedes que descubrieron Egipto con nosotros.', excellent: 'Excelente', writeRev: 'Escribe una reseña', reviewTitle: 'Título de la reseña', reviewTitlePh: 'p. ej. ¡Viaje increíble!', revPlat: 'Plataforma', revRate: 'Valoración', revText: 'Tu reseña', revTextPh: 'Cuéntanos sobre tu viaje...', cancel: 'Cancelar', submit: 'Enviar reseña', faqT: 'Preguntas frecuentes', faqS: 'Todo lo que necesitas saber antes de tu viaje.', faqAll: 'Ver todas las preguntas', faqA: 'Nuestros especialistas en viajes pueden ayudarte y adaptar la respuesta a tu itinerario, fechas y preferencias.', helpT: '¿Necesitas ayuda para encontrar tu viaje?', helpS: 'Comparte algunos datos y nuestro equipo te contactará.', helpN: 'Nombre completo', helpE: 'Correo electrónico', helpP: 'Número de teléfono', contactNow: 'Contactar ahora', thanks1: 'Gracias', thanks2: '! Nuestro equipo te contactará pronto.', trust: 'La elección de viajeros de todo el mundo', cdD: 'Días', cdH: 'Horas', cdM: 'Min', cdS: 'Seg',
    faqQ: [
      '¿Qué incluye un paquete de tour por Egipto?',
      '¿Ofrecen tours privados e itinerarios a medida?',
      '¿Cuál es la mejor época para visitar Egipto?',
      '¿Puedo reservar traslados de aeropuerto y hoteles?',
      '¿Qué opciones de pago están disponibles?',
      '¿Es seguro Egipto para los viajeros?'
    ]
  },
  it: { ...baseHomeStrings.en,
    heroSpan: 'Inizia la tua', heroTitle: 'Viaggio emozionante con noi', stats: ['Cliente felice', 'Anni di esperienza', 'Destinazioni totali', 'Valutazione su Tripadvisor'], xmasT: 'Scopri i migliori tour in Egitto', xmasS: 'Dalle piramidi al Nilo. Trova la tua avventura perfetta.', popT: 'Destinazione popolare', popS: 'Ogni angolo dell\'Egitto ha una storia che ti aspetta.', all: 'Consigliati', oneDay: 'Un giorno', multiDays: 'Più giorni', nileCruises: 'Crociere sul Nilo', shoreExcursion: 'Escursione a terra', noTours: 'Nessun viaggio in', noToursEnd: 'al momento.', tryOther: 'Prova un\'altra categoria o sfoglia tutti i viaggi.', showAll: 'Mostra tutto', viewAll: 'Vedi tutto', seeMore: 'Vedi di più', tripT: 'Crea il tuo viaggio', tripS: 'Dicci cosa vuoi vedere e disegneremo il viaggio perfetto in Egitto per te.', msDest: 'Destinazione', msDestPh: 'Scegli un luogo in Egitto', msFrom: 'Da', msTo: 'A', msTrav: 'Viaggiatori', msTravPh: 'Quante persone?', person: 'persona', people: 'persone', ninePlus: '9+ persone', startPlan: 'Inizia a pianificare', offE: '✦ Tempo limitato', offT: 'Offerte speciali per te', offS: 'Più Egitto, miglior valore, ricordi indimenticabili.', specialPkg: 'Pacchetto speciale', howT: 'Come funziona?', howS: 'Solo tre semplici passi ti separano dall\'Egitto.', howP: ['Fase 01', 'Fase 02', 'Fase 03'], howTi: ['Scegli il viaggio', 'Prenota', 'Goditelo'], howD: ['Scegli il tuo viaggio preferito.', 'Prenotazione e pagamento del viaggio.', 'Inizia il tuo emozionante viaggio.'], hlT: 'Il meglio dell\'Egitto', hlS: 'Un assaggio visivo dei luoghi e delle esperienze che ti aspettano.', blogT: 'Il nostro blog di viaggi', blogS: 'Ispirazione pratica per la tua prossima avventura egiziana.', readMore: 'Leggi di più', susE: 'Viaggia con uno scopo', susT1: 'Guida su misura per il tuo', susT2: 'viaggio sostenibile', susP: 'Esplora l\'Egitto sostenendo le comunità locali, proteggendo i luoghi antichi e lasciando un\'impronta positiva.', susA: ['Locali', 'comunità'], susB: ['Antichi', 'luoghi'], susC: ['Positiva', 'impronta'], susCta: 'Scopri di più', susB1: 'VIAGGIA', susB2: 'RESPONSABILE', susB3: 'Persone, luoghi, pianeta', galT: 'Galleria di viaggi emozionanti', galS: 'Segui i momenti che i nostri viaggiatori condividono dall\'Egitto.', revT: 'Amato dai viaggiatori', allRev: 'Tutte le recensioni', revS: 'Esperienze reali di ospiti che hanno scoperto l\'Egitto con noi.', excellent: 'Eccellente', writeRev: 'Scrivi una recensione', reviewTitle: 'Titolo della recensione', reviewTitlePh: 'es. Viaggio fantastico!', revPlat: 'Piattaforma', revRate: 'Valutazione', revText: 'La tua recensione', revTextPh: 'Raccontaci il tuo viaggio...', cancel: 'Annulla', submit: 'Invia recensione', faqT: 'Domande frequenti', faqS: 'Tutto ciò che devi sapere prima del tuo viaggio.', faqAll: 'Vedi tutte le domande', faqA: 'I nostri specialisti di viaggio possono aiutarti e adattare la risposta al tuo itinerario, alle date e alle preferenze.', helpT: 'Hai bisogno di aiuto per trovare il tuo viaggio?', helpS: 'Condividi alcuni dettagli e il nostro team ti contatterà.', helpN: 'Nome completo', helpE: 'Indirizzo email', helpP: 'Numero di telefono', contactNow: 'Contattaci ora', thanks1: 'Grazie', thanks2: '! Il nostro team ti contatterà a breve.', trust: 'Scelto da viaggiatori di tutto il mondo', cdD: 'Giorni', cdH: 'Ore', cdM: 'Min', cdS: 'Sec',
    faqQ: [
      'Cosa include un pacchetto tour in Egitto?',
      'Offrite tour privati e itinerari su misura?',
      'Qual è il periodo migliore per visitare l\'Egitto?',
      'Posso prenotare trasferimenti aeroportuali e hotel?',
      'Quali opzioni di pagamento sono disponibili?',
      'L\'Egitto è sicuro per i viaggiatori?'
    ]
  }
} as const

const helpFormStrings = {
  en: {
    sending: 'Sending...',
    nameError: 'Enter your name.',
    emailError: 'Enter a valid email address.',
    phoneError: 'Enter a valid phone number.',
    failure: 'We could not send your request. Please try again.',
  },
  es: {
    sending: 'Enviando...',
    nameError: 'Introduce tu nombre.',
    emailError: 'Introduce un correo electrónico válido.',
    phoneError: 'Introduce un número de teléfono válido.',
    failure: 'No pudimos enviar tu solicitud. Inténtalo de nuevo.',
  },
  it: {
    sending: 'Invio in corso...',
    nameError: 'Inserisci il tuo nome.',
    emailError: 'Inserisci un indirizzo email valido.',
    phoneError: 'Inserisci un numero di telefono valido.',
    failure: 'Non siamo riusciti a inviare la richiesta. Riprova.',
  },
  ar: {
    sending: 'جارٍ الإرسال...',
    nameError: 'اكتب اسمك.',
    emailError: 'اكتب بريداً إلكترونياً صحيحاً.',
    phoneError: 'اكتب رقم هاتف صحيحاً.',
    failure: 'تعذر إرسال طلبك. حاول مرة أخرى.',
  },
} as const

export function ReviewsSection(){return <ProviderReviewsSection/>}

const statItems=[{prefix:'+',target:100,suffix:'K',decimals:0,Icon:Users},{prefix:'+',target:50,suffix:'',decimals:0,Icon:Award},{prefix:'+',target:60,suffix:'',decimals:0,Icon:MapPin},{prefix:'',target:5,suffix:'',decimals:1,Icon:Star}];

function useCountUp(target:number,decimals:number,started:boolean,duration=1600){const [val,setVal]=useState(0);useEffect(()=>{if(!started)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setVal(target);return;}let raf=0;const t0=performance.now();const tick=(t:number)=>{const p=Math.min(1,(t-t0)/duration);const e=1-Math.pow(1-p,3);setVal(parseFloat((target*e).toFixed(decimals)));if(p<1)raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf);},[started,target,decimals,duration]);return val;}

function StatItem({prefix,target,suffix,decimals,label,Icon,started}:{prefix:string;target:number;suffix:string;decimals:number;label:string;Icon:typeof Users;started:boolean}){const v=useCountUp(target,decimals,started);return <div><span className="stat-ic" aria-hidden="true"><Icon size={22}/></span><b>{prefix}{v.toFixed(decimals)}{suffix}</b><span>{label}</span></div>;}

function StatsStrip(){const {locale:sl}=useLocale(); const hx=homeStrings[sl]; const ref=useRef<HTMLElement|null>(null);const [started,setStarted]=useState(false);useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setStarted(true);io.disconnect();}},{threshold:.4});io.observe(el);return ()=>io.disconnect();},[]);return <section ref={ref} className="home-stats container">{statItems.map((s,i)=><StatItem key={i} {...s} label={hx.stats[i]} started={started}/>)}</section>;}

function createEnquiryRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function HomepageHelpForm() {
  const { locale } = useLocale()
  const copy = homeStrings[locale]
  const formCopy = helpFormStrings[locale]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const pendingRequest = useRef<{ payload: string; id: string } | null>(null)

  const clearStatus = () => {
    if (status !== 'idle') setStatus('idle')
    if (error) setError('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()
    const phoneDigits = trimmedPhone.replace(/\D/g, '')
    if (!trimmedName || trimmedName.length > 120) {
      setStatus('error'); setError(formCopy.nameError); document.getElementById('home-help-name')?.focus(); return
    }
    if (!/^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/.test(trimmedEmail)) {
      setStatus('error'); setError(formCopy.emailError); document.getElementById('home-help-email')?.focus(); return
    }
    if (!/^\+?[0-9 ()-]{6,24}$/.test(trimmedPhone) || phoneDigits.length < 6 || phoneDigits.length > 15) {
      setStatus('error'); setError(formCopy.phoneError); document.getElementById('home-help-phone')?.focus(); return
    }

    const enquiry = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      subject: 'Homepage trip help request',
      message: 'Please contact me to help plan an Egypt trip.',
      sourcePage: '/',
    }
    const payload = JSON.stringify(enquiry)
    if (pendingRequest.current?.payload !== payload) {
      pendingRequest.current = { payload, id: createEnquiryRequestId() }
    }

    submitting.current = true
    setStatus('submitting')
    setError('')
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...enquiry, requestId: pendingRequest.current.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || typeof data?.enquiry?.publicId !== 'string' || typeof data?.enquiry?.createdAt !== 'string') {
        throw new Error(formCopy.failure)
      }
      pendingRequest.current = null
      setName('')
      setEmail('')
      setPhone('')
      setStatus('success')
    } catch {
      setStatus('error')
      setError(formCopy.failure)
    } finally {
      submitting.current = false
    }
  }

  const disabled = status === 'submitting'
  return <section className="help-home container"><div className="help-layout"><div className="help-text"><h2>{copy.helpT}</h2><p>{copy.helpS}</p></div><form className="help-form" onSubmit={submit} noValidate><input id="home-help-name" placeholder={copy.helpN} required maxLength={120} disabled={disabled} value={name} onChange={(event)=>{setName(event.target.value);clearStatus()}} aria-label={copy.helpN} aria-invalid={status==='error'&&!name.trim()} aria-describedby="home-help-status"/><input id="home-help-email" placeholder={copy.helpE} required type="email" maxLength={190} disabled={disabled} value={email} onChange={(event)=>{setEmail(event.target.value);clearStatus()}} aria-label={copy.helpE} aria-describedby="home-help-status"/><InternationalPhoneInput id="home-help-phone" required disabled={disabled} value={phone} onChange={(value)=>{setPhone(value);clearStatus()}} locale={locale} placeholder={copy.helpP} describedBy="home-help-status"/><button className="primary-btn" type="submit" disabled={disabled}>{disabled?formCopy.sending:copy.contactNow}</button><p id="home-help-status" className={`help-form-status ${status}`} role={status==='error'?'alert':'status'} aria-live="polite">{status==='success'?`${copy.thanks1}${name?` ${name}`:''}${copy.thanks2}`:error}</p></form></div></section>
}

const galleryBlurPlaceholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

function GalleryPhotoImg({src,alt}:{src:string;alt:string}){
  const sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
  // next/image only serves local paths + allowlisted remotes; anything
  // else falls back to a plain image so admin URLs never break the row.
  if(src.startsWith('/')) return <Image src={src} alt={alt} fill sizes={sizes} loading="lazy" placeholder="blur" blurDataURL={galleryBlurPlaceholder}/>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy"/>
}

function JourneyGallerySection({title,subtitle}:{title:string;subtitle:string}){
  const [lightbox,setLightbox]=useState<string|null>(null);
  const [activeVideo,setActiveVideo]=useState<GalleryItem|null>(null);
  const {photos:dbPhotos,videos:dbVideos}=useHomepageGallery();
  // Fully database-driven: only photos published from the admin dashboard.
  // An empty row hides; an empty section hides. No hardcoded content.
  const photoItems=dbPhotos.map((p)=>({src:p.mediaUrl,label:p.title}));
  const videoItems=dbVideos.map((item)=>({item,source:resolveGalleryVideoSource(item.mediaUrl,item.platform)})).filter((v):v is {item:GalleryItem;source:NonNullable<ReturnType<typeof resolveGalleryVideoSource>>}=>Boolean(v.source));
  // Pause the video marquee while its accessible player is open.
  useEffect(()=>{
    if(!activeVideo) return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape') setActiveVideo(null)};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[activeVideo]);
  const activeSource=activeVideo?resolveGalleryVideoSource(activeVideo.mediaUrl,activeVideo.platform):null;
  // Both rows empty → hide the section gracefully.
  if(!photoItems.length&&!videoItems.length) return null;
  return <section className="home-section gal-section"><div className="container"><SectionHeading title={title} subtitle={subtitle}/></div><div className="gal-marquee" dir="ltr">{photoItems.length>0&&<div className="gal-track">{[0,1].map(half=><div className="gal-group" key={'a'+half} aria-hidden={half===1}>{photoItems.map((g,i)=><div key={g.src+i+half} className="gal-card" role="button" tabIndex={half===1?-1:0} aria-label={'Enlarge photo: '+g.label} onClick={()=>setLightbox(g.src)} onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault();setLightbox(g.src)}}}><GalleryPhotoImg src={g.src} alt={g.label}/><b>{g.label}</b></div>)}</div>)}</div>}{videoItems.length>0&&<div className={`gal-track rev${activeVideo?' is-paused':''}`}>{[0,1].map(half=><div className="gal-group" key={'b'+half} aria-hidden={half===1}>{videoItems.map(({item,source},i)=><div key={item.id+i+half} className="gal-card" role="button" tabIndex={half===1?-1:0} aria-label={'Play video: '+item.title} onClick={()=>setActiveVideo(item)} onKeyDown={(e)=>{if(e.key==='Enter'){e.preventDefault();setActiveVideo(item)}}}>{item.thumbnail?<GalleryPhotoImg src={item.thumbnail} alt=""/>:<span className="gal-video-fallback" aria-hidden="true"/>}<span className="gal-play"><Play size={16} fill="currentColor"/></span><b>{item.title}</b><span className="gal-video-platform">{galleryPlatformLabel(source.platform)}</span></div>)}</div>)}</div>}</div>{lightbox&&<div role="dialog" aria-modal="true" aria-label="Photo preview" onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,zIndex:200,display:'grid',placeItems:'center',background:'rgba(0,0,0,.82)',padding:24}}><Image src={lightbox} alt="Egypt travel moment enlarged" fill sizes="min(920px,100vw)" style={{maxWidth:'min(920px,100%)',maxHeight:'85vh',borderRadius:18}}/><button type="button" onClick={()=>setLightbox(null)} aria-label="Close preview" style={{position:'fixed',top:20,right:20,width:48,height:48,minHeight:48,borderRadius:'50%',border:0,background:'#fff',fontSize:22,cursor:'pointer'}}>×</button></div>}{activeVideo&&activeSource&&<div role="dialog" aria-modal="true" aria-label={'Play video: '+activeVideo.title} onClick={()=>setActiveVideo(null)} style={{position:'fixed',inset:0,zIndex:200,display:'grid',placeItems:'center',background:'rgba(0,0,0,.82)',padding:24}}><div onClick={(e)=>e.stopPropagation()} style={{width:'min(880px,100%)',background:'#000',borderRadius:18,overflow:'hidden'}}>{activeSource.kind==='embed'&&<iframe title={activeVideo.title} src={activeSource.src} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{display:'block',width:'100%',aspectRatio:'16/9',border:0}}/>}{activeSource.kind==='direct'&&<video controls playsInline preload="metadata" poster={activeVideo.thumbnail??undefined} src={activeSource.src} style={{display:'block',width:'100%',maxHeight:'80vh',background:'#000'}}/>}{activeSource.kind==='external'&&<a href={activeSource.src} target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:48,color:'#fff',fontWeight:700}}>Watch on the original platform</a>}</div><button type="button" autoFocus onClick={()=>setActiveVideo(null)} aria-label="Close video" style={{position:'fixed',top:20,right:20,width:48,height:48,minHeight:48,borderRadius:'50%',border:0,background:'#fff',fontSize:22,cursor:'pointer'}}>×</button></div>}</section>
}

export function RebuiltHomePage(){return <SiteShell><RebuiltHomePageInner/></SiteShell>}
function RebuiltHomePageInner(){const [category,setCategory]=useState('All'); const [msDest,setMsDest]=useState(''); const [msFrom,setMsFrom]=useState(''); const [msTo,setMsTo]=useState(''); const [msGuests,setMsGuests]=useState(''); const {locale:hl}=useLocale(); const hx=homeStrings[hl]; const liveBlogs=useDbBlogs(allBlogs).filter((b)=>b.isPublished!==false); const liveDestinations=useDbDestinations(allDestinations).filter((d)=>d.showInDestinations!==false&&d.isPublished!==false); const liveSeasonal=useDbTours(seasonal); const livePopular=useDbTours(popular); const liveCatalog=useDbTours(catalogTours); const goPlan=()=>{const q=new URLSearchParams(); if(msDest)q.set('destination',msDest); if(msFrom)q.set('from',msFrom); if(msTo)q.set('to',msTo); if(msGuests)q.set('guests',msGuests); if(msFrom&&msTo)q.set('step','2'); const s=q.toString(); router.push('/make-your-trip'+(s?`?${s}`:'')); }; const router=useRouter(); const visiblePopular=category==='All'?livePopular:liveCatalog.filter((t)=>t.category===category).slice(0,8); return <main className="rebuilt-home">
  <section className="home-hero"><Image src="/egypt-hero.png" alt="Egyptian temple columns in warm desert light at sunset" fill priority sizes="100vw" className="home-hero-img" /><div className="home-hero-shade"/><div className="home-hero-copy"><span>{hx.heroSpan}</span><h1>{hx.heroTitle}</h1></div><TripSearchEngine/></section>
  <StatsStrip/>
  <section className="home-section container"><SectionHeading title={hx.xmasT} subtitle={hx.xmasS}/><div className="compact-tour-grid">{liveSeasonal.map(t=><TourCard key={t.title} tour={t}/>)}</div><div className="center-cta"><ViewAll href="/egypt-tours/multi-days-tours"/></div></section>
  <section className="home-section home-soft"><div className="container"><SectionHeading title={hx.popT} subtitle={hx.popS}/><div className="category-pills" role="tablist" aria-label="Filter destinations">{[['All',hx.all],['one-day-tours',hx.oneDay],['multi-days-tours',hx.multiDays],['nile-cruises',hx.nileCruises],['shore-excursions',hx.shoreExcursion]].map(([v,l])=><button key={v} type="button" role="tab" aria-selected={category===v} className={category===v?'active':''} onClick={()=>setCategory(v)}>{l}</button>)}</div>{visiblePopular.length?<div className="compact-tour-grid popular-grid">{visiblePopular.map(t=><TourCard key={t.slug} tour={t}/>)}</div>:<div className="account-empty"><h3>{hx.noTours} {category} {hx.noToursEnd}</h3><p>{hx.tryOther}</p><button type="button" className="primary-btn" onClick={()=>setCategory('All')}>{hx.showAll}</button></div>}<div className="center-cta"><ViewAll/></div></div></section>
  <section className="home-section container trip-promo"><SectionHeading title={hx.tripT} subtitle={hx.tripS}/><div className="mini-search"><label><small>{hx.msDest}</small><SharedSelect value={msDest} onChange={setMsDest} locale={hl} label={hx.msDest} placeholder="" guidance={hx.msDestPh} modal={false} options={[...liveDestinations.map((d) => ({ value: d.slug, label: d.title }))]} /></label><div className="ms-dates"><label><small>{hx.msFrom}</small><DateInput aria-label={hx.msFrom} value={msFrom} onChange={(e)=>{const next=e.target.value; setMsFrom(next); if(next&&msTo&&msTo<next)setMsTo('')}}/></label><label><small>{hx.msTo}</small><DateInput aria-label={hx.msTo} value={msTo} min={msFrom||undefined} onChange={(e)=>setMsTo(e.target.value)}/></label></div><label><small>{hx.msTrav}</small><SharedSelect value={msGuests} onChange={setMsGuests} locale={hl} label={hx.msTrav} placeholder="" guidance={hx.msTravPh} modal={false} options={[...[1,2,3,4,5,6,7,8].map((n) => ({ value: String(n), label: `${n} ${n===1?hx.person:hx.people}` })), { value: '9', label: hx.ninePlus }]} /></label><button type="button" className="primary-btn" onClick={goPlan}>{hx.startPlan} <ArrowRight size={17}/></button></div></section>
  <section className="home-section home-soft"><div className="container"><SectionHeading eyebrow={hx.offE} title={hx.offT} subtitle={hx.offS}/><OfferCards placement="home" limit={4}/><div className="center-cta"><ViewAll href="/special-offers"/></div></div></section>
  <section className="home-section container how-home"><SectionHeading title={hx.howT} subtitle={hx.howS}/><div className="how-path-wrap" dir="ltr"><svg className="how-path-svg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path id="howFlightPath" d="M-20,110 C60,110 140,50 240,55 C340,60 360,112 470,116 C540,119 560,119 600,117 C660,114 700,60 800,55 C880,51 900,60 960,57 C1050,53 1100,85 1220,70" fill="none" stroke="#c3d2e8" strokeWidth="2.5" strokeDasharray="9 9" strokeLinecap="round" className="how-dashes"/><g transform="translate(14,110)" fill="#9aa7bd"><path d="M0,0 C-5,-7 -8,-10.5 -8,-15 a8,8 0 0,1 16,0 C8,-10.5 5,-7 0,0 Z"/><circle cx="0" cy="-15" r="3" fill="#fff"/></g><g fill="#9aa7bd"><animateMotion dur="16s" repeatCount="indefinite" rotate="auto"><mpath href="#howFlightPath"/></animateMotion><path d="M15,0 L-7,-7.5 L-2.5,0 L-7,7.5 Z"/></g></svg><div className="how-steps">{[[<MousePointerClick size={34}/>,'20%','0px',hx.howP[0],hx.howTi[0],hx.howD[0],'/egypt-tours/one-day-tours'],[<CalendarDays size={34}/>,'50%','59px',hx.howP[1],hx.howTi[1],hx.howD[1],'/make-your-trip'],[<ThumbsUp size={34}/>,'80%','0px',hx.howP[2],hx.howTi[2],hx.howD[2],'/special-offers']].map(([icon,left,top,pill,title,text,href])=><Link key={pill as string} href={href as string} className="how-node" style={{left:left as string,top:top as string}}><span className="how-disc">{icon}</span><span className="how-pill">{pill as string}</span><h3>{title as string}</h3><p>{text as string}</p></Link>)}</div></div></section>
  <section className="home-section home-soft hl-section"><div className="container"><SectionHeading title={hx.hlT} subtitle={hx.hlS}/></div><div className="hl-marquee" dir="ltr"><div className="hl-track">{[0,1].map(half=><div className="hl-group" key={half} aria-hidden={half===1}>{liveDestinations.map(d=><Link href={`/destinations/${d.slug}`} key={d.slug+'-'+half} className="hl-card" tabIndex={half===1?-1:0}><Image src={d.image} alt={d.title} fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="/><span>{d.title}</span></Link>)}</div>)}</div></div></section>
  <section className="home-section container"><SectionHeading title={hx.blogT} subtitle={hx.blogS}/><div className="blog-home-grid">{liveBlogs.map(b=><article key={b.slug}><Image src={b.image} alt={b.title} width={600} height={360} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="/><div><small>{b.category}</small><h3><Link href={`/blogs/${b.slug}`}>{b.title}</Link></h3><Link href={`/blogs/${b.slug}`} style={{display:'inline-flex',alignItems:'center',gap:6,color:'var(--blue)',fontSize:12,fontWeight:700}}>{hx.readMore} <ArrowRight size={14}/></Link></div></article>)}</div><div className="center-cta"><ViewAll href="/blogs"/></div></section>
  <section className="sustainability container"><div className="sus-main"><span className="sus-eyebrow">{hx.susE}</span><h2>{hx.susT1} <em>{hx.susT2}</em></h2><p>{hx.susP}</p><div className="sus-stats">{[[<Users size={17}/>,hx.susA[0],hx.susA[1]],[<Landmark size={17}/>,hx.susB[0],hx.susB[1]],[<Leaf size={17}/>,hx.susC[0],hx.susC[1]]].map(([icon,a,b])=><div key={b as string}>{icon}<span>{a as string}<small>{b as string}</small></span></div>)}</div><Link className="sus-cta" href="/about">{hx.susCta} <ArrowRight size={16}/></Link></div><div className="sus-badge"><span className="sus-ring" aria-hidden="true"/><b>{hx.susB1}<br/><strong>{hx.susB2}</strong></b><small>{hx.susB3}</small></div></section>
  <JourneyGallerySection title={hx.galT} subtitle={hx.galS}/>
  <ReviewsSection/>
  <section className="home-section container faq-home"><div><SectionHeading title={hx.faqT} subtitle={hx.faqS}/><Link className="small-orange-btn" href="/faq">{hx.faqAll} <ArrowRight size={15}/></Link></div><div className="faq-home-list">{(hx as { faqQ: readonly string[] }).faqQ.map((q: string, i: number)=><details key={q} open={i===0}><summary>{q}<span>+</span></summary><p>{hx.faqA}</p></details>)}</div></section>
  <HomepageHelpForm/>
</main>}
