'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CalendarCheck, CalendarDays, Camera, Check, CircleAlert, Clock3, Compass, CarFront, Gift, Headphones, Mail, MapPin, MessageCircle, Minus, Phone, Plus, Search, Send, Share2, ShieldCheck, Sparkles, Star, Sun, Ticket, Users, type LucideIcon } from 'lucide-react'
import { blogs, cars, destinations, events, faqs, offers, policies, siteImages, allSearchItems, findBlog, findCar, findDestination, findEvent, findOffer } from '@/data/content'
import { isCustomSlug, useBrandSettings, useLiveCollection, useLiveDestinations, useLiveEvents, useLiveFind } from '@/lib/admin-store'
import { useDbTours } from '@/lib/tours-client'
import { eventCity, eventMapQuery, eventPriceLabel, eventStatusLabel, getEventStatus, getPublishedEvents, getRelatedEvents, isEventPublished, parseLegacyEventRange, resolveEventRange } from '@/lib/events'
import { EventRequestForm } from './event-request-form'
import { phoneHref, whatsappHref } from '@/data/company'
import { findTour, getTourOffer, seasonalOfferDeadline, seasonalTours } from '@/data/tours'
import type { Blog, Car, Event, Offer, Tour } from '@/data/types'
import { parseCarRequestQuery, parseSearchQuery } from '@/lib/query'
import { CAR_LOCATION_MAX, CAR_NOTE_MAX, hasCarErrors, isCarReference, sanitizeCarDraft, validateCarRequest, type CarFieldErrors, type CarRequest, type CarRequestDraft } from '@/lib/car-request'
import { ImpersonationBanner } from './impersonation-banner'
import { useLocale, formatPrice, tx, type Locale } from './locale'
import { Breadcrumb, Heading, HelpCTA, PageShowcaseHero, SiteShell, TourCard, extra, images } from '@/components/site'
import { PromotionCard, promotionGalleryForTour } from '@/components/promotion-card'
import { InternationalPhoneInput } from './international-phone-input'
import { useCurrentUser } from '@/lib/use-current-user'
import { SharedSelect } from '@/components/shared-select'
import { telLink, whatsappLink } from '@/lib/phone'
import { DateInput } from '@/components/date-input'

export function EditorialHero({ eyebrow, title, copy, image = siteImages.pyramids, action = 'Explore with us', href = '/egypt-tours/one-day-tours' }: { eyebrow?: string; title: string; copy: string; image?: string; action?: string; href?: string }) {
  return <section className="editorial-hero"><img src={image} alt=""/><div className="editorial-overlay"/><div className="container editorial-content">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1><p>{copy}</p><Link className="primary-btn" href={href}>{action}<ArrowRight size={17}/></Link></div></section>
}

export function DetailNotFound({ title, copy, backHref, backLabel }: { title: string; copy: string; backHref: string; backLabel: string }) {
  return <SiteShell><main className="not-found"><div className="not-found-mark">404</div><h1>{title}</h1><p>{copy}</p><Link href={backHref} className="primary-btn">{backLabel}</Link></main></SiteShell>
}

export function ContentCard({ item, type = 'blog' }: { item: Blog | Event | Offer; type?: 'blog' | 'event' | 'offer' }) {
  const { locale } = useLocale()
  const href = type === 'blog' ? `/blogs/${item.slug}` : type === 'event' ? `/events/${item.slug}` : type === 'offer' ? `/special-offers/${item.slug}` : `/destinations/${item.slug}`
  const badge = 'badge' in item ? item.badge : undefined
  const meta = 'category' in item ? `${item.category}, ${item.date}` : 'date' in item ? item.date : undefined
  const description = 'excerpt' in item ? item.excerpt : item.copy
  return <article className="content-card"><Link href={href} className="content-image"><img src={item.image} alt={item.title}/>{badge && <b>{badge}</b>}</Link><div className="content-card-body">{meta && <small>{meta}</small>}<h3><Link href={href}>{item.title}</Link></h3><p>{description}</p><Link className="text-link" href={href}>{tx(locale, { en: 'Read more', es: 'Leer más', it: 'Leggi di più', ar: 'اقرأ المزيد' })} <ArrowRight size={15}/></Link></div></article>
}

export { AboutPage } from './about-page'

export function ContactPage() {
  return <SiteShell><ContactPageContent /></SiteShell>
}

function ContactPageContent() {
  const { locale: cl } = useLocale()
  const brand = useBrandSettings()
  const ar = cl === 'ar'
  const ex = extra[cl]
  const contactMethods = [
    { Icon: Mail, title: tx(cl, { en: 'Email our travel team', es: 'Escribe a nuestro equipo de viajes', it: 'Scrivi al nostro team di viaggio', ar: 'راسل فريق الرحلات' }), value: brand.email, note: tx(cl, { en: 'For itineraries and general questions', es: 'Para itinerarios y consultas generales', it: 'Per itinerari e domande generali', ar: 'لبرامج الرحلات والأسئلة العامة' }), href: `mailto:${brand.email}` },
    { Icon: Phone, title: tx(cl, { en: 'Call our travel team', es: 'Llama a nuestro equipo de viajes', it: 'Chiama il nostro team di viaggio', ar: 'اتصل بفريقنا' }), value: brand.phone, note: tx(cl, { en: 'For direct enquiries and travel help', es: 'Para consultas directas y ayuda con tu viaje', it: 'Per richieste dirette e assistenza di viaggio', ar: 'للتواصل المباشر والاستفسارات' }), href: phoneHref(brand.phone) },
    { Icon: MessageCircle, title: tx(cl, { en: 'Chat with us on WhatsApp', es: 'Escríbenos por WhatsApp', it: 'Scrivici su WhatsApp', ar: 'راسلنا على واتساب' }), value: brand.whatsapp, note: tx(cl, { en: 'Start a direct WhatsApp conversation', es: 'Inicia una conversación directa por WhatsApp', it: 'Avvia una conversazione WhatsApp diretta', ar: 'ابدأ محادثة واتساب مباشرة' }), href: whatsappHref(brand.whatsapp) },
  ]
  const steps = [['01', tx(cl, { en: 'Tell us about your trip', es: 'Cuéntanos tu viaje', it: 'Raccontaci il tuo viaggio', ar: 'احكيلنا عن رحلتك' }), tx(cl, { en: 'Share your dates, group size, and the places you want to experience.', es: 'Comparte tus fechas, el tamaño del grupo y los lugares que quieres conocer.', it: 'Condividi date, numero di partecipanti e luoghi che vuoi scoprire.', ar: 'شاركنا مواعيدك، عدد المسافرين، والأماكن اللي نفسك تشوفها.' })], ['02', tx(cl, { en: 'We shape the details', es: 'Damos forma a los detalles', it: 'Diamo forma ai dettagli', ar: 'نرتب التفاصيل' }), tx(cl, { en: 'Our local team reviews your idea and connects the right route and experiences.', es: 'Nuestro equipo local revisa tu idea y une la ruta y las experiencias adecuadas.', it: 'Il nostro team locale esamina la tua idea e collega itinerario ed esperienze giusti.', ar: 'فريقنا المحلي يراجع فكرتك ويجمع أنسب مسار وتجارب ليك.' })], ['03', tx(cl, { en: 'Receive a clear proposal', es: 'Recibe una propuesta clara', it: 'Ricevi una proposta chiara', ar: 'تستلم تصور واضح' }), tx(cl, { en: 'We return with an easy-to-review plan before you make any commitment.', es: 'Te devolvemos un plan fácil de revisar antes de ningún compromiso.', it: 'Ti presentiamo un piano facile da rivedere prima di qualsiasi impegno.', ar: 'نرجعلك بخطة مفهومة وتفاصيل جاهزة للمراجعة قبل أي التزام.' })]]

  return <main className="contact-v2">
      <PageShowcaseHero image={siteImages.nile} eyebrow={tx(cl, { en: 'Local team, personal planning', es: 'Equipo local, planificación personal', it: 'Team locale, pianificazione personale', ar: 'فريق محلي, تخطيط شخصي' })} title={tx(cl, { en: 'Your Egypt journey starts with a conversation.', es: 'Tu viaje a Egipto empieza con una conversación.', it: 'Il tuo viaggio in Egitto inizia con una conversazione.', ar: 'رحلتك لمصر تبدأ بمحادثة.' })} intro={tx(cl, { en: 'Tell us how you want to experience Egypt, and we will help turn the idea into a thoughtful route shaped around your time and interests.', es: 'Cuéntanos cómo quieres vivir Egipto y te ayudaremos a convertir la idea en una ruta a medida según tu tiempo e intereses.', it: 'Raccontaci come vuoi vivere l\'Egitto: ti aiuteremo a trasformare l\'idea in un itinerario pensato su tempi e interessi.', ar: 'قولنا نفسك تشوف مصر إزاي، وإحنا نساعدك تحول الفكرة لمسار متوازن يناسب وقتك واهتماماتك.' })} primaryLabel={tx(cl, { en: 'Start the conversation', es: 'Inicia la conversación', it: 'Avvia la conversazione', ar: 'ابدأ المحادثة' })} primaryHref="#contact-enquiry" secondaryLabel={tx(cl, { en: 'Build a detailed trip', es: 'Crea un viaje detallado', it: 'Crea un viaggio dettagliato', ar: 'خطط رحلتك بالتفصيل' })} secondaryHref="/make-your-trip" railLabel={tx(cl, { en: 'Start here', es: 'Empieza aquí', it: 'Inizia qui', ar: 'ابدأ من هنا' })} railTitle={tx(cl, { en: 'Tell us the journey you have in mind.', es: 'Cuéntanos el viaje que tienes en mente.', it: 'Raccontaci il viaggio che hai in mente.', ar: 'احكيلنا عن الرحلة اللي في بالك.' })} railHref="#contact-enquiry" railMeta={[{ Icon: MessageCircle, label: tx(cl, { en: 'Preview enquiry', es: 'Solicitud de vista previa', it: 'Richiesta di anteprima', ar: 'طلب تجريبي' }) }, { Icon: ShieldCheck, label: tx(cl, { en: 'No data sent', es: 'Sin envío de datos', it: 'Nessun dato inviato', ar: 'لا يتم إرسال بيانات' }) }]} statsLabel={tx(cl, { en: 'Contact summary', es: 'Resumen de contacto', it: 'Riepilogo contatti', ar: 'ملخص التواصل' })} stats={[{ value: contactMethods.length, label: tx(cl, { en: 'Ways to connect', es: 'Formas de contactar', it: 'Modi per contattarci', ar: 'طرق للتواصل' }) }, { value: steps.length, label: tx(cl, { en: 'Planning steps', es: 'Pasos de planificación', it: 'Fasi di pianificazione', ar: 'خطوات للتخطيط' }) }]}/>
      <Breadcrumb items={[ex.contactTitle]}/>

      <section className="contact-v2-trust" aria-label={tx(cl, { en: 'Reasons to contact us', es: 'Por qué contactarnos', it: 'Perché contattarci', ar: 'مميزات التواصل معنا' })}>
        <div className="container">
          <span><MapPin size={20} /><b>{tx(cl, { en: 'Egypt-based local insight', es: 'Conocimiento local desde Egipto', it: 'Conoscenza locale dall\'Egitto', ar: 'خبرة محلية داخل مصر' })}</b></span>
          <span><Clock3 size={20} /><b>{tx(cl, { en: 'Planning around your time', es: 'Planificación a tu medida', it: 'Pianificazione sui tuoi tempi', ar: 'تخطيط حسب وقتك' })}</b></span>
          <span><ShieldCheck size={20} /><b>{tx(cl, { en: 'Clear details before booking', es: 'Detalles claros antes de reservar', it: 'Dettagli chiari prima di prenotare', ar: 'تفاصيل واضحة قبل الحجز' })}</b></span>
        </div>
      </section>

      <section id="contact-enquiry" className="container contact-v2-main">
        <div className="contact-v2-intro">
          <span className="eyebrow">{tx(cl, { en: 'Let us plan it together', es: 'Planifiquémoslo juntos', it: 'Pianifichiamolo insieme', ar: 'خلينا نخططها سوا' })}</span>
          <h2>{tx(cl, { en: 'What kind of journey do you have in mind?', es: '¿Qué tipo de viaje tienes en mente?', it: 'Che tipo di viaggio hai in mente?', ar: 'إيه شكل الرحلة اللي في بالك؟' })}</h2>
          <p>{tx(cl, { en: 'Whether it is one day in Cairo, a complete package, a Nile cruise, or an airport transfer, send us the starting point and let our team connect the details.', es: 'Ya sea un día en El Cairo, un paquete completo, un crucero por el Nilo o un traslado al aeropuerto: envíanos la idea inicial y nuestro equipo unirá los detalles.', it: 'Che si tratti di un giorno al Cairo, di un pacchetto completo, di una crociera sul Nilo o di un trasferimento aeroportuale: inviaci l\'idea di partenza e il nostro team collegherà i dettagli.', ar: 'سواء يوم واحد في القاهرة، باكدج كاملة، نايل كروز، أو استقبال من المطار، ابعتلنا الفكرة الأساسية وسيب التفاصيل علينا.' })}</p>
          <div className="contact-v2-methods">
            {contactMethods.map(({ Icon, ...method }) => <a href={method.href} key={method.title} className="contact-v2-method" target={method.href.startsWith('https://wa.me/') ? '_blank' : undefined} rel={method.href.startsWith('https://wa.me/') ? 'noreferrer' : undefined}>
              <Icon size={22} />
              <span><small>{method.title}</small><strong>{method.value}</strong><em>{method.note}</em></span>
              <ArrowRight size={18} />
            </a>)}
          </div>
          <a className="contact-v2-address" href={brand.mapUrl || undefined} target={brand.mapUrl ? '_blank' : undefined} rel={brand.mapUrl ? 'noreferrer' : undefined}><MapPin size={22} /><span><small>{ex.addrT}</small><strong>{brand.address}</strong></span></a>
        </div>
        <div className="contact-v2-form-wrap">
          <header><span>{tx(cl, { en: 'Trip enquiry', es: 'Solicitud de viaje', it: 'Richiesta di viaggio', ar: 'طلب رحلة' })}</span><h2>{tx(cl, { en: 'Start here.', es: 'Empieza aquí.', it: 'Inizia qui.', ar: 'ابدأ من هنا.' })}</h2><p>{tx(cl, { en: 'The more you share, the more useful our first response can be.', es: 'Cuanto más nos cuentes, más útil será nuestra primera respuesta.', it: 'Più ci racconti, più utile sarà la nostra prima risposta.', ar: 'كل ما تحكيلنا أكتر، نقدر نساعدك بصورة أدق.' })}</p></header>
          <ContactForm />
        </div>
      </section>

      <section className="contact-v2-process">
        <div className="container">
          <header><span className="eyebrow">{tx(cl, { en: 'What happens next', es: 'Qué pasa después', it: 'Cosa succede dopo', ar: 'بعد ما تبعتلنا' })}</span><h2>{tx(cl, { en: 'From first message to a clear travel plan.', es: 'Del primer mensaje a un plan de viaje claro.', it: 'Dal primo messaggio a un piano di viaggio chiaro.', ar: 'من أول رسالة لخطة رحلة واضحة.' })}</h2></header>
          <div>{steps.map(([number, title, copy]) => <article key={number}><b>{number}</b><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="container contact-v2-faq">
        <div><span className="eyebrow">{ex.faqTeaser}</span><h2>{tx(cl, { en: 'Before you get in touch.', es: 'Antes de contactarnos.', it: 'Prima di contattarci.', ar: 'قبل ما تراسلنا.' })}</h2><p>{tx(cl, { en: 'Quick answers to the questions that usually begin a journey.', es: 'Respuestas rápidas a las preguntas con las que suele empezar un viaje.', it: 'Risposte rapide alle domande con cui di solito inizia un viaggio.', ar: 'إجابات سريعة على الأسئلة اللي غالبًا بتبدأ بيها الرحلة.' })}</p></div>
        <div>{faqs.slice(0, 3).map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}<Link className="text-link" href="/faq">{ex.seeMore} <ArrowRight size={15} /></Link></div>
      </section>
    </main>
}

export function ContactForm() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [sent, setSent] = useState(false)
  if (sent) return <div className="form-success contact-v2-success"><Check size={38} /><span>{tx(locale, { en: 'Preview complete', es: 'Vista previa completa', it: 'Anteprima completata', ar: 'تم في النسخة التجريبية' })}</span><h2>{tx(locale, { en: 'We have your trip idea.', es: 'Hemos recibido tu idea de viaje.', it: 'Abbiamo ricevuto la tua idea di viaggio.', ar: 'وصلنا لفكرة رحلتك.' })}</h2><p>{tx(locale, { en: 'This is an on-site preview confirmation. No details were transmitted.', es: 'Esta es una confirmación de vista previa en el sitio. No se ha transmitido ningún dato.', it: 'Questa è una conferma di anteprima sul sito. Nessun dato è stato trasmesso.', ar: 'ده تأكيد تجريبي داخل الموقع فقط، ولم يتم إرسال أي بيانات.' })}</p><button type="button" className="outline-btn" onClick={() => setSent(false)}>{tx(locale, { en: 'Write another message', es: 'Escribe otro mensaje', it: 'Scrivi un altro messaggio', ar: 'اكتب رسالة جديدة' })}</button></div>
  return <form className="contact-form contact-v2-form" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
    <div className="form-grid">
      <label>{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم بالكامل' })}<input required autoComplete="name" placeholder={tx(locale, { en: 'Your name', es: 'Tu nombre', it: 'Il tuo nome', ar: 'اسمك' })} /></label>
      <label>{tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })}<input required type="email" autoComplete="email" placeholder="you@example.com" /></label>
      <label className="full">{tx(locale, { en: 'What can we help with?', es: '¿En qué podemos ayudarte?', it: 'Come possiamo aiutarti?', ar: 'نوع الرحلة' })}<select required defaultValue=""><option value="" disabled>{tx(locale, { en: 'Choose a trip type', es: 'Elige un tipo de viaje', it: 'Scegli un tipo di viaggio', ar: 'اختار نوع الرحلة' })}</option><option>{tx(locale, { en: 'One-day tour', es: 'Excursión de un día', it: 'Tour di un giorno', ar: 'رحلة يوم واحد' })}</option><option>{tx(locale, { en: 'Multi-day package', es: 'Paquete de varios días', it: 'Pacchetto di più giorni', ar: 'باكدج متعددة الأيام' })}</option><option>{tx(locale, { en: 'Nile cruise', es: 'Crucero por el Nilo', it: 'Crociera sul Nilo', ar: 'نايل كروز' })}</option><option>{tx(locale, { en: 'Shore excursion', es: 'Excursión en tierra', it: 'Escursione a terra', ar: 'رحلة شاطئية' })}</option><option>{tx(locale, { en: 'Car hire or transfer', es: 'Alquiler de coche o traslado', it: 'Noleggio auto o trasferimento', ar: 'تأجير عربية أو استقبال' })}</option><option>{tx(locale, { en: 'Custom journey', es: 'Viaje a medida', it: 'Viaggio su misura', ar: 'رحلة مصممة مخصوص' })}</option></select></label>
      <label className="full">{tx(locale, { en: 'Tell us about your trip', es: 'Cuéntanos tu viaje', it: 'Raccontaci il tuo viaggio', ar: 'احكيلنا عن الرحلة' })}<textarea required placeholder={tx(locale, { en: 'Dates, group size, and the places or experiences you are interested in...', es: 'Fechas, tamaño del grupo y lugares o experiencias que te interesen...', it: 'Date, numero di partecipanti e luoghi o esperienze di interesse...', ar: 'المواعيد، عدد المسافرين، والأماكن أو التجارب اللي مهتم بيها...' })} /></label>
    </div>
    <button className="primary-btn" type="submit">{tx(locale, { en: 'Send preview enquiry', es: 'Enviar solicitud de vista previa', it: 'Invia richiesta di anteprima', ar: 'إرسال طلب تجريبي' })} <Send size={17} /></button>
    <small className="contact-v2-form-note"><ShieldCheck size={14} />{tx(locale, { en: 'Preview form: your details do not leave this page.', es: 'Formulario de vista previa: tus datos no salen de esta página.', it: 'Modulo di anteprima: i tuoi dati non lasciano questa pagina.', ar: 'نموذج تجريبي: بياناتك لا تغادر هذه الصفحة.' })}</small>
  </form>
}

export function CarsPage() {
  return <SiteShell><CarsPageContent /></SiteShell>
}

function CarsPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveCars = useLiveCollection('cars', cars)
  const featured = liveCars[2] ?? liveCars[0]
  const maxSeats = liveCars.length ? Math.max(...liveCars.map((car) => Number.parseInt(car.seats, 10) || 0)) : 0
  if (!featured) return <main><div className="container"><section className="section"><div className="section-heading"><span className="eyebrow">{tx(locale, { en: 'Our fleet', es: 'Nuestra flota', it: 'La nostra flotta', ar: 'الأسطول' })}</span><h2>{tx(locale, { en: 'No vehicles listed right now', es: 'Sin vehículos disponibles ahora mismo', it: 'Nessun veicolo disponibile al momento', ar: 'لا توجد سيارات متاحة حاليًا' })}</h2><p>{tx(locale, { en: 'Check back later or contact us and we will help arrange your transfer.', es: 'Vuelve más tarde o contáctanos y te ayudaremos a organizar tu traslado.', it: 'Torna più tardi o contattaci: ti aiuteremo a organizzare il trasferimento.', ar: 'عُد لاحقًا أو تواصل معنا وسنساعدك في ترتيب انتقالك.' })}</p><Link href="/contact" className="primary-btn">{tx(locale, { en: 'Contact us', es: 'Contáctanos', it: 'Contattaci', ar: 'تواصل معنا' })} <ArrowRight size={16} /></Link></div></section></div></main>
  return <main>
    <PageShowcaseHero image={featured.image} eyebrow={tx(locale, { en: 'Private drivers & modern fleet', es: 'Conductores privados y flota moderna', it: 'Autisti privati e flotta moderna', ar: 'سائقون خصوصيون وأسطول حديث' })} title={tx(locale, { en: 'Move through Egypt with ease', es: 'Muévete por Egipto con total comodidad', it: 'Muoviti in Egitto in totale comfort', ar: 'تنقّل في مصر براحة تامة' })} intro={tx(locale, { en: 'Airport pickups, day trips, and multi-city routes with a private driver and modern air-conditioned cars.', es: 'Recogidas en el aeropuerto, excursiones de un día y rutas entre ciudades con conductor privado y coches modernos con aire acondicionado.', it: 'Trasferimenti aeroportuali, gite giornaliere e itinerari tra più città con autista privato e auto moderne climatizzate.', ar: 'استقبال من المطار ورحلات يومية وخطوط بين المدن مع سائق خاص وسيارات حديثة مكيفة.' })} primaryLabel={tx(locale, { en: 'Explore the fleet', es: 'Descubre la flota', it: 'Scopri la flotta', ar: 'استكشف الأسطول' })} primaryHref="#fleet" secondaryLabel={tx(locale, { en: 'Request this vehicle', es: 'Solicita este vehículo', it: 'Richiedi questo veicolo', ar: 'اطلب هذه السيارة' })} secondaryHref={`/rent-car/request?vehicle=${featured.slug}`} railLabel={tx(locale, { en: 'Featured vehicle', es: 'Vehículo destacado', it: 'Veicolo in evidenza', ar: 'سيارة مميزة' })} railTitle={featured.title} railHref={`/rent-car/request?vehicle=${featured.slug}`} railMeta={[{ Icon: Users, label: featured.seats }, { Icon: CarFront, label: featured.transmission }]} statsLabel={tx(locale, { en: 'Fleet summary', es: 'Resumen de la flota', it: 'Riepilogo flotta', ar: 'ملخص الأسطول' })} stats={[{ value: liveCars.length, label: tx(locale, { en: 'Fleet choices', es: 'Opciones de vehículos', it: 'Scelte di veicoli', ar: 'خيارات سيارات' }) }, { value: maxSeats, label: tx(locale, { en: 'Seats maximum', es: 'Asientos máximos', it: 'Posti massimi', ar: 'مقعدًا كحد أقصى' }) }]}/>
    <div className="container">
    <section id="fleet" className="section">
      <div className="section-heading inline-heading"><div><span className="eyebrow">{tx(locale, { en: 'Our fleet', es: 'Nuestra flota', it: 'La nostra flotta', ar: 'الأسطول' })}</span><h2>{tx(locale, { en: 'Comfort for every kind of journey', es: 'Comodidad para cada tipo de viaje', it: 'Comfort per ogni tipo di viaggio', ar: 'راحة لكل نوع رحلة' })}</h2></div><Link className="text-link" href="/rent-car/request">{tx(locale, { en: 'Need a custom vehicle?', es: '¿Necesitas un vehículo a medida?', it: 'Serve un veicolo su misura?', ar: 'هل تحتاج إلى سيارة مخصصة؟' })} <ArrowRight size={15} /></Link></div>
      <div className="fleet-grid">{liveCars.map((car) => <CarCard key={car.slug} car={car} />)}</div>
    </section>
    </div>
  </main>
}

export function CarCard({ car }: { car: Car }) {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  return <article className="fleet-card">
    <div className="fleet-card-img">
      <img
        src={car.image}
        alt={car.title}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = '/fleet-vehicle-fallback.svg'
        }}
      />
      <span className="fleet-price-badge">{formatPrice(car.dailyPrice, currency, locale)}<small>{tx(locale, { en: ' / day', es: ' / día', it: ' / giorno', ar: ' / يوم' })}</small></span>
    </div>
    <div className="fleet-card-body">
      <div className="fleet-specs"><span><Users size={14} />{car.seats}</span><span><CarFront size={14} />{car.transmission}</span></div>
      <h3>{car.title}</h3>
      <p>{car.copy}</p>
      {car.credit && <small className="fleet-credit"><a href={car.credit.url} target="_blank" rel="noreferrer">{car.credit.label}</a></small>}
      <Link href={`/rent-car/request?vehicle=${car.slug}`} className="primary-btn fleet-cta">{tx(locale, { en: 'Request this car', es: 'Solicita este coche', it: 'Richiedi quest\'auto', ar: 'اطلب هذه السيارة' })} <ArrowRight size={16} /></Link>
    </div>
  </article>
}

type CarRequestValues = { vehicleSlug: string; tripType: '' | 'One Way' | 'Round Trip'; pickup: string; dropoff: string; pickupDate: string; returnDate: string; passengers: string; fullName: string; email: string; phone: string; notes: string }

function carTodayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function focusCarField(id: string) {
  const el = document.getElementById(id)
  if (el) {
    if (!el.hasAttribute('tabindex') && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(el.tagName)) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: false })
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

function CarRequestForm({ values, errors, summary, submitting, editing, onChange, onSubmit }: { values: CarRequestValues; errors: CarFieldErrors; summary: string; submitting: boolean; editing: boolean; onChange: (patch: Partial<CarRequestValues>) => void; onSubmit: (e: React.FormEvent) => void }) {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const liveCars = useLiveCollection('cars', cars)
  const today = carTodayLocal()
  const errText = (field: keyof CarFieldErrors): string => {
    const code = errors[field]
    if (!code) return ''
    if (field === 'passengers' && values.passengers.trim() === '') return tx(locale, { en: 'Enter the number of passengers.', es: 'Indica el número de pasajeros.', it: 'Indica il numero di passeggeri.', ar: 'أدخل عدد الركاب.' })
    const en: Record<string, string> = {
      vehicle: code === 'required' ? 'Select a vehicle.' : 'Select a vehicle from the fleet list.',
      tripType: 'Choose One Way or Round Trip.',
      pickup: code === 'required' ? 'Enter the pick-up location.' : `Pick-up location must be ${CAR_LOCATION_MAX} characters or fewer.`,
      dropoff: code === 'required' ? 'Enter the drop-off location.' : `Drop-off location must be ${CAR_LOCATION_MAX} characters or fewer.`,
      pickupDate: code === 'required' ? 'Enter your preferred pick-up date.' : 'Enter a valid preferred pick-up date (today or later).',
      returnDate: code === 'required' ? 'Enter your preferred return date.' : 'Enter a valid preferred return date on or after the pick-up date.',
      passengers: 'Passengers must be a whole number from 1 to 50.',
      name: code === 'required' ? 'Enter your full name.' : 'Enter a name with at least 2 letters.',
      email: code === 'required' ? 'Enter your email address.' : 'Enter a valid email address (name@example.com).',
      phone: code === 'required' ? 'Enter your phone number.' : 'Enter a valid phone number (at least 7 digits).',
      notes: `Notes must be ${CAR_NOTE_MAX} characters or fewer.`,
    }
    const arText: Record<string, string> = {
      vehicle: code === 'required' ? 'اختر السيارة.' : 'اختر سيارة من قائمة الأسطول.',
      tripType: 'اختر ذهاب فقط أو ذهاب وعودة.',
      pickup: code === 'required' ? 'أدخل مكان الاستلام.' : `يجب ألا يتجاوز مكان الاستلام ${CAR_LOCATION_MAX} حرفًا.`,
      dropoff: code === 'required' ? 'أدخل مكان الوصول.' : `يجب ألا يتجاوز مكان الوصول ${CAR_LOCATION_MAX} حرفًا.`,
      pickupDate: code === 'required' ? 'أدخل تاريخ الاستلام المفضل.' : 'أدخل تاريخ استلام مفضلًا صالحًا (اليوم أو بعده).',
      returnDate: code === 'required' ? 'أدخل تاريخ العودة المفضل.' : 'أدخل تاريخ عودة مفضلًا صالحًا في تاريخ الاستلام أو بعده.',
      passengers: 'يجب أن يكون عدد الركاب رقمًا صحيحًا من 1 إلى 50.',
      name: code === 'required' ? 'أدخل اسمك الكامل.' : 'أدخل اسمًا من حرفين على الأقل.',
      email: code === 'required' ? 'أدخل بريدك الإلكتروني.' : 'أدخل بريدًا إلكترونيًا صالحًا (name@example.com).',
      phone: code === 'required' ? 'أدخل رقم هاتفك.' : 'أدخل رقم هاتف صالحًا (7 أرقام على الأقل).',
      notes: `يجب ألا تتجاوز الملاحظات ${CAR_NOTE_MAX} حرف.`,
    }
    const esText: Record<string, string> = {
      vehicle: code === 'required' ? 'Selecciona un vehículo.' : 'Selecciona un vehículo de la lista de la flota.',
      tripType: 'Elige Solo ida o Ida y vuelta.',
      pickup: code === 'required' ? 'Indica el lugar de recogida.' : `El lugar de recogida debe tener ${CAR_LOCATION_MAX} caracteres como máximo.`,
      dropoff: code === 'required' ? 'Indica el lugar de entrega.' : `El lugar de entrega debe tener ${CAR_LOCATION_MAX} caracteres como máximo.`,
      pickupDate: code === 'required' ? 'Indica la fecha de recogida preferida.' : 'Indica una fecha de recogida válida (hoy o posterior).',
      returnDate: code === 'required' ? 'Indica la fecha de regreso preferida.' : 'Indica una fecha de regreso válida igual o posterior a la de recogida.',
      passengers: 'El número de pasajeros debe ser un número entero entre 1 y 50.',
      name: code === 'required' ? 'Indica tu nombre completo.' : 'Indica un nombre con al menos 2 letras.',
      email: code === 'required' ? 'Indica tu correo electrónico.' : 'Indica un correo válido (nombre@ejemplo.com).',
      phone: code === 'required' ? 'Indica tu número de teléfono.' : 'Indica un teléfono válido (al menos 7 dígitos).',
      notes: `Las notas deben tener ${CAR_NOTE_MAX} caracteres como máximo.`,
    }
    const itText: Record<string, string> = {
      vehicle: code === 'required' ? 'Seleziona un veicolo.' : 'Seleziona un veicolo dalla lista della flotta.',
      tripType: 'Scegli Solo andata o Andata e ritorno.',
      pickup: code === 'required' ? 'Indica il luogo di ritiro.' : `Il luogo di ritiro deve avere al massimo ${CAR_LOCATION_MAX} caratteri.`,
      dropoff: code === 'required' ? 'Indica il luogo di riconsegna.' : `Il luogo di riconsegna deve avere al massimo ${CAR_LOCATION_MAX} caratteri.`,
      pickupDate: code === 'required' ? 'Indica la data di ritiro preferita.' : 'Indica una data di ritiro valida (oggi o successiva).',
      returnDate: code === 'required' ? 'Indica la data di ritorno preferita.' : 'Indica una data di ritorno valida pari o successiva a quella di ritiro.',
      passengers: 'Il numero di passeggeri deve essere un intero da 1 a 50.',
      name: code === 'required' ? 'Indica il tuo nome completo.' : 'Indica un nome di almeno 2 lettere.',
      email: code === 'required' ? 'Indica il tuo indirizzo email.' : 'Indica un indirizzo email valido (nome@esempio.com).',
      phone: code === 'required' ? 'Indica il tuo numero di telefono.' : 'Indica un numero valido (almeno 7 cifre).',
      notes: `Le note devono avere al massimo ${CAR_NOTE_MAX} caratteri.`,
    }
    return tx(locale, { en: en[field], es: esText[field], it: itText[field], ar: arText[field] })
  }
  return <form className="contact-form" onSubmit={onSubmit} noValidate>
    {summary !== '' && <p className="co-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px' }}><CircleAlert size={15} />{summary}</p>}
    <div className="form-grid">
      <label className="full" htmlFor="car-vehicle">{tx(locale, { en: 'Vehicle', es: 'Vehículo', it: 'Veicolo', ar: 'السيارة' })} <em className="req" aria-hidden="true">*</em><SharedSelect id="car-vehicle" value={values.vehicleSlug} onChange={(next) => onChange({ vehicleSlug: next })} locale={locale} invalid={Boolean(errors.vehicle)} describedBy={errors.vehicle ? 'car-vehicle-error' : undefined} options={[{ value: '', label: tx(locale, { en: 'Select a vehicle', es: 'Selecciona un vehículo', it: 'Seleziona un veicolo', ar: 'اختر السيارة' }) }, ...liveCars.map((c) => ({ value: c.slug, label: `${c.title} (${formatPrice(c.dailyPrice, currency, locale)}${tx(locale, { en: ' / day', es: ' / día', it: ' / giorno', ar: ' / يوم' })})` }))]} />{errors.vehicle && <span className="field-error" id="car-vehicle-error" role="alert">{errText('vehicle')}</span>}</label>
      <div className="full req-trip-type"><span id="req-trip-label">{tx(locale, { en: 'Trip type', es: 'Tipo de viaje', it: 'Tipo di viaggio', ar: 'نوع الرحلة' })} <em className="req" aria-hidden="true">*</em></span><div role="radiogroup" aria-labelledby="req-trip-label" aria-describedby={errors.tripType ? 'car-triptype-error' : undefined}>{(['One Way', 'Round Trip'] as const).map((opt) => <button key={opt} type="button" role="radio" aria-checked={values.tripType === opt} className={values.tripType === opt ? 'active' : ''} onClick={() => onChange({ tripType: values.tripType === opt ? '' : opt })}>{opt === 'One Way' ? (tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })) : (tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' }))}</button>)}</div>{errors.tripType && <span className="field-error" id="car-triptype-error" role="alert">{errText('tripType')}</span>}</div>
      <label className="full" htmlFor="car-pickup">{tx(locale, { en: 'Pick-up location', es: 'Lugar de recogida', it: 'Luogo di ritiro', ar: 'مكان الاستلام' })} <em className="req" aria-hidden="true">*</em><input id="car-pickup" required placeholder={tx(locale, { en: 'Airport, hotel, or city', es: 'Aeropuerto, hotel o ciudad', it: 'Aeroporto, hotel o città', ar: 'المطار أو الفندق أو المدينة' })} maxLength={CAR_LOCATION_MAX} value={values.pickup} onChange={(e) => onChange({ pickup: e.target.value })} aria-invalid={Boolean(errors.pickup)} aria-describedby={errors.pickup ? 'car-pickup-error' : undefined} />{errors.pickup && <span className="field-error" id="car-pickup-error" role="alert">{errText('pickup')}</span>}</label>
      <label className="full" htmlFor="car-dropoff">{tx(locale, { en: 'Drop-off location', es: 'Lugar de entrega', it: 'Luogo di riconsegna', ar: 'مكان الوصول' })} <em className="req" aria-hidden="true">*</em><input id="car-dropoff" required placeholder={tx(locale, { en: 'Where are you going?', es: '¿A dónde vas?', it: 'Dove sei diretto?', ar: 'إلى أين تريد الذهاب؟' })} maxLength={CAR_LOCATION_MAX} value={values.dropoff} onChange={(e) => onChange({ dropoff: e.target.value })} aria-invalid={Boolean(errors.dropoff)} aria-describedby={errors.dropoff ? 'car-dropoff-error' : undefined} />{errors.dropoff && <span className="field-error" id="car-dropoff-error" role="alert">{errText('dropoff')}</span>}</label>
      <label htmlFor="car-pickup-date">{tx(locale, { en: 'Preferred pick-up date', es: 'Fecha de recogida preferida', it: 'Data di ritiro preferita', ar: 'تاريخ الاستلام المفضل' })} <em className="req" aria-hidden="true">*</em><DateInput id="car-pickup-date" required min={today} dir="ltr" value={values.pickupDate} onChange={(e) => onChange({ pickupDate: e.target.value })} aria-invalid={Boolean(errors.pickupDate)} aria-describedby={errors.pickupDate ? 'car-pickup-date-error' : undefined} />{errors.pickupDate && <span className="field-error" id="car-pickup-date-error" role="alert">{errText('pickupDate')}</span>}</label>
      {values.tripType === 'Round Trip'
        ? <label htmlFor="car-return-date">{tx(locale, { en: 'Preferred return date', es: 'Fecha de regreso preferida', it: 'Data di ritorno preferita', ar: 'تاريخ العودة المفضل' })} <em className="req" aria-hidden="true">*</em><DateInput id="car-return-date" required min={values.pickupDate || today} dir="ltr" value={values.returnDate} onChange={(e) => onChange({ returnDate: e.target.value })} aria-invalid={Boolean(errors.returnDate)} aria-describedby={errors.returnDate ? 'car-return-date-error' : undefined} />{errors.returnDate && <span className="field-error" id="car-return-date-error" role="alert">{errText('returnDate')}</span>}</label>
        : <label htmlFor="car-passengers">{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'عدد الركاب' })} <em className="req" aria-hidden="true">*</em><input id="car-passengers" required type="number" min="1" max="50" placeholder="2" dir="ltr" value={values.passengers} onChange={(e) => onChange({ passengers: e.target.value })} aria-invalid={Boolean(errors.passengers)} aria-describedby={errors.passengers ? 'car-passengers-error' : undefined} />{errors.passengers && <span className="field-error" id="car-passengers-error" role="alert">{errText('passengers')}</span>}</label>}
      {values.tripType === 'Round Trip' && <label className="full" htmlFor="car-passengers-rt">{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'عدد الركاب' })} <em className="req" aria-hidden="true">*</em><input id="car-passengers-rt" required type="number" min="1" max="50" placeholder="2" dir="ltr" value={values.passengers} onChange={(e) => onChange({ passengers: e.target.value })} aria-invalid={Boolean(errors.passengers)} aria-describedby={errors.passengers ? 'car-passengers-error' : undefined} />{errors.passengers && <span className="field-error" id="car-passengers-error" role="alert">{errText('passengers')}</span>}</label>}
      <label className="full" htmlFor="car-name">{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })} <em className="req" aria-hidden="true">*</em><input id="car-name" required placeholder={tx(locale, { en: 'Your full name', es: 'Tu nombre completo', it: 'Il tuo nome completo', ar: 'اكتب اسمك الكامل' })} maxLength={80} autoComplete="name" value={values.fullName} onChange={(e) => onChange({ fullName: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'car-name-error' : undefined} />{errors.name && <span className="field-error" id="car-name-error" role="alert">{errText('name')}</span>}</label>
      <label htmlFor="car-email">{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })} <em className="req" aria-hidden="true">*</em><input id="car-email" required type="email" placeholder="you@example.com" maxLength={120} autoComplete="email" dir="ltr" value={values.email} onChange={(e) => onChange({ email: e.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'car-email-error' : undefined} />{errors.email && <span className="field-error" id="car-email-error" role="alert">{errText('email')}</span>}</label>
      <label htmlFor="car-phone">{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })} <em className="req" aria-hidden="true">*</em><InternationalPhoneInput id="car-phone" required value={values.phone} onChange={(phone) => onChange({ phone })} locale={locale} invalid={Boolean(errors.phone)} describedBy={errors.phone ? 'car-phone-error' : undefined} />{errors.phone && <span className="field-error" id="car-phone-error" role="alert">{errText('phone')}</span>}</label>
      <label className="full" htmlFor="car-notes">{tx(locale, { en: 'Notes (optional)', es: 'Notas (opcional)', it: 'Note (facoltativo)', ar: 'ملاحظات (اختياري)' })}<textarea id="car-notes" placeholder={tx(locale, { en: 'Tell us about your route', es: 'Cuéntanos tu ruta', it: 'Raccontaci il tuo itinerario', ar: 'حدثنا عن خط سيرك' })} maxLength={CAR_NOTE_MAX + 1} value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'car-notes-error' : 'car-notes-hint'} />{errors.notes && <span className="field-error" id="car-notes-error" role="alert">{errText('notes')}</span>}<small id="car-notes-hint" style={{ color: 'var(--muted)', fontWeight: 500 }}>{values.notes.length}/{CAR_NOTE_MAX}</small></label>
    </div>
    <button className="primary-btn" type="submit" disabled={submitting}>{submitting ? (tx(locale, { en: 'Submitting…', es: 'Enviando…', it: 'Invio…', ar: 'جارٍ الإرسال…' })) : editing ? (tx(locale, { en: 'Save changes', es: 'Guardar cambios', it: 'Salva modifiche', ar: 'حفظ التعديلات' })) : (tx(locale, { en: 'Submit request', es: 'Enviar solicitud', it: 'Invia richiesta', ar: 'إرسال الطلب' }))} <ArrowRight size={17} /></button>
  </form>
}

export function CarRequestPage() {
  return <SiteShell><Suspense><CarRequestContent /></Suspense></SiteShell>
}

function CarRequestContent() {
  const brand = useBrandSettings()
  const params = useSearchParams()
  const initial = parseCarRequestQuery(params)
  const rawVehicleSlug = (() => {
    const raw = (params.get('vehicle') ?? '').trim().slice(0, 80)
    return /^[a-z0-9-]{1,80}$/.test(raw) ? raw : ''
  })()
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const { user: sessionUser } = useCurrentUser()
  const liveCars = useLiveCollection('cars', cars)
  const [values, setValues] = useState<CarRequestValues>({ vehicleSlug: initial.vehicle?.slug ?? rawVehicleSlug, tripType: initial.tripType ?? '', pickup: initial.pickup, dropoff: initial.dropoff, pickupDate: initial.date, returnDate: '', passengers: '', fullName: '', email: '', phone: '', notes: '' })
  const [placed, setPlaced] = useState<CarRequest | null>(null)
  const [editingRef, setEditingRef] = useState<string | null>(null)
  const [errors, setErrors] = useState<CarFieldErrors>({})
  const [summary, setSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const patch = (p: Partial<CarRequestValues>) => setValues((v) => ({ ...v, ...p }))
  const vehicle = liveCars.find((car) => car.slug === values.vehicleSlug)
  const step = placed ? 3 : vehicle ? 2 : 1
  const notSet = tx(locale, { en: 'Not set', es: 'Sin definir', it: 'Non definito', ar: 'لم يحدد' })
  const tripLabel = values.tripType === '' ? notSet : values.tripType === 'One Way' ? (tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })) : (tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' }))
  const steps = [tx(locale, { en: 'Choose vehicle', es: 'Elige el vehículo', it: 'Scegli il veicolo', ar: 'اختيار السيارة' }), tx(locale, { en: 'Trip details', es: 'Detalles del viaje', it: 'Dettagli del viaggio', ar: 'تفاصيل الرحلة' }), tx(locale, { en: 'Submitted', es: 'Enviada', it: 'Inviata', ar: 'تم الإرسال' })]
  const hasQuerySignal = Boolean(initial.vehicle || rawVehicleSlug || initial.pickup || initial.dropoff || initial.date || initial.tripType)
  const editParam = (() => {
    const raw = (params.get('edit') ?? '').trim()
    return isCarReference(raw) ? raw : null
  })()

  // Prefill contact details from the signed-in account as editable copies.
  useEffect(() => {
    if (!sessionUser) return
    setValues((v) => {
      const name = `${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim()
      return {
        ...v,
        fullName: v.fullName || name,
        email: v.email || sessionUser.email || '',
        phone: v.phone || sessionUser.phone || '',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser])

  // Edit mode: `?edit=SP-CR-…` loads the customer's own record for editing.
  // The query is read once; a foreign or missing record fails honestly.
  useEffect(() => {
    if (!editParam || hasQuerySignal) return
    let cancelled = false
    fetch(`/api/account/car-requests/${encodeURIComponent(editParam)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        const data = (await res.json()) as CarRequest & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Car request not found.')
        if (data.status !== 'new' && data.status !== 'reviewing') {
          throw new Error(tx(locale, { en: 'This request can no longer be edited.', es: 'Esta solicitud ya no se puede editar.', it: 'Questa richiesta non può più essere modificata.', ar: 'هذا الطلب لم يعد قابلًا للتعديل.' }))
        }
        const shaped = sanitizeCarDraft({
          vehicleSlug: data.vehicleSlug,
          tripType: data.tripType,
          pickup: data.pickup,
          dropoff: data.dropoff,
          preferredPickupDate: data.preferredPickupDate,
          preferredReturnDate: data.preferredReturnDate,
          passengers: data.passengers,
          notes: data.notes,
          contact: { fullName: data.contact.name, email: data.contact.email, phone: data.contact.phone },
          currency,
        })
        if (!shaped || cancelled) return
        setValues({
          vehicleSlug: shaped.vehicleSlug,
          tripType: shaped.tripType,
          pickup: shaped.pickup,
          dropoff: shaped.dropoff,
          pickupDate: shaped.preferredPickupDate,
          returnDate: shaped.preferredReturnDate,
          passengers: String(shaped.passengers),
          fullName: shaped.contact.fullName,
          email: shaped.contact.email,
          phone: shaped.contact.phone,
          notes: shaped.notes,
        })
        setEditingRef(data.reference)
      })
      .catch((error: unknown) => {
        if (!cancelled) setSummary(error instanceof Error ? error.message : 'Car request not found.')
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildDraft = (): CarRequestDraft => {
    const pax = values.passengers.trim()
    return {
      vehicleSlug: values.vehicleSlug,
      tripType: values.tripType,
      pickup: values.pickup.trim(),
      dropoff: values.dropoff.trim(),
      preferredPickupDate: values.pickupDate,
      preferredReturnDate: values.tripType === 'Round Trip' ? values.returnDate : '',
      passengers: pax === '' ? Number.NaN : Number(pax),
      notes: values.notes.trim().slice(0, CAR_NOTE_MAX + 1),
      contact: { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim() },
      currency,
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const raw = buildDraft()
    const errs = validateCarRequest(raw)
    if (!vehicle) errs.vehicle = 'invalid'
    setErrors(errs)
    if (hasCarErrors(errs)) {
      setSummary(tx(locale, { en: 'Could not submit the request. Review the highlighted fields below.', es: 'No se pudo enviar la solicitud. Revisa los campos marcados abajo.', it: 'Impossibile inviare la richiesta. Controlla i campi evidenziati qui sotto.', ar: 'تعذر إرسال الطلب. راجع الحقول الموضحة أدناه.' }))
      const ids: Record<keyof CarFieldErrors, string> = { vehicle: 'car-vehicle', tripType: 'req-trip-label', pickup: 'car-pickup', dropoff: 'car-dropoff', pickupDate: 'car-pickup-date', returnDate: 'car-return-date', passengers: values.tripType === 'Round Trip' ? 'car-passengers-rt' : 'car-passengers', name: 'car-name', email: 'car-email', phone: 'car-phone', notes: 'car-notes' }
      const order: Array<keyof CarFieldErrors> = ['vehicle', 'tripType', 'pickup', 'dropoff', 'pickupDate', 'returnDate', 'passengers', 'name', 'email', 'phone', 'notes']
      for (const field of order) {
        if (errs[field]) {
          focusCarField(ids[field])
          break
        }
      }
      return
    }
    const preview = { ...raw, notes: raw.notes.slice(0, CAR_NOTE_MAX) }
    setSubmitting(true)
    const url = editingRef
      ? `/api/account/car-requests/${encodeURIComponent(editingRef)}`
      : '/api/car-requests'
    fetch(url, {
      method: editingRef ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(editingRef ? { action: 'update', draft: preview } : preview),
    })
      .then(async (res) => {
        const data = (await res.json()) as CarRequest & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not submit the request.')
        setErrors({})
        setSummary('')
        setEditingRef(null)
        setPlaced(data)
        window.setTimeout(() => focusCarField('car-preview-title'), 50)
      })
      .catch((error: unknown) => {
        setSummary(error instanceof Error ? error.message : (tx(locale, { en: 'Could not submit the request. Please try again.', es: 'No se pudo enviar la solicitud. Inténtalo de nuevo.', it: 'Impossibile inviare la richiesta. Riprova.', ar: 'تعذر إرسال الطلب. حاول مجددًا.' })))
      })
      .finally(() => setSubmitting(false))
  }

  const handleEdit = () => {
    setPlaced(null)
    window.setTimeout(() => focusCarField('car-vehicle'), 50)
  }

  const renderPreview = (record: CarRequest) => {
    const d = {
      vehicleSlug: record.vehicleSlug,
      tripType: record.tripType,
      pickup: record.pickup,
      dropoff: record.dropoff,
      preferredPickupDate: record.preferredPickupDate,
      preferredReturnDate: record.preferredReturnDate,
      passengers: record.passengers,
      notes: record.notes,
      contact: { fullName: record.contact.name, email: record.contact.email, phone: record.contact.phone },
    }
    const previewCar = liveCars.find((car) => car.slug === d.vehicleSlug)
    const dateRows = d.tripType === 'Round Trip' && d.preferredReturnDate !== ''
      ? [{ label: tx(locale, { en: 'Preferred return date', es: 'Fecha de regreso preferida', it: 'Data di ritorno preferita', ar: 'تاريخ العودة المفضل' }), value: d.preferredReturnDate, ltr: true }]
      : []
    return <div className="form-success large">
      <Check size={42} />
      <h1 id="car-preview-title" tabIndex={-1}>{tx(locale, { en: 'Car request submitted', es: 'Solicitud de coche enviada', it: 'Richiesta auto inviata', ar: 'تم إرسال طلب السيارة' })}</h1>
      <span className="req-ref" dir="ltr">{tx(locale, { en: 'Reference: ', es: 'Referencia: ', it: 'Riferimento: ', ar: 'المرجع: ' })}{record.reference}</span>
      <div className="req-summary-rows" style={{ maxWidth: 520, margin: '18px auto', textAlign: 'start' }}>
        <div><span>{tx(locale, { en: 'Requested vehicle', es: 'Vehículo solicitado', it: 'Veicolo richiesto', ar: 'السيارة المطلوبة' })}</span><strong>{previewCar?.title ?? d.vehicleSlug}</strong></div>
        <div><span>{tx(locale, { en: 'Trip type', es: 'Tipo', it: 'Tipo', ar: 'النوع' })}</span><strong>{d.tripType === 'One Way' ? (tx(locale, { en: 'One Way', es: 'Solo ida', it: 'Solo andata', ar: 'ذهاب فقط' })) : d.tripType === 'Round Trip' ? (tx(locale, { en: 'Round Trip', es: 'Ida y vuelta', it: 'Andata e ritorno', ar: 'ذهاب وعودة' })) : notSet}</strong></div>
        <div><span>{tx(locale, { en: 'From', es: 'Desde', it: 'Da', ar: 'من' })}</span><strong>{d.pickup}</strong></div>
        <div><span>{tx(locale, { en: 'To', es: 'Hasta', it: 'A', ar: 'إلى' })}</span><strong>{d.dropoff}</strong></div>
        <div><span>{tx(locale, { en: 'Preferred pick-up date', es: 'Fecha de recogida preferida', it: 'Data di ritiro preferita', ar: 'تاريخ الاستلام المفضل' })}</span><strong dir="ltr">{d.preferredPickupDate}</strong></div>
        {dateRows.map((row) => <div key={row.label}><span>{row.label}</span><strong dir="ltr">{row.value}</strong></div>)}
        <div><span>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'الركاب' })}</span><strong>{d.passengers}</strong></div>
        <div><span>{tx(locale, { en: 'Full name', es: 'Nombre completo', it: 'Nome completo', ar: 'الاسم الكامل' })}</span><strong>{d.contact.fullName}</strong></div>
        <div><span>{tx(locale, { en: 'Email', es: 'Correo electrónico', it: 'Email', ar: 'البريد الإلكتروني' })}</span><strong dir="ltr">{d.contact.email}</strong></div>
        <div><span>{tx(locale, { en: 'Phone', es: 'Teléfono', it: 'Telefono', ar: 'رقم الهاتف' })}</span><strong dir="ltr">{d.contact.phone}</strong></div>
        {d.notes !== '' && <div><span>{tx(locale, { en: 'Notes', es: 'Notas', it: 'Note', ar: 'ملاحظات' })}</span><strong style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</strong></div>}
      </div>
      <p><CircleAlert size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{tx(locale, { en: 'We have received your request and our team will review it. Keep the reference above.', es: 'Hemos recibido tu solicitud y nuestro equipo la revisará. Guarda la referencia de arriba.', it: 'Abbiamo ricevuto la tua richiesta e il nostro team la esaminerà. Conserva il riferimento qui sopra.', ar: 'استلمنا طلبك وسيراجعه فريقنا. احتفظ بالمرجع أعلاه.' })}</p>
      <p>{tx(locale, { en: 'No vehicle has been reserved, no availability was checked, and no rate was confirmed.', es: 'No se ha reservado ningún vehículo, no se ha comprobado disponibilidad ni se ha confirmado ninguna tarifa.', it: 'Nessun veicolo è stato prenotato, nessuna disponibilità è stata verificata e nessuna tariffa è stata confermata.', ar: 'لم يتم حجز أي سيارة ولم يتم التحقق من التوافر أو تأكيد أي سعر.' })}</p>
      <div className="car-success-actions">
        {sessionUser
          ? <><button type="button" className="outline-btn" onClick={handleEdit}>{tx(locale, { en: 'Edit request', es: 'Editar solicitud', it: 'Modifica richiesta', ar: 'تعديل الطلب' })}</button>
            <Link className="primary-btn" href={`/account/car-requests/detail?ref=${encodeURIComponent(record.reference)}`}>{tx(locale, { en: 'View request details', es: 'Ver detalles de la solicitud', it: 'Vedi dettagli richiesta', ar: 'عرض تفاصيل الطلب' })}</Link></>
          : <><Link className="primary-btn" href="/register">{tx(locale, { en: 'Create an account to track my requests', es: 'Crea una cuenta para seguir tus solicitudes', it: 'Crea un account per seguire le tue richieste', ar: 'إنشاء حساب لمتابعة طلباتي' })}</Link>
            <Link className="outline-btn" href={`/login?next=${encodeURIComponent('/account/car-requests')}`}>{tx(locale, { en: 'Sign in', es: 'Iniciar sesión', it: 'Accedi', ar: 'تسجيل الدخول' })}</Link></>}
        <Link className="outline-btn" href="/contact">{tx(locale, { en: 'Contact our team', es: 'Contacta con nuestro equipo', it: 'Contatta il nostro team', ar: 'تواصل مع فريقنا' })}</Link>
      </div>
    </div>
  }

  return <>
    <Breadcrumb items={[tx(locale, { en: 'Rent Car', es: 'Alquiler de coches', it: 'Noleggio auto', ar: 'تأجير السيارات' }), tx(locale, { en: 'Request a vehicle', es: 'Solicitar un vehículo', it: 'Richiedi un veicolo', ar: 'طلب سيارة' })]} />
    <main className="container car-request-page">
      <header className="car-request-head">
        <span className="eyebrow">{tx(locale, { en: 'Private transport', es: 'Transporte privado', it: 'Trasporto privato', ar: 'نقل خاص' })}</span>
        <h1>{tx(locale, { en: 'Tell us how you want to move.', es: 'Cuéntanos cómo quieres moverte.', it: 'Dicci come vuoi muoverti.', ar: 'أخبرنا كيف تريد التنقل.' })}</h1>
        <p>{tx(locale, { en: 'Fill in your request details and our team will review your request and contact you.', es: 'Completa los detalles de tu solicitud y nuestro equipo la revisará y te contactará.', it: 'Compila i dettagli della richiesta: il nostro team la esaminerà e ti contatterà.', ar: 'املأ تفاصيل طلبك وسيراجع فريقنا طلبك وسيتواصل معك.' })}</p>
      </header>
      <ol className="stepper req-stepper" aria-label={tx(locale, { en: 'Vehicle request progress', es: 'Progreso de la solicitud', it: 'Avanzamento richiesta', ar: 'مراحل طلب السيارة' })}>
        {steps.map((label, i) => {
          const state = step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'todo'
          const isDone = step > i + 1
          return <li key={label}>
            {i > 0 && <span className={`step-line${step > i ? ' done' : ''}`} aria-hidden="true" />}
            <span className={`step-pill ${state}`} aria-current={step === i + 1 ? 'step' : undefined}>
              <b className="step-num">{isDone ? <Check size={18} /> : i + 1}</b>
              {label}
            </span>
          </li>
        })}
      </ol>
      {placed
        ? renderPreview(placed)
        : <div className="car-request-layout">
          <aside className="car-summary-card" aria-label={tx(locale, { en: 'Request summary', es: 'Resumen de la solicitud', it: 'Riepilogo richiesta', ar: 'ملخص الطلب' })}>
            <div>
              <span className="eyebrow">{tx(locale, { en: 'Your summary', es: 'Tu resumen', it: 'Il tuo riepilogo', ar: 'ملخص طلبك' })}</span>
              {vehicle
                ? <div className="req-vehicle-mini"><img src={vehicle.image} alt={vehicle.title} /><div><strong>{vehicle.title}</strong><span>{formatPrice(vehicle.dailyPrice, currency, locale)}{tx(locale, { en: ' / day', es: ' / día', it: ' / giorno', ar: ' / يوم' })}</span></div></div>
                : <p className="req-novehicle">{tx(locale, { en: 'Select a vehicle in the form to see your summary here.', es: 'Selecciona un vehículo en el formulario para ver tu resumen aquí.', it: 'Seleziona un veicolo nel modulo per vedere qui il riepilogo.', ar: 'اختر السيارة من النموذج ليظهر ملخصك هنا.' })}</p>}
              <div className="req-summary-rows">
                <div><span>{tx(locale, { en: 'Trip type', es: 'Tipo', it: 'Tipo', ar: 'النوع' })}</span><strong>{tripLabel}</strong></div>
                <div><span>{tx(locale, { en: 'From', es: 'Desde', it: 'Da', ar: 'من' })}</span><strong>{values.pickup || notSet}</strong></div>
                <div><span>{tx(locale, { en: 'To', es: 'Hasta', it: 'A', ar: 'إلى' })}</span><strong>{values.dropoff || notSet}</strong></div>
                <div><span>{tx(locale, { en: 'Preferred pick-up date', es: 'Fecha de recogida preferida', it: 'Data di ritiro preferita', ar: 'تاريخ الاستلام المفضل' })}</span><strong dir="ltr">{values.pickupDate || notSet}</strong></div>
                {values.tripType === 'Round Trip' && <div><span>{tx(locale, { en: 'Preferred return date', es: 'Fecha de regreso preferida', it: 'Data di ritorno preferita', ar: 'تاريخ العودة المفضل' })}</span><strong dir="ltr">{values.returnDate || notSet}</strong></div>}
                <div><span>{tx(locale, { en: 'Passengers', es: 'Pasajeros', it: 'Passeggeri', ar: 'الركاب' })}</span><strong>{values.passengers || notSet}</strong></div>
              </div>
              <p><ShieldCheck size={15} />{tx(locale, { en: 'Private driver and A/C included', es: 'Conductor privado y aire acondicionado incluidos', it: 'Autista privato e aria condizionata inclusi', ar: 'شامل سائق خاص وتكييف' })}</p>
              <a className="req-wa" href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer">{tx(locale, { en: 'Chat on WhatsApp', es: 'Hablar por WhatsApp', it: 'Chat su WhatsApp', ar: 'تواصل عبر واتساب' })}</a>
            </div>
          </aside>
          <div className="car-form-card"><CarRequestForm values={values} errors={errors} summary={summary} submitting={submitting} editing={editingRef !== null} onChange={patch} onSubmit={handleSubmit} /></div>
        </div>}
    </main>
  </>
}

export function DestinationsPage() { const { locale } = useLocale(); const ar = locale === 'ar'; const liveDestinations = useLiveDestinations(destinations).filter((d) => d.showInDestinations !== false && d.isPublished !== false); return <SiteShell><EditorialHero eyebrow={tx(locale, { en: 'See the full picture', es: 'Mira el panorama completo', it: 'Guarda il quadro completo', ar: 'الصورة الكاملة' })} title={tx(locale, { en: 'Every destination tells a different Egypt story', es: 'Cada destino cuenta una historia distinta de Egipto', it: 'Ogni destinazione racconta una storia diversa dell\'Egitto', ar: 'كل وجهة تحكي قصة مختلفة عن مصر' })} copy={tx(locale, { en: 'Build a trip around the places that make you curious, from ancient capitals to salt-white deserts and coral-blue seas.', es: 'Crea un viaje en torno a los lugares que despierten tu curiosidad, desde capitales antiguas hasta desiertos blancos y mares de coral.', it: 'Costruisci un viaggio intorno ai luoghi che accendono la tua curiosità, dalle antiche capitali ai deserti bianchi e ai mari corallini.', ar: 'ابنِ رحلتك حول الأماكن التي تثير فضولك، من العواصم القديمة للصحارى البيضاء والشواطئ المرجانية.' })} image={siteImages.desert} href="/make-your-trip" action={tx(locale, { en: 'Build my route', es: 'Crea mi ruta', it: 'Crea il mio itinerario', ar: 'ابنِ خط سيرك' })}/><main className="section container"><div className="destination-large-grid">{liveDestinations.map(item=><article className="destination-large" key={item.slug}><img src={item.image} alt={item.title}/><div><span className="eyebrow">{tx(locale, { en: 'Discover Egypt', es: 'Descubre Egipto', it: 'Scopri l\'Egitto', ar: 'اكتشف مصر' })}</span><h2>{item.title}</h2><p>{item.copy}</p><Link href={`/destinations/${item.slug}`} className="text-link">{tx(locale, { en: 'Explore destination', es: 'Descubre el destino', it: 'Scopri la destinazione', ar: 'استكشف الوجهة' })} <ArrowRight size={15}/></Link></div></article>)}</div></main></SiteShell> }

const destinationFactIcons = [Clock3, Sun, Compass, MapPin]

export function DestinationDetailPage({ slug }: { slug: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveItem = useLiveFind('destinations', destinations, slug)
  const item = liveItem && liveItem.isPublished !== false ? liveItem : undefined
  if (!item) return <DetailNotFound title={tx(locale, { en: 'Destination not found', es: 'Destino no encontrado', it: 'Destinazione non trovata', ar: 'الوجهة غير موجودة' })} copy={tx(locale, { en: 'The destination you were looking for has taken a different route.', es: 'El destino que buscabas ha tomado otro camino.', it: 'La destinazione che cercavi ha preso un\'altra strada.', ar: 'الوجهة التي تبحث عنها سلكت طريقًا آخر.' })} backHref="/destinations" backLabel={tx(locale, { en: 'Explore destinations', es: 'Descubre los destinos', it: 'Scopri le destinazioni', ar: 'استكشف الوجهات' })}/>
  const detail = item.detail
  const relatedTours = detail.tourSlugs.map(findTour).filter((tour): tour is Tour => Boolean(tour))

  return <SiteShell>
    <main className="destination-detail-page">
      <section className="destination-detail-hero">
        <img src={detail.heroImage} alt={detail.heroAlt}/>
        <div className="destination-detail-shade"/>
        <div className="container destination-detail-hero-content">
          <nav aria-label={tx(locale, { en: 'Breadcrumb', es: 'Ruta de navegación', it: 'Percorso di navigazione', ar: 'مسار التنقل' })}><Link href="/destinations">{tx(locale, { en: 'Destinations', es: 'Destinos', it: 'Destinazioni', ar: 'الوجهات' })}</Link><span>/</span><span aria-current="page">{item.title}</span></nav>
          <span className="eyebrow">{detail.eyebrow}</span>
          <h1>{item.title}</h1>
          <p>{item.copy}</p>
          <div className="destination-hero-actions">
            <Link href="/make-your-trip" className="primary-btn">{tx(locale, { en: 'Plan this destination', es: 'Planifica este destino', it: 'Pianifica questa destinazione', ar: 'خطط لهذه الوجهة' })} <ArrowRight size={17}/></Link>
            <a href="#destination-experiences" className="destination-ghost-btn">{tx(locale, { en: 'See what awaits', es: 'Descubre lo que te espera', it: 'Scopri cosa ti aspetta', ar: 'اكتشف ما ينتظرك' })}</a>
          </div>
        </div>
      </section>

      <section className="destination-facts" aria-label={tx(locale, { en: `${item.title} at a glance`, es: `${item.title} en resumen`, it: `${item.title} in breve`, ar: `${item.title} باختصار` })}>
        <div className="container">
          {detail.facts.map((fact, index) => {
            const Icon = destinationFactIcons[index] || Compass
            return <div key={fact.label}><Icon size={21}/><span><small>{fact.label}</small><strong>{fact.value}</strong></span></div>
          })}
        </div>
      </section>

      <section className="destination-story container">
        <div>
          <span className="eyebrow">{tx(locale, { en: 'The destination story', es: 'La historia del destino', it: 'La storia della destinazione', ar: 'حكاية الوجهة' })}</span>
          <h2>{tx(locale, { en: 'Come for the icons. Stay for the rhythm.', es: 'Ven por los iconos. Quédate por el ritmo.', it: 'Vieni per le icone. Resta per il ritmo.', ar: 'تعالَ للأيقونات. وابقَ للإيقاع.' })}</h2>
          <p>{detail.intro}</p>
          <p>{tx(locale, { en: 'We shape each day around proximity, light, energy, and the moments that deserve more than a quick stop.', es: 'Diseñamos cada día en torno a la cercanía, la luz, la energía y los momentos que merecen más que una parada rápida.', it: 'Modelliamo ogni giornata su vicinanza, luce, energia e momenti che meritano più di una sosta veloce.', ar: 'نصمم كل يوم حول القرب والإضاءة والطاقة واللحظات التي تستحق أكثر من وقفة سريعة.' })}</p>
        </div>
        <aside>
          <span className="eyebrow">{tx(locale, { en: 'Especially good for', es: 'Ideal para', it: 'Ideale per', ar: 'مناسبة بشكل خاص لـ' })}</span>
          <div>{detail.bestFor.map((item) => <span key={item}><Check size={15}/>{item}</span>)}</div>
        </aside>
      </section>

      <section id="destination-experiences" className="destination-experiences">
        <div className="container">
          <header className="destination-section-head"><div><span className="eyebrow">{tx(locale, { en: 'Signature experiences', es: 'Experiencias emblemáticas', it: 'Esperienze imperdibili', ar: 'تجارب مميزة' })}</span><h2>{tx(locale, { en: 'The moments that define', es: 'Los momentos que definen', it: 'I momenti che definiscono', ar: 'اللحظات التي تميز' })} {item.title}.</h2></div><p>{tx(locale, { en: 'Not a checklist. A considered mix of landmarks, local texture, and enough space to actually feel the place.', es: 'No es una lista de tareas: es una mezcla cuidada de monumentos, ambiente local y espacio suficiente para sentir de verdad el lugar.', it: 'Non una lista di cose da spuntare, ma un mix studiato di monumenti, atmosfera locale e spazio per vivere davvero il luogo.', ar: 'ليست قائمة مهام، بل مزيج مدروس من المعالم والروح المحلية ومساحة كافية لتشعر بالمكان فعلًا.' })}</p></header>
          <div className="destination-experience-grid">
            {detail.experiences.map((experience, index) => <article key={experience.title} className={index === 0 ? 'featured' : ''}>
              <img src={experience.image} alt={experience.alt} loading="lazy"/>
              <div><span>0{index + 1}</span><h3>{experience.title}</h3><p>{experience.copy}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="destination-rhythm container">
<div className="destination-rhythm-image"><img src={detail.heroImage} alt={tx(locale, { en: `A memorable view of ${item.title}`, es: `Una vista inolvidable de ${item.title}`, it: `Una vista memorabile di ${item.title}`, ar: `منظر لا يُنسى من ${item.title}` })} loading="lazy"/><span>{tx(locale, { en: 'Suggested rhythm', es: 'Ritmo sugerido', it: 'Ritmo suggerito', ar: 'إيقاع مقترح' })}</span></div>
        <div className="destination-rhythm-copy">
          <span className="eyebrow">{tx(locale, { en: 'A route that breathes', es: 'Una ruta que respira', it: 'Un itinerario che respira', ar: 'خط سير يتنفس' })}</span>
          <h2>{tx(locale, { en: 'How to experience', es: 'Cómo vivir', it: 'Come vivere', ar: 'كيف تعيش' })} {item.title} {tx(locale, { en: 'without rushing it.', es: 'sin prisas.', it: 'senza fretta.', ar: 'دون استعجال.' })}</h2>
          <div className="destination-timeline">{detail.rhythm.map((step, index) => <article key={step.title}><b>0{index + 1}</b><div><small>{step.label}</small><h3>{step.title}</h3><p>{step.copy}</p></div></article>)}</div>
        </div>
      </section>

      <section className="destination-practical">
        <div className="container">
          <header><span className="eyebrow">{tx(locale, { en: 'Travel well', es: 'Viaja bien', it: 'Viaggia bene', ar: 'سافر بذكاء' })}</span><h2>{tx(locale, { en: 'Small choices. Better days.', es: 'Pequeñas decisiones. Días mejores.', it: 'Piccole scelte. Giorni migliori.', ar: 'خيارات صغيرة وأيام أجمل.' })}</h2></header>
          <div>{detail.practical.map((tip, index) => <article key={tip.title}><span>0{index + 1}</span><h3>{tip.title}</h3><p>{tip.copy}</p></article>)}</div>
        </div>
      </section>

      {relatedTours.length > 0 && <section className="destination-related container">
        <header className="destination-section-head"><div><span className="eyebrow">{tx(locale, { en: 'Travel with us', es: 'Viaja con nosotros', it: 'Viaggia con noi', ar: 'سافر معنا' })}</span><h2>{tx(locale, { en: 'Ways to experience', es: 'Formas de vivir', it: 'Modi per vivere', ar: 'طرق لتعيش بها' })} {item.title}.</h2></div><Link href="/egypt-tours/one-day-tours" className="text-link">{tx(locale, { en: 'View all tours', es: 'Ver todas las excursiones', it: 'Vedi tutti i tour', ar: 'شاهد كل الرحلات' })} <ArrowRight size={15}/></Link></header>
        <div className={`destination-tour-grid${relatedTours.length === 1 ? ' single' : ''}`}>{relatedTours.map((tour) => <TourCard key={tour.slug} tour={tour}/>)}</div>
      </section>}

      <section className="destination-plan-cta">
        <img src={item.image} alt="" loading="lazy"/>
        <div/>
        <div className="container"><span className="eyebrow">{tx(locale, { en: 'Your Egypt, thoughtfully arranged', es: 'Tu Egipto, organizado con esmero', it: 'Il tuo Egitto, organizzato con cura', ar: 'مصر بتنظيم مدروس' })}</span><h2>{tx(locale, { en: 'Make', es: 'Haz de', it: 'Fai di', ar: 'اجعل' })} {item.title} {tx(locale, { en: 'part of a journey built around you.', es: 'parte de un viaje creado a tu medida.', it: 'parte di un viaggio costruito intorno a te.', ar: 'جزءًا من رحلة مبنية حولك.' })}</h2><p>{tx(locale, { en: 'Share your dates, pace, and interests. Our local team will connect the details into one smooth itinerary.', es: 'Comparte tus fechas, tu ritmo y tus intereses. Nuestro equipo local unirá los detalles en un itinerario fluido.', it: 'Condividi date, ritmo e interessi: il nostro team locale collegherà i dettagli in un itinerario fluido.', ar: 'شاركنا مواعيدك وإيقاعك واهتماماتك، وسيربط فريقنا المحلي التفاصيل في برنامج واحد سلس.' })}</p><Link href="/make-your-trip" className="primary-btn">{tx(locale, { en: 'Build my trip', es: 'Crea mi viaje', it: 'Crea il mio viaggio', ar: 'ابنِ رحلتي' })} <ArrowRight size={17}/></Link></div>
      </section>
    </main>
  </SiteShell>
}

export function BlogsPage() { return <SiteShell><BlogsPageContent /></SiteShell> }

function BlogMagazineCard({ item }: { item: Blog }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const href = `/blogs/${item.slug}`
  const image = item.editorial?.heroImage ?? item.image
  const imageAlt = item.editorial?.heroAlt ?? item.title

  return <article className="blog-mag-card">
    <Link href={href} className="blog-mag-media" aria-label={item.title}>
      <img src={image} alt={imageAlt} loading="lazy"/>
      <span>{item.category}</span>
    </Link>
    <div className="blog-mag-copy">
      <div className="blog-mag-meta">
        <span><CalendarDays size={14}/>{item.date}</span>
        {item.editorial?.readTime && <span><Clock3 size={14}/>{item.editorial.readTime}</span>}
      </div>
      <h3><Link href={href}>{item.title}</Link></h3>
      <p>{item.excerpt}</p>
      <Link href={href} className="blog-mag-link">
        {tx(locale, { en: 'Read the story', es: 'Lee la historia', it: 'Leggi la storia', ar: 'اقرأ الدليل' })} <ArrowRight size={16}/>
      </Link>
    </div>
  </article>
}

function BlogsPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveBlogs = useLiveCollection('blogs', blogs)
  const featured = liveBlogs[0]
  const categories = new Set(liveBlogs.map((blog) => blog.category)).size
  if (!featured) return null
  return <main>
    <PageShowcaseHero image={featured.image} eyebrow={tx(locale, { en: 'Stories & inspiration', es: 'Historias e inspiración', it: 'Storie e ispirazione', ar: 'حكايات وإلهام' })} title={tx(locale, { en: 'Travel notes for curious Egypt explorers', es: 'Notas de viaje para exploradores curiosos de Egipto', it: 'Note di viaggio per curiosi esploratori dell\'Egitto', ar: 'ملاحظات سفر لعشاق مصر الفضوليين' })} intro={tx(locale, { en: 'Practical guides, local perspective, and the small details that help you travel with more confidence.', es: 'Guías prácticas, mirada local y los pequeños detalles que te ayudan a viajar con más confianza.', it: 'Guide pratiche, prospettiva locale e piccoli dettagli per viaggiare con più sicurezza.', ar: 'أدلة عملية ووجهة نظر محلية وتفاصيل صغيرة تساعدك تسافر بثقة أكبر.' })} primaryLabel={tx(locale, { en: 'Explore the stories', es: 'Descubre las historias', it: 'Scopri le storie', ar: 'استكشف القصص' })} primaryHref="#blog-stories" secondaryLabel={tx(locale, { en: 'Read the featured story', es: 'Lee la historia destacada', it: 'Leggi la storia in evidenza', ar: 'اقرأ القصة المميزة' })} secondaryHref={`/blogs/${featured.slug}`} railLabel={tx(locale, { en: 'Featured story', es: 'Historia destacada', it: 'Storia in evidenza', ar: 'قصة مميزة' })} railTitle={featured.title} railHref={`/blogs/${featured.slug}`} railMeta={[{ Icon: CalendarDays, label: featured.date }, { Icon: Compass, label: featured.category }]} statsLabel={tx(locale, { en: 'Journal summary', es: 'Resumen del blog', it: 'Riepilogo del diario', ar: 'ملخص المدونة' })} stats={[{ value: liveBlogs.length, label: tx(locale, { en: 'Stories & guides', es: 'Historias y guías', it: 'Storie e guide', ar: 'قصص وأدلة' }) }, { value: categories, label: tx(locale, { en: 'Story categories', es: 'Categorías', it: 'Categorie di storie', ar: 'تصنيفات' }) }]}/>
    <section id="blog-stories" className="blogs-editorial section container">
      <article className="blog-feature-story">
        <Link href={`/blogs/${featured.slug}`} className="blog-feature-media" aria-label={featured.title}>
          <img src={featured.editorial?.heroImage ?? featured.image} alt={featured.editorial?.heroAlt ?? featured.title}/>
          <span>{tx(locale, { en: 'Editor\'s pick', es: 'Selección del editor', it: 'Scelta del redattore', ar: 'اختيار المجلة' })}</span>
        </Link>
        <div className="blog-feature-copy">
          <span className="eyebrow">{tx(locale, { en: 'Featured story', es: 'Historia destacada', it: 'Storia in evidenza', ar: 'قصة مميزة' })}</span>
          <div className="blog-mag-meta">
            <span><Compass size={14}/>{featured.category}</span>
            <span><CalendarDays size={14}/>{featured.date}</span>
            {featured.editorial?.readTime && <span><Clock3 size={14}/>{featured.editorial.readTime}</span>}
          </div>
          <h2>{featured.title}</h2>
          <p>{featured.excerpt}</p>
          <Link href={`/blogs/${featured.slug}`} className="blog-feature-link">
            {tx(locale, { en: 'Read the full story', es: 'Lee la historia completa', it: 'Leggi la storia completa', ar: 'اقرأ القصة كاملة' })} <ArrowRight size={17}/>
          </Link>
        </div>
      </article>

      <header className="blog-index-head">
        <div>
          <span className="eyebrow">{tx(locale, { en: 'From the travel journal', es: 'De nuestro diario de viajes', it: 'Dal diario di viaggio', ar: 'من مجلة السفر' })}</span>
          <h2>{tx(locale, { en: 'Fresh perspectives for your next Egypt journey.', es: 'Nuevas perspectivas para tu próximo viaje a Egipto.', it: 'Nuove prospettive per il tuo prossimo viaggio in Egitto.', ar: 'أفكار جديدة لرحلتك القادمة في مصر.' })}</h2>
        </div>
        <p>{tx(locale, { en: `${Math.max(liveBlogs.length - 1, 0)} recent guides and stories`, es: `${Math.max(liveBlogs.length - 1, 0)} guías e historias recientes`, it: `${Math.max(liveBlogs.length - 1, 0)} guide e storie recenti`, ar: `${Math.max(liveBlogs.length - 1, 0)} أدلة وقصص حديثة` })}</p>
      </header>

      <div className="blog-magazine-grid">
        {liveBlogs.slice(1).map((item) => <BlogMagazineCard item={item} key={item.slug}/>) }
      </div>
    </section>
  </main>
}

const guideIconMap: Record<string, LucideIcon> = { Sun, Clock3, Compass, ShieldCheck, Ticket, Camera }

function GuideTipCard({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  const Icon = guideIconMap[icon] || Compass
  return <article><Icon size={24}/><h3>{title}</h3><p>{copy}</p></article>
}

function GuideSection({ section, tips }: { section: { id: string; number: string; eyebrow: string; heading: string; lede?: string; copy?: readonly string[]; list?: readonly string[]; image?: { src: string; alt: string; caption?: string }; reverse?: boolean }; tips?: readonly { icon: string; title: string; copy: string }[] }) {
  const hasImage = !!section.image
  const hasCopy = !!(section.copy && section.copy.length) || !!section.lede || !!(section.list && section.list.length)
  if (section.id === 'essentials' && tips && tips.length) {
    return <section id={section.id} className="guide-essentials">
      <div className="guide-heading"><span className="guide-section-number">{section.number}</span><div><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2></div></div>
      <div className="guide-tip-grid">{tips.map((tip) => <GuideTipCard key={tip.title} {...tip} />)}</div>
    </section>
  }
  if (hasImage && hasCopy) {
    return <section id={section.id} className={`guide-split${section.reverse ? ' guide-split-reverse' : ''}`}>
      {section.reverse ? <>
        <div className="guide-copy"><span className="guide-section-number">{section.number}</span><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2>{section.lede && <p className="guide-lede">{section.lede}</p>}{section.copy?.map((p, i) => <p key={i}>{p}</p>)}{section.list && <ul>{section.list.map((item, i) => <li key={i}><Check size={16}/>{item}</li>)}</ul>}</div>
        <div className="guide-image"><img src={section.image!.src} alt={section.image!.alt} loading="lazy"/>{section.image!.caption && <span>{section.image!.caption}</span>}</div>
      </> : <>
        <div className="guide-image"><img src={section.image!.src} alt={section.image!.alt} loading="lazy"/>{section.image!.caption && <span>{section.image!.caption}</span>}</div>
        <div className="guide-copy"><span className="guide-section-number">{section.number}</span><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2>{section.lede && <p className="guide-lede">{section.lede}</p>}{section.copy?.map((p, i) => <p key={i}>{p}</p>)}{section.list && <ul>{section.list.map((item, i) => <li key={i}><Check size={16}/>{item}</li>)}</ul>}</div>
      </>}
    </section>
  }
  if (hasImage && !hasCopy) {
    return <figure className="guide-wide-image"><img src={section.image!.src} alt={section.image!.alt} loading="lazy"/>{section.image!.caption && <figcaption>{section.image!.caption}</figcaption>}</figure>
  }
  return <section id={section.id} className="guide-intro">
    <span className="guide-section-number">{section.number}</span>
    <div><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2>{section.lede && <p className="guide-lede">{section.lede}</p>}{section.copy?.map((p, i) => <p key={i}>{p}</p>)}</div>
  </section>
}

export function BlogEditorialPage({ item }: { item: Blog }) {
  const editorial = item.editorial!
  const { currency, locale } = useLocale()
  const adAr = locale === 'ar'
  const related = useLiveCollection('blogs', blogs).filter((blog) => blog.slug !== item.slug).slice(0, 3)
  const heroImage = editorial.heroImage || item.image
  const heroAlt = editorial.heroAlt || item.title
  const [activeSection, setActiveSection] = useState<string>('')

  useEffect(() => {
    if (!editorial.sidebarLinks || !editorial.sidebarLinks.length) return
    const ids = editorial.sidebarLinks.map((l) => l.href.replace('#', ''))
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!targets.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [editorial.sidebarLinks])

  return <SiteShell>
    <div className="guide-breadcrumb"><div className="container"><Link href="/">{tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' })}</Link><span>›</span><Link href="/blogs">{tx(locale, { en: 'Blogs', es: 'Blog', it: 'Blog', ar: 'المدونة' })}</Link><span>›</span><strong>{item.title}</strong></div></div>
    <main className="guide-page">
      <header className="guide-hero">
        <img src={heroImage} alt={heroAlt} />
        <div className="guide-hero-shade" />
        <div className="container guide-hero-content">
          <div className="guide-meta"><span>{item.category}</span><span>{item.date}</span>{editorial.readTime && <span>{editorial.readTime}</span>}</div>
          <h1>{item.title}</h1>
          <p>{item.excerpt} {editorial.heroDescription}</p>
        </div>
      </header>

      {editorial.facts && editorial.facts.length > 0 && <section className="guide-facts" aria-label="At a glance">
        <div className="container guide-facts-inner">{editorial.facts.map(({ icon, label, value }) => {
          const Icon = guideIconMap[icon] || Compass
          return <div key={label}><Icon size={22} aria-hidden="true"/><span><small>{label}</small><strong>{value}</strong></span></div>
        })}</div>
      </section>}

      <div className="container guide-layout">
        <aside className="guide-sidebar">
          {editorial.sidebarLinks && editorial.sidebarLinks.length > 0 && <nav aria-label="In this guide"><strong>{tx(locale, { en: 'In this guide', es: 'En esta guía', it: 'In questa guida', ar: 'في هذا الدليل' })}</strong>{editorial.sidebarLinks.map((link) => <a key={link.href} href={link.href} className={activeSection === link.href.replace('#', '') ? 'active' : ''}>{link.label}</a>)}</nav>}
          {editorial.sidebarAction && <div className="guide-side-action"><span>{editorial.sidebarAction.label}</span><strong>{editorial.sidebarAction.heading}</strong><Link href={`/egypt-tours/${editorial.sidebarAction.tourSlug}`}>{tx(locale, { en: 'View the tour', es: 'Ver la excursión', it: 'Vedi il tour', ar: 'استعرض الرحلة' })} <ArrowRight size={15}/></Link></div>}
          <Link href="/make-your-trip" className="guide-ad-card">
            <img src="https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=800&q=80" alt={tx(locale, { en: 'Private Luxury Pyramids Tour', es: 'Viaje privado de lujo a las pirámides', it: 'Tour privato di lusso alle piramidi', ar: 'رحلة أهرامات فاخرة خاصة' })} className="guide-ad-card-img" loading="lazy" />
            <div className="guide-ad-card-overlay" />
            <div className="guide-ad-card-content">
              <span className="guide-ad-badge"><Star size={12} fill="currentColor" /> {tx(locale, { en: 'Special VIP Offer', es: 'Oferta VIP especial', it: 'Offerta VIP speciale', ar: 'عرض VIP مميز' })}</span>
              <h4>{tx(locale, { en: 'Tailor-Made Egypt Journey', es: 'Viaje a Egipto a medida', it: 'Viaggio in Egitto su misura', ar: 'رحلة مصر مصممة لك' })}</h4>
              <p>{tx(locale, { en: 'Skip the tourist lines with a licensed private Egyptologist & luxury vehicle.', es: 'Evita las colas de turistas con un egiptólogo privado acreditado y un vehículo de lujo.', it: 'Salta le file dei turisti con un egittologo privato abilitato e un veicolo di lusso.', ar: 'تخطى طوابير السياح مع مرشد خاص معتمد وسيارة فاخرة.' })}</p>
              <div className="guide-ad-price">
                <small>{tx(locale, { en: 'Special rate from', es: 'Tarifa especial desde', it: 'Tariffa speciale da', ar: 'سعر مميز يبدأ من' })}</small>
                <strong>{formatPrice(65, currency, locale)}</strong>
              </div>
              <div className="guide-ad-btn">
                {tx(locale, { en: 'Plan My VIP Trip', es: 'Planifica mi viaje VIP', it: 'Pianifica il mio viaggio VIP', ar: 'خطط لرحلة VIP' })} <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        </aside>

        <article className="guide-story">
          {editorial.sections?.map((section) => <GuideSection key={section.id} section={section} tips={editorial.tips} />)}

          {editorial.quote && <blockquote className="guide-quote"><span aria-hidden="true">{'\u201C'}</span><p>{editorial.quote}</p></blockquote>}

          {editorial.checklist && editorial.checklist.length > 0 && <section className="guide-checklist">
            <div><span className="guide-section-number">{String((editorial.sections?.length || 0) + 1).padStart(2, '0')}</span><span className="eyebrow">{tx(locale, { en: 'Before you go', es: 'Antes de viajar', it: 'Prima di partire', ar: 'قبل السفر' })}</span><h2>{tx(locale, { en: 'Your trip, simplified', es: 'Tu viaje, simplificado', it: 'Il tuo viaggio, semplificato', ar: 'رحلتك ببساطة' })}</h2></div>
            <ul>{editorial.checklist.map((item, i) => <li key={i}><Check size={17}/><span><strong>{item.title}</strong>{item.detail}</span></li>)}</ul>
          </section>}
        </article>
      </div>

      {editorial.cta && <section className="guide-cta">
        <img src={heroImage} alt={heroAlt} loading="lazy"/>
        <div className="guide-cta-shade"/>
        <div className="container guide-cta-content">
          <span>{editorial.cta.eyebrow}</span>
          <h2>{editorial.cta.heading}</h2>
          <p>{editorial.cta.copy}</p>
          <div>
            {editorial.cta.tourSlug && <Link href={`/egypt-tours/${editorial.cta.tourSlug}`} className="primary-btn">{editorial.cta.tourLabel || 'View the tour'} <ArrowRight size={17}/></Link>}
            <Link href="/make-your-trip" className="guide-cta-link">{editorial.cta.customLabel || 'Build my own trip'}</Link>
          </div>
        </div>
      </section>}

      <section className="container guide-related"><div className="guide-related-head"><div><span className="eyebrow">{tx(locale, { en: 'Keep exploring', es: 'Sigue explorando', it: 'Continua a esplorare', ar: 'واصل الاستكشاف' })}</span><h2>{tx(locale, { en: 'More stories from Egypt', es: 'Más historias de Egipto', it: 'Altre storie dall\'Egitto', ar: 'قصص أخرى من مصر' })}</h2></div><Link href="/blogs">{tx(locale, { en: 'All travel stories', es: 'Todas las historias de viaje', it: 'Tutte le storie di viaggio', ar: 'كل قصص السفر' })} <ArrowRight size={16}/></Link></div><div className="guide-related-grid">{related.map((blog) => <article key={blog.slug}><Link href={`/blogs/${blog.slug}`}><img src={blog.image} alt={blog.title} loading="lazy"/></Link><small>{blog.category}</small><h3><Link href={`/blogs/${blog.slug}`}>{blog.title}</Link></h3><p>{blog.excerpt}</p></article>)}</div></section>
    </main>
  </SiteShell>
}

export function BlogDetailPage({ slug }: { slug: string }) {
  const item = useLiveFind('blogs', blogs, slug)
  const { locale } = useLocale()
  const ar = locale === 'ar'
  if (!item) return <DetailNotFound title={tx(locale, { en: 'Story not found', es: 'Historia no encontrada', it: 'Storia non trovata', ar: 'القصة غير موجودة' })} copy={tx(locale, { en: 'The story you were looking for has taken a different route.', es: 'La historia que buscabas ha tomado otro camino.', it: 'La storia che cercavi ha preso un\'altra strada.', ar: 'القصة التي تبحث عنها سلكت طريقًا آخر.' })} backHref="/blogs" backLabel={tx(locale, { en: 'Read all stories', es: 'Lee todas las historias', it: 'Leggi tutte le storie', ar: 'اقرأ كل القصص' })}/>
  if (item.editorial) return <BlogEditorialPage item={item}/>
  return <SiteShell><Breadcrumb items={[tx(locale, { en: 'Blogs', es: 'Blog', it: 'Blog', ar: 'المدونة' }),item.title]}/><main className="article-page container"><div className="article-header"><span className="eyebrow">{item.category}, {item.date}</span><h1>{item.title}</h1><p>{item.excerpt}</p></div><img className="article-cover" src={item.image} alt={item.title}/><div className="article-body"><p>Egypt rewards travelers who look a little closer. The great landmarks are only the beginning; the real rhythm of a journey appears in the streets, the meals, the conversations, and the quiet spaces between one stop and the next.</p><h2>Make room for the unexpected</h2><p>Leave space in your itinerary for a second cup of tea, a local market, and the kind of discovery that never appears in a checklist. Our team can help you find that balance.</p><blockquote>Travel slowly enough to notice what makes a place itself.</blockquote><Link href="/make-your-trip" className="primary-btn">{tx(locale, { en: 'Use this inspiration', es: 'Usa esta inspiración', it: 'Usa questa ispirazione', ar: 'استلهم لرحلتك' })} <ArrowRight size={16}/></Link></div></main></SiteShell>
}

/** Legacy aliases now backed by the structured helpers in `@/lib/events`. */
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
      <p className="event-card-price">{eventPriceLabel(item, ar)}</p>
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
  const ar = locale === 'ar'
  const liveEvents = useLiveEvents(events)
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
    <section className="events-page-hero">
      <img src={featured ? eventImageSrc(featured.image) : EVENT_IMAGE_FALLBACK} alt="" onError={onEventImageError} />
      <div className="events-page-hero-shade" />
      <div className="container events-page-hero-content">
        <div className="events-page-hero-copy">
          <span className="eyebrow">{tx(locale, { en: 'Egypt events calendar', es: 'Calendario de eventos de Egipto', it: 'Calendario eventi dell\'Egitto', ar: 'أجندة فعاليات مصر' })}</span>
          <h1>{tx(locale, { en: 'Egypt events & seasonal journeys', es: 'Eventos y viajes de temporada en Egipto', it: 'Eventi e viaggi stagionali in Egitto', ar: 'فعاليات ورحلات موسمية تستحق السفر' })}</h1>
          <p>{tx(locale, { en: 'Celebrations, cultural escapes, and limited-time experiences shaped around Egypt at its most alive.', es: 'Celebraciones, escapadas culturales y experiencias por tiempo limitado en torno al Egipto más vibrante.', it: 'Celebrazioni, fughe culturali ed esperienze a tempo limitato intorno all\'Egitto più vivo.', ar: 'احتفالات وعطلات ثقافية وتجارب محدودة التوقيت، مرتبة لتعيش مصر في أكثر لحظاتها حيوية.' })}</p>
          <div className="events-page-hero-actions">
            <a href="#events-list" className="primary-btn">{tx(locale, { en: 'Explore upcoming events', es: 'Descubre los próximos eventos', it: 'Scopri i prossimi eventi', ar: 'استكشف الفعاليات' })} <ArrowRight size={17} /></a>
            {featured && <Link href={`/events/${featured.slug}`} className="events-hero-link">{tx(locale, { en: 'View the next event', es: 'Ver el próximo evento', it: 'Vedi il prossimo evento', ar: 'تفاصيل الفعالية القادمة' })} <ArrowRight size={16} /></Link>}
          </div>
        </div>
        <div className="events-hero-rail">
          {featured ? <Link href={`/events/${featured.slug}`} className="events-next-event">
            <span>{tx(locale, { en: 'Next event', es: 'Próximo evento', it: 'Prossimo evento', ar: 'الفعالية القادمة' })}</span>
            <strong>{(locale === 'ar' ? featured.titleAr : undefined) || featured.title}</strong>
            <small><CalendarDays size={14} />{featured.date}<i aria-hidden="true"/><MapPin size={14} />{(locale === 'ar' ? featured.locationAr : undefined) || featured.location}</small>
          </Link> : <p className="events-next-empty">{tx(locale, { en: 'No published events right now.', es: 'No hay eventos publicados ahora mismo.', it: 'Nessun evento pubblicato al momento.', ar: 'لا توجد فعاليات منشورة حاليًا.' })}</p>}
          <div className="events-hero-stats" aria-label={tx(locale, { en: 'Events summary', es: 'Resumen de eventos', it: 'Riepilogo eventi', ar: 'ملخص الفعاليات' })}>
            <span><b>{upcomingCount}</b>{tx(locale, { en: 'Upcoming events', es: 'Próximos eventos', it: 'Prossimi eventi', ar: 'فعاليات قادمة' })}</span>
            <span><b>{cityCount}</b>{tx(locale, { en: 'Egyptian cities', es: 'Ciudades egipcias', it: 'Città egiziane', ar: 'مدن مصرية' })}</span>
          </div>
        </div>
      </div>
    </section>
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
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveEvents = useLiveEvents(events, { includeHidden: true })
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
  if (item.isPublished === false) return <SiteShell><main className="container section"><div className="account-empty" role="status"><h1>{tx(locale, { en: 'This event is currently hidden', es: 'Este evento está oculto ahora mismo', it: 'Questo evento è attualmente nascosto', ar: 'هذه الفعالية مخفية حاليًا' })}</h1><p>{tx(locale, { en: 'Browse the other published events.', es: 'Descubre los otros eventos publicados.', it: 'Scopri gli altri eventi pubblicati.', ar: 'تصفح الفعاليات المنشورة الأخرى.' })}</p><Link href="/events" className="primary-btn">{tx(locale, { en: 'See all events', es: 'Ver todos los eventos', it: 'Vedi tutti gli eventi', ar: 'شاهد كل الفعاليات' })}</Link></div></main></SiteShell>
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
    <Breadcrumb items={[tx(locale, { en: 'Events', es: 'Eventos', it: 'Eventi', ar: 'الفعاليات' }), title]} />
    <section className="event-detail-hero container">
      <img src={eventImageSrc(item.image)} alt={title} onError={onEventImageError} />
      <div className="event-detail-shade" />
      <div className="event-detail-content">
        <div className="event-detail-main">
          <span className="event-detail-kicker"><Ticket size={15}/>{category ?? (tx(locale, { en: 'Seasonal event', es: 'Evento de temporada', it: 'Evento stagionale', ar: 'فعالية موسمية' }))}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="event-detail-pills"><span><CalendarDays size={15} />{item.date}</span><span><MapPin size={15} />{venue}</span>{timeLine && <span><Clock3 size={15} />{timeLine}</span>}<span className="event-price-pill">{eventPriceLabel(item, ar)}</span>{statusLabel && <span className="event-status">{statusLabel}</span>}</div>
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
        <section className="event-about">
          <span className="eyebrow">{tx(locale, { en: 'About this event', es: 'Sobre este evento', it: 'Su questo evento', ar: 'عن الفعالية' })}</span>
          <h2>{copy}</h2>
          {intro !== copy && <p className="event-lede">{intro}</p>}
          {item.gallery && item.gallery.length > 0 && <div className="event-gallery" role="list" aria-label={tx(locale, { en: 'Event photos', es: 'Fotos del evento', it: 'Foto dell\'evento', ar: 'صور الفعالية' })}>{item.gallery.map((src) => <img key={src} role="listitem" src={eventImageSrc(src)} alt={title} loading="lazy" onError={onEventImageError} />)}</div>}
        </section>
        {item.highlights && item.highlights.length > 0 && <section className="event-experience">
          <span className="eyebrow">{tx(locale, { en: 'Why this journey works', es: 'Por qué funciona este viaje', it: 'Perché questo viaggio funziona', ar: 'ليه الرحلة دي مميزة' })}</span>
          <div className="event-experience-grid">{item.highlights.map((highlight, index) => <article key={highlight.title}><span>{String(index + 1).padStart(2, '0')}</span><Sparkles size={20}/><h3>{(locale === 'ar' ? highlight.titleAr : undefined) || highlight.title}</h3><p>{(locale === 'ar' ? highlight.descriptionAr : undefined) || highlight.description}</p></article>)}</div>
        </section>}
        {range.start && now !== null && msLeft > 0 && (status === 'upcoming') && <section className="event-countdown-wrap" aria-label={tx(locale, { en: 'Countdown', es: 'Cuenta atrás', it: 'Conto alla rovescia', ar: 'العد التنازلي' })}>
          <span className="eyebrow">{tx(locale, { en: 'Countdown to the event', es: 'Cuenta atrás para el evento', it: 'Conto alla rovescia per l\'evento', ar: 'العد التنازلي لبداية الفعالية' })}</span>
          <div className="event-countdown" role="timer">{cd.map((v, i) => <span key={cdLabels[i]}><b>{String(v).padStart(2, '0')}</b><small>{cdLabels[i]}</small></span>)}</div>
        </section>}
        {hasProgram && <section id="event-program" className="event-program">
          <span className="eyebrow">{tx(locale, { en: 'Event program', es: 'Programa del evento', it: 'Programma dell\'evento', ar: 'برنامج الفعالية' })}</span>
          <h2>{tx(locale, { en: 'Day by day', es: 'Día a día', it: 'Giorno per giorno', ar: 'يوم بيوم' })}</h2>
          <div className="event-program-list">{item.program!.map((d) => <article key={`${d.day}-${d.title}`}><span className="event-program-day">{d.day}</span><div><h3>{d.title}</h3><p>{d.description}</p></div></article>)}</div>
        </section>}
        {(included?.length || excluded?.length) && <section className="event-inclusions">
          <span className="eyebrow">{tx(locale, { en: 'Included & excluded', es: 'Incluido y no incluido', it: 'Incluso ed escluso', ar: 'المشمول والمستبعد' })}</span>
          <h2>{tx(locale, { en: 'Know exactly what the arrangement covers.', es: 'Descubre exactamente qué cubre la organización.', it: 'Scopri esattamente cosa copre l\'organizzazione.', ar: 'اعرف بالضبط إيه الموجود في الترتيب.' })}</h2>
          <div className="event-inclusion-grid">
            {included && included.length > 0 && <article><h3>{tx(locale, { en: "What's included", es: "Incluido", it: "Incluso", ar: 'مشمول' })}</h3><ul className="check-list">{included.map((x) => <li key={x}><Check size={16} />{x}</li>)}</ul></article>}
            {excluded && excluded.length > 0 && <article><h3>{tx(locale, { en: 'Not included', es: 'No incluido', it: 'Escluso', ar: 'غير مشمول' })}</h3><ul className="excluded-list">{excluded.map((x) => <li key={x}><Minus size={16} />{x}</li>)}</ul></article>}
          </div>
        </section>}
        {item.addOns && item.addOns.length > 0 && <section className="event-addons-wrap">
          <span className="eyebrow">{tx(locale, { en: 'Optional add-ons', es: 'Extras opcionales', it: 'Extra facoltativi', ar: 'إضافات اختيارية' })}</span>
          <h2>{tx(locale, { en: 'Enhance your experience', es: 'Mejora tu experiencia', it: 'Arricchisci la tua esperienza', ar: 'زوّد تجربتك' })}</h2>
          <ul className="event-addons">{item.addOns.map((a) => <li key={a.title}><Plus size={15} />{a.title}{typeof a.price === 'number' ? ` · ${a.price}` : ''}</li>)}</ul>
        </section>}
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
            {item.organizerPhone && telLink(undefined, item.organizerPhone) !== '' && <li><Phone size={15} /><a href={telLink(undefined, item.organizerPhone)}>{item.organizerPhone}</a></li>}
            {item.organizerWhatsapp && whatsappLink(undefined, item.organizerWhatsapp) !== '' && <li><MessageCircle size={15} /><a href={whatsappLink(undefined, item.organizerWhatsapp)} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {item.organizerEmail && <li><Mail size={15} /><a href={`mailto:${item.organizerEmail}`}>{item.organizerEmail}</a></li>}
          </ul>
        </section>}
        {related.length > 0 && <section className="event-related">
          <div className="section-title-row"><h2>{tx(locale, { en: 'More events', es: 'Más eventos', it: 'Altri eventi', ar: 'فعاليات أخرى' })}</h2><Link href="/events" className="text-link">{tx(locale, { en: 'View all', es: 'Ver todo', it: 'Vedi tutto', ar: 'شاهد الكل' })} <ArrowRight size={15} /></Link></div>
          <div className="event-grid two">{related.map((e) => <EventCard item={e} key={e.slug} />)}</div>
        </section>}
      </div>
      <aside id="event-book" className="event-book" aria-label={tx(locale, { en: 'Event request', es: 'Solicitud del evento', it: 'Richiesta evento', ar: 'طلب حضور الفعالية' })}>
        <EventRequestForm event={item} />
      </aside>
    </div>
  </main></SiteShell>
}

export function OffersPage() {
  return <SiteShell><OffersPageContent /></SiteShell>
}

function OffersPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveSeasonal = useDbTours(seasonalTours)
  const customOffers = useLiveCollection('offers', offers).filter((offer) => isCustomSlug(offer.slug))
  const featured = liveSeasonal[0]
  const destinationsCount = new Set(liveSeasonal.flatMap((tour) => tour.location.split(',').map((place) => place.trim()).filter(Boolean))).size
  if (!featured) return null
  return <main className="offers-page">
      <PageShowcaseHero image={featured.image} eyebrow={tx(locale, { en: 'Curated Egypt savings', es: 'Ahorros seleccionados en Egipto', it: 'Risparmi selezionati in Egitto', ar: 'توفير مختار بعناية في مصر' })} title={tx(locale, { en: 'Egypt travel offers worth packing for.', es: 'Ofertas de viaje a Egipto por las que merece la pena hacer la maleta.', it: 'Offerte di viaggio in Egitto per cui vale la pena fare le valigie.', ar: 'عروض سفر في مصر تستاهل تجهزلها شنطة.' })} intro={tx(locale, { en: 'More nights, thoughtful extras, and memorable combinations designed to give your Egypt journey more value.', es: 'Más noches, extras con encanto y combinaciones memorables para dar más valor a tu viaje a Egipto.', it: 'Più notti, extra pensati e combinazioni memorabili per dare più valore al tuo viaggio in Egitto.', ar: 'ليالٍ أكثر وإضافات مدروسة وتركيبات لا تُنسى تمنح رحلتك لمصر قيمة أكبر.' })} primaryLabel={tx(locale, { en: 'Explore current offers', es: 'Descubre las ofertas actuales', it: 'Scopri le offerte attuali', ar: 'استكشف العروض الحالية' })} primaryHref="#current-offers" secondaryLabel={tx(locale, { en: 'View the featured package', es: 'Ver el paquete destacado', it: 'Vedi il pacchetto in evidenza', ar: 'شاهد الباقة المميزة' })} secondaryHref={`/egypt-tours/${featured.slug}`} railLabel={tx(locale, { en: 'Featured package', es: 'Paquete destacado', it: 'Pacchetto in evidenza', ar: 'باقة مميزة' })} railTitle={(locale === 'ar' ? featured.titleAr : undefined) || featured.title} railHref={`/egypt-tours/${featured.slug}`} railMeta={[{ Icon: Clock3, label: featured.duration }, { Icon: MapPin, label: featured.location }]} statsLabel={tx(locale, { en: 'Offers summary', es: 'Resumen de ofertas', it: 'Riepilogo offerte', ar: 'ملخص العروض' })} stats={[{ value: liveSeasonal.length + customOffers.length, label: tx(locale, { en: 'Packages listed', es: 'Paquetes publicados', it: 'Pacchetti disponibili', ar: 'باقات معروضة' }) }, { value: destinationsCount, label: tx(locale, { en: 'Offer destinations', es: 'Destinos en oferta', it: 'Destinazioni in offerta', ar: 'وجهات في العروض' }) }]}/>

      <section className="offers-trust" aria-label={tx(locale, { en: 'Booking benefits', es: 'Ventajas de reservar', it: 'Vantaggi della prenotazione', ar: 'مميزات الحجز' })}>
        <div className="container">
          <div><CalendarCheck size={22}/><span><strong>{tx(locale, { en: 'Built around your dates', es: 'Creadas en torno a tus fechas', it: 'Costruite intorno alle tue date', ar: 'مصممة حول مواعيدك' })}</strong><small>{tx(locale, { en: 'We match each offer to your travel window.', es: 'Adaptamos cada oferta a tus fechas de viaje.', it: 'Adattiamo ogni offerta alle tue date di viaggio.', ar: 'نطابق كل عرض مع نافذة سفرك.' })}</small></span></div>
          <div><Gift size={22}/><span><strong>{tx(locale, { en: 'Meaningful extras', es: 'Extras con sentido', it: 'Extra significativi', ar: 'إضافات ذات معنى' })}</strong><small>{tx(locale, { en: 'Added value that improves the actual journey.', es: 'Valor añadido que mejora el viaje de verdad.', it: 'Valore aggiunto che migliora davvero il viaggio.', ar: 'قيمة مضافة تحسّن الرحلة فعلًا.' })}</small></span></div>
          <div><Headphones size={22}/><span><strong>{tx(locale, { en: 'Local support', es: 'Apoyo local', it: 'Supporto locale', ar: 'دعم محلي' })}</strong><small>{tx(locale, { en: 'A real Egypt-based team from enquiry to arrival.', es: 'Un equipo real en Egipto, desde la consulta hasta la llegada.', it: 'Un vero team in Egitto, dalla richiesta.', ar: 'فريق مصري حقيقي من الاستفسار للوصول.' })}</small></span></div>
        </div>
      </section>

      <section id="current-offers" className="offers-current container">
        <header className="offers-section-head">
          <div><span className="eyebrow">{tx(locale, { en: 'Current opportunities', es: 'Oportunidades actuales', it: 'Opportunità attuali', ar: 'فرص حالية' })}</span><h2>{tx(locale, { en: 'Choose the value that fits your journey.', es: 'Elige el valor que encaje con tu viaje.', it: 'Scegli il valore adatto al tuo viaggio.', ar: 'اختر القيمة المناسبة لرحلتك.' })}</h2></div>
          <p>{tx(locale, { en: 'Every offer can be shaped around your dates, group, and preferred pace. Ask our team for the exact inclusions before you commit.', es: 'Cada oferta puede adaptarse a tus fechas, tu grupo y tu ritmo. Pregunta a nuestro equipo por las inclusiones exactas antes de decidirte.', it: 'Ogni offerta può essere modellata su date, gruppo e ritmo. Chiedi al nostro team le inclusioni esatte prima di impegnarti.', ar: 'كل عرض يمكن تشكيله حول مواعيدك ومجموعتك وإيقاعك المفضل. اسأل فريقنا عن المشمول الدقيق قبل الحجز.' })}</p>
        </header>

        <div className="offer-grid">
          {liveSeasonal.map((tour) => {const offer=getTourOffer(tour,seasonalOfferDeadline); return <PromotionCard key={tour.slug} href={`/egypt-tours/${tour.slug}`} title={tour.title} images={promotionGalleryForTour(tour, images)} badge={offer.badge} kicker={tx(locale, { en: 'Special package', es: 'Paquete especial', it: 'Pacchetto speciale', ar: 'باقة مميزة' })} duration={tour.duration} rating={offer.rating} deadline={offer.deadline} countdownLabels={locale === 'ar' ? ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'] as const : locale === 'es' ? ['Días', 'Horas', 'Min', 'Seg'] as const : locale === 'it' ? ['Giorni', 'Ore', 'Min', 'Sec'] as const : undefined} price={tour.price} originalPrice={offer.originalPrice}/>}) }
          {customOffers.map((offer) => <PromotionCard key={offer.slug} href={`/special-offers/${offer.slug}`} title={offer.title} images={[offer.image, ...(offer.gallery ?? [])]} badge={offer.badge} kicker={tx(locale, { en: 'Special offer', es: 'Oferta especial', it: 'Offerta speciale', ar: 'عرض خاص' })} duration={offer.duration} rating={offer.rating} deadline={offer.deadline} countdownLabels={locale === 'ar' ? ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'] as const : locale === 'es' ? ['Días', 'Horas', 'Min', 'Seg'] as const : locale === 'it' ? ['Giorni', 'Ore', 'Min', 'Sec'] as const : undefined} price={offer.price} originalPrice={offer.originalPrice} description={offer.copy} highlights={offer.highlights} ctaLabel={tx(locale, { en: 'Claim this offer', es: 'Quiero esta oferta', it: 'Voglio questa offerta', ar: 'احجز هذا العرض' })}/>)}
        </div>
      </section>

      <section className="offers-process">
        <div className="container">
          <header><span className="eyebrow">{tx(locale, { en: 'Simple and personal', es: 'Sencillo y personal', it: 'Semplice e personale', ar: 'بسيط وشخصي' })}</span><h2>{tx(locale, { en: 'From offer to confirmed journey.', es: 'De la oferta al viaje confirmado.', it: 'Dall\'offerta al viaggio confermato.', ar: 'من العرض لرحلة مؤكدة.' })}</h2></header>
          <div className="offers-process-grid">
            <div><strong>01</strong><h3>{tx(locale, { en: 'Choose your offer', es: 'Elige tu oferta', it: 'Scegli la tua offerta', ar: 'اختر عرضك' })}</h3><p>{tx(locale, { en: 'Pick the value or travel style that feels right for your trip.', es: 'Elige el valor o el estilo de viaje que encaje con tu viaje.', it: 'Scegli il valore o lo stile di viaggio giusto per il tuo viaggio.', ar: 'اختر القيمة أو نمط السفر المناسب لرحلتك.' })}</p></div>
            <div><strong>02</strong><h3>{tx(locale, { en: 'Share your dates', es: 'Comparte tus fechas', it: 'Condividi le tue date', ar: 'شاركنا مواعيدك' })}</h3><p>{tx(locale, { en: 'Tell us who is traveling and the experience you have in mind.', es: 'Cuéntanos quién viaja y la experiencia que imaginas.', it: 'Dicci chi viaggia e l\'esperienza che immagini.', ar: 'أخبرنا بمن يسافر وبالتجربة التي تتصورها.' })}</p></div>
            <div><strong>03</strong><h3>{tx(locale, { en: 'Confirm the details', es: 'Confirma los detalles', it: 'Conferma i dettagli', ar: 'أكّد التفاصيل' })}</h3><p>{tx(locale, { en: 'We verify availability and send the exact itinerary and inclusions.', es: 'Verificamos la disponibilidad y te enviamos el itinerario exacto y las inclusiones.', it: 'Verifichiamo la disponibilità e ti inviamo itinerario esatto e inclusioni.', ar: 'نتحقق من التوافر وسنرسل البرنامج الدقيق والمشمول.' })}</p></div>
          </div>
        </div>
      </section>

      <section className="offers-final">
        <img src={siteImages.nile} alt={tx(locale, { en: 'A Nile journey through Egypt', es: 'Un viaje por el Nilo en Egipto', it: 'Un viaggio sul Nilo in Egitto', ar: 'رحلة نيلية في مصر' })} loading="lazy"/>
        <div className="offers-final-shade"/>
        <div className="container offers-final-content">
          <span className="eyebrow">{tx(locale, { en: 'Need a different kind of value?', es: '¿Buscas otro tipo de valor?', it: 'Cerchi un altro tipo di valore?', ar: 'هل تحتاج إلى نوع مختلف من القيمة؟' })}</span>
          <h2>{tx(locale, { en: 'Let us shape an offer around your Egypt plans.', es: 'Diseñemos una oferta en torno a tus planes en Egipto.', it: 'Creiamo un\'offerta intorno ai tuoi piani in Egitto.', ar: 'دعنا نصمم عرضًا حول خططك لمصر.' })}</h2>
          <p>{tx(locale, { en: 'Tell us your dates, group size, and wish list. Our travel designers will recommend the best available route and inclusions.', es: 'Cuéntanos tus fechas, el tamaño del grupo y tu lista de deseos. Nuestros diseñadores de viajes te recomendarán la mejor ruta y las mejores inclusiones disponibles.', it: 'Dicci date, numero di partecipanti e desideri: i nostri travel designer consiglieranno il miglior itinerario e le migliori inclusioni disponibili.', ar: 'أخبرنا بمواعيدك وحجم مجموعتك وقائمة أمنياتك. سيرشح لك مصممو رحلاتنا أفضل خط سير ومشمول متاح.' })}</p>
          <Link href="/make-your-trip" className="primary-btn">{tx(locale, { en: 'Make your trip', es: 'Crea tu viaje', it: 'Crea il tuo viaggio', ar: 'خطط رحلتك' })} <ArrowRight size={17}/></Link>
        </div>
      </section>
    </main>
}

export function OfferDetailPage({ slug }: { slug: string }) { const { locale } = useLocale(); const ar = locale === 'ar'; const item = useLiveFind('offers', offers, slug); if (!item) return <DetailNotFound title={tx(locale, { en: 'Offer not found', es: 'Oferta no encontrada', it: 'Offerta non trovata', ar: 'العرض غير موجود' })} copy={tx(locale, { en: 'The offer you were looking for has taken a different route.', es: 'La oferta que buscabas ha tomado otro camino.', it: 'L\'offerta che cercavi ha preso un\'altra strada.', ar: 'العرض الذي تبحث عنه سلك طريقًا آخر.' })} backHref="/special-offers" backLabel={tx(locale, { en: 'See all offers', es: 'Ver todas las ofertas', it: 'Vedi tutte le offerte', ar: 'شاهد كل العروض' })}/>; return <SiteShell><EditorialHero eyebrow={item.badge} title={item.title} copy={item.copy} image={item.image} href="/contact" action={tx(locale, { en: 'Claim this offer', es: 'Quiero esta oferta', it: 'Voglio questa offerta', ar: 'احجز هذا العرض' })}/><main className="section container detail-layout"><article><h2>{tx(locale, { en: 'Make more of your time in Egypt', es: 'Aprovecha al máximo tu tiempo en Egipto', it: 'Sfrutta al meglio il tuo tempo in Egitto', ar: 'استفد أكثر من وقتك في مصر' })}</h2><p>{tx(locale, { en: 'This offer is designed to add ease and value without taking away from the experience. Share your travel dates and we will confirm availability and the exact inclusions for your journey.', es: 'Esta oferta está diseñada para añadir comodidad y valor sin restar a la experiencia. Comparte tus fechas y confirmaremos la disponibilidad y las inclusiones exactas de tu viaje.', it: 'Questa offerta è pensata per aggiungere comodità e valore senza togliere nulla all\'esperienza. Condividi le tue date: confermeremo disponibilità e inclusioni esatte del tuo viaggio.', ar: 'هذا العرض مصمم ليضيف سهولة وقيمة دون أن ينتقص من التجربة. شاركنا مواعيد سفرك وسنؤكد التوافر والمشمول الدقيق لرحلتك.' })}</p><div className="detail-highlights"><span><Check size={16}/> {tx(locale, { en: 'Personal trip planning', es: 'Planificación personal del viaje', it: 'Pianificazione personale del viaggio', ar: 'تخطيط رحلة شخصي' })}</span><span><Check size={16}/> {tx(locale, { en: 'Local support throughout', es: 'Apoyo local durante todo el viaje', it: 'Supporto locale per tutto il viaggio', ar: 'دعم محلي طوال الرحلة' })}</span><span><Check size={16}/> {tx(locale, { en: 'Clear terms before booking', es: 'Condiciones claras antes de reservar', it: 'Condizioni chiare prima di prenotare', ar: 'شروط واضحة قبل الحجز' })}</span></div></article><aside className="booking-card"><h3>{tx(locale, { en: 'Ready to make it yours?', es: '¿Listo para hacerla tuya?', it: 'Pronto a renderla tua?', ar: 'هل أنت مستعد لتخصيصه لك؟' })}</h3><Link href="/contact" className="primary-btn">{tx(locale, { en: 'Contact our team', es: 'Contacta con nuestro equipo', it: 'Contatta il nostro team', ar: 'تواصل مع فريقنا' })}</Link></aside></main></SiteShell> }

export function GuidePage() { const { locale } = useLocale(); const ar = locale === 'ar'; const groups: [string, string, string[]][] = [['Ancient civilization', 'Temples, tombs, and five thousand years of stories.', ['Pharaohs', 'Mythology', 'Pyramids', 'Temples', 'Tombs']], ['Tourist attractions', 'Where to go, city by city.', ['Cairo', 'Luxor', 'Aswan', 'Alexandria', 'Sinai', 'Museums', 'Oases']], ['Travel tips', 'Practical know-how before you fly.', ['Before you travel', 'While you are in Egypt', 'Visas', 'Packing', 'Tipping']], ['Destinations', 'Coasts, deserts, cities, and the Nile.', ['Red Sea', 'White Desert', 'Siwa Oasis', 'Nile Valley']], ['Tour packages', 'How to choose the right format.', ['Classic tours', 'Small groups', 'Honeymoon', 'Adventure', 'Spiritual']], ['Sustainability', 'Travel kindly and leave a positive footprint.', ['Local communities', 'Accessible travel', 'Responsible choices']]]; return <SiteShell><EditorialHero eyebrow={tx(locale, { en: 'Learn before you go', es: 'Aprende antes de viajar', it: 'Impara prima di partire', ar: 'تعلّم قبل أن تسافر' })} title={tx(locale, { en: 'Egypt travel guide', es: 'Guía de viaje de Egipto', it: 'Guida di viaggio dell\'Egitto', ar: 'دليل السفر إلى مصر' })} copy={tx(locale, { en: 'Attractions, tips, destinations, and honest advice for planning a smoother journey.', es: 'Atracciones, consejos, destinos y recomendaciones honestas para planificar un viaje sin contratiempos.', it: 'Attrazioni, consigli, destinazioni e suggerimenti onesti per pianificare un viaggio senza intoppi.', ar: 'معالم ونصائح ووجهات ونصيحة صادقة لرحلة أسهل.' })} image={siteImages.desert} href="/make-your-trip" action={tx(locale, { en: 'Plan my trip', es: 'Planifica mi viaje', it: 'Pianifica il mio viaggio', ar: 'خطط رحلتي' })} /><main className="section container"><div className="faq-list">{groups.map(([title, copy, topics]) => <details className="faq-item" key={title}><summary>{title}</summary><p>{copy}</p><div className="location-stops">{topics.map(t => <span key={t}>{t}</span>)}</div></details>)}</div></main><HelpCTA /></SiteShell> }

export function AccessiblePage() { const { locale } = useLocale(); const ar = locale === 'ar'; return <SiteShell><EditorialHero eyebrow={tx(locale, { en: 'Travel for everyone', es: 'Viajar es para todos', it: 'Viaggiare è per tutti', ar: 'سفر للجميع' })} title={tx(locale, { en: 'Accessible travel in Egypt', es: 'Viajes accesibles en Egipto', it: 'Viaggi accessibili in Egitto', ar: 'سفر ميسّر في مصر' })} copy={tx(locale, { en: 'Extra assistance, adapted pacing, and honest advice so every guest can enjoy Egypt comfortably.', es: 'Asistencia extra, ritmo adaptado y consejos honestos para que cada viajero disfrute Egipto con comodidad.', it: 'Assistenza extra, ritmo adattato e consigli onesti perché ogni ospite possa godersi l\'Egitto comodamente.', ar: 'مساعدة إضافية وإيقاع مكيّف ونصيحة صادقة ليستمتع كل ضيف بمصر براحة.' })} image={siteImages.pyramids} href="/contact" action={tx(locale, { en: 'Ask about assistance', es: 'Pregunta por asistencia', it: 'Chiedi assistenza', ar: 'اسأل عن المساعدة' })} /><main><section className="section container split-editorial"><div><span className="eyebrow">{tx(locale, { en: '5% discount', es: '5 % de descuento', it: 'Sconto del 5%', ar: 'خصم 5%' })}</span><h2>{tx(locale, { en: 'Extra care, on us.', es: 'Cuidado extra, por nuestra cuenta.', it: 'Attenzione extra, da parte nostra.', ar: 'عناية إضافية، علينا.' })}</h2><p>{tx(locale, { en: 'Guests requiring accessibility assistance receive 5% off all our tour packages. Tell us what you need and we will adapt vehicles, pacing, hotel rooms, and sightseeing to match.', es: 'Los viajeros que necesiten asistencia de accesibilidad reciben un 5 % de descuento en todos nuestros paquetes. Cuéntanos lo que necesitas y adaptaremos vehículos, ritmo, habitaciones y visitas.', it: 'Gli ospiti che necessitano assistenza per l\'accessibilità ricevono il 5% di sconto su tutti i pacchetti. Dicci di cosa hai bisogno: adatteremo veicoli, ritmo, camere e visite.', ar: 'ضيوفنا من ذوي الاحتياجات الخاصة يحصلون على خصم 5% على كل البرامج. أخبرنا باحتياجاتك وسنكيّف السيارات والإيقاع والغرف والمزارات.' })}</p><div className="detail-highlights">{(locale === 'ar' ? ['سيارات مجهزة', 'خيارات بدون سلالم', 'مرشدون صبورون ومدربون'] : locale === 'es' ? ['Vehículos adaptados', 'Opciones sin escalones', 'Guías pacientes y formados'] : locale === 'it' ? ['Veicoli adattati', 'Opzioni senza gradini', 'Guide pazienti e formate'] : ['Adapted vehicles', 'Step-free options', 'Patient, trained guides']).map(x => <span key={x}><Check size={16} />{x}</span>)}</div></div><img src={siteImages.temple} alt={tx(locale, { en: 'Accessible travel in Egypt', es: 'Viajes accesibles en Egipto', it: 'Viaggi accessibili in Egitto', ar: 'سفر ميسّر في مصر' })} /></section><HelpCTA /></main></SiteShell> } export function FAQPage() { const [open,setOpen] = useState(0); const { locale } = useLocale(); const ar = locale === 'ar'; return <SiteShell><EditorialHero eyebrow={tx(locale, { en: 'Questions, answered', es: 'Preguntas con respuesta', it: 'Domande e risposte', ar: 'أسئلة وإجابات' })} title={tx(locale, { en: 'A smoother way to plan Egypt', es: 'Una forma más fácil de planificar Egipto', it: 'Un modo più semplice per pianificare.', ar: 'خطط لمصر براحة أكبر' })} copy={tx(locale, { en: 'Find clear answers to common questions, then talk to our team when you are ready for the details.', es: 'Encuentra respuestas claras a las preguntas frecuentes y habla con nuestro equipo cuando quieras los detalles.', it: 'Trova risposte chiare alle domande frequenti, poi parla con il nostro team quando vuoi i dettagli.', ar: 'اعثر على إجابات واضحة للأسئلة الشائعة، ثم كلمنا عندما تكون جاهزًا للتفاصيل.' })} image={siteImages.temple} href="/contact" action={tx(locale, { en: 'Ask a question', es: 'Haz una pregunta', it: 'Fai una domanda', ar: 'اسأل سؤالًا' })}/><main className="section container faq-page"><div className="faq-intro"><span className="eyebrow">{tx(locale, { en: 'Good to know', es: 'Conviene saber', it: 'Utile sapere', ar: 'معلومات تهمك' })}</span><h2>{tx(locale, { en: 'Before you go', es: 'Antes de viajar', it: 'Prima di partire', ar: 'قبل السفر' })}</h2><p>{tx(locale, { en: 'We believe planning should feel as welcoming as the trip itself.', es: 'Creemos que planificar debe resultar tan acogedor como el propio viaje.', it: 'Crediamo che pianificare debba essere accogliente quanto il viaggio stesso.', ar: 'نؤمن أن التخطيط يجب أن يكون مرحبًا مثل الرحلة نفسها.' })}</p></div><div className="faq-list">{faqs.map(([question,answer],i)=><div className={`faq-item ${open===i?'open':''}`} key={question}><button onClick={()=>setOpen(open===i?-1:i)}><span>{question}</span><b>{open===i?'−':'+'}</b></button>{open===i&&<p>{answer}</p>}</div>)}</div></main></SiteShell> }

export function SearchPage() { const params=useSearchParams(); const initial=parseSearchQuery(params).q; const [query,setQuery]=useState(initial); useEffect(()=>setQuery(initial),[initial]); const { locale } = useLocale(); const ar = locale === 'ar'; const liveEvents = useLiveEvents(events); const typeLabel = (t: string) => t === 'Blog' ? tx(locale, { en: t, es: 'Blog', it: 'Blog', ar: 'مدونة' }) : t === 'Event' ? tx(locale, { en: t, es: 'Evento', it: 'Evento', ar: 'فعالية' }) : t === 'Offer' ? tx(locale, { en: t, es: 'Oferta', it: 'Offerta', ar: 'عرض' }) : tx(locale, { en: t, es: 'Destino', it: 'Destinazione', ar: 'وجهة' }); const staticResults=allSearchItems.filter(item=>`${item.title} ${item.copy}`.toLowerCase().includes(query.toLowerCase())); const liveCustomEvents = liveEvents.filter((e) => !allSearchItems.some((s) => s.slug === e.slug && s.type === 'Event') && isEventPublished(e) && `${e.title} ${e.copy}`.toLowerCase().includes(query.toLowerCase())).map((e) => ({ title: e.title, slug: e.slug, image: e.image, copy: e.copy, type: 'Event' as const })); const results=[...staticResults, ...liveCustomEvents]; return <SiteShell><main className="search-page container"><div className="search-page-header"><span className="eyebrow">{tx(locale, { en: 'Explore the site', es: 'Descubre el sitio', it: 'Esplora il sito', ar: 'استكشف الموقع' })}</span><h1>{tx(locale, { en: 'Find your next Egypt story', es: 'Encuentra tu próxima historia en Egipto', it: 'Trova la tua prossima storia in Egitto', ar: 'اعثر على حكايتك القادمة في مصر' })}</h1><label><Search size={20}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value.slice(0,120))} placeholder={tx(locale, { en: 'Search tours, destinations, stories...', es: 'Busca excursiones, destinos, historias...', it: 'Cerca tour, destinazioni, storie...', ar: 'ابحث عن رحلات ووجهات وحكايات...' })} aria-label={tx(locale, { en: 'Search', es: 'Buscar', it: 'Cerca', ar: 'بحث' })}/></label></div><div className="search-results"><p>{tx(locale, { en: `${results.length} result${results.length===1?'':'s'}`, es: `${results.length} resultado${results.length===1?'':'s'}`, it: `${results.length} risultato${results.length===1?'':'i'}`, ar: `${results.length} نتيجة` })}{query ? (tx(locale, { en: ` for "${query}"`, es: ` para "${query}"`, it: ` per "${query}"`, ar: ` عن "${query}"` })) : ''}</p><div className="content-grid">{results.map(item=><article className="content-card" key={`${item.type}-${item.slug}`}><img className="content-image" src={item.image} alt={item.title}/><div className="content-card-body"><small>{typeLabel(item.type)}</small><h3>{item.title}</h3><p>{item.copy}</p><Link href={item.type==='Blog'?`/blogs/${item.slug}`:item.type==='Event'?`/events/${item.slug}`:item.type==='Offer'?`/special-offers/${item.slug}`:`/destinations/${item.slug}`} className="text-link">{tx(locale, { en: 'Explore', es: 'Descubrir', it: 'Scopri', ar: 'استكشف' })} <ArrowRight size={15}/></Link></div></article>)}</div></div></main></SiteShell> }

export function PolicyPage({ type }: { type: 'privacy' | 'terms' }) { const { locale } = useLocale(); const ar = locale === 'ar'; const title=type==='privacy'?(tx(locale, { en: 'Privacy Policy', es: 'Política de privacidad', it: 'Informativa sulla privacy', ar: 'سياسة الخصوصية' })):(tx(locale, { en: 'Terms and Conditions', es: 'Términos y condiciones', it: 'Termini e condizioni', ar: 'الشروط والأحكام' })); return <SiteShell><Breadcrumb items={[title]}/><main className="policy-page container"><span className="eyebrow">STAR PYRAMIDS Tours</span><h1>{title}</h1><p className="policy-lede">{tx(locale, { en: 'Clear, respectful, and easy to understand. These notes explain how we work with you.', es: 'Claras, respetuosas y fáciles de entender. Estas notas explican cómo trabajamos contigo.', it: 'Chiare, rispettose e facili da capire. Queste note spiegano come lavoriamo con te.', ar: 'واضحة ومحترمة وسهلة الفهم. هذه الملاحظات تشرح طريقة تعاملنا معك.' })}</p>{policies[type].map(item=><section key={item.h}><h2>{item.h}</h2><p>{item.p}</p></section>)}</main></SiteShell> }
export function ForgotPasswordPage() { const [sent,setSent]=useState(false); const { locale } = useLocale(); const ar = locale === 'ar'; return <SiteShell><main className="auth-page-centered"><div className="auth-card"><div className="auth-mobile-logo"><Link href="/"><span className="brand-copy"><strong>STAR PYRAMIDS</strong><small>SINCE 1970</small></span></Link></div>{sent?<div className="form-success"><Check size={34}/><h2>{tx(locale, { en: 'Recovery preview', es: 'Vista previa de recuperación', it: 'Anteprima di recupero', ar: 'معاينة الاستعادة' })}</h2><p>{tx(locale, { en: 'No email has been sent. Account recovery is not connected to the backend yet — this is a preview only.', es: 'No se ha enviado ningún correo. La recuperación de la cuenta aún no está conectada: esto es solo una vista previa.', it: 'Nessuna email è stata inviata. Il recupero account non è ancora collegato: è solo un\'anteprima.', ar: 'لم يتم إرسال أي بريد إلكتروني. استعادة الحساب غير مربوطة بالخلفية بعد — هذه معاينة فقط.' })}</p><p className="auth-switch"><Link href="/login">{tx(locale, { en: 'Back to sign in', es: 'Volver a iniciar sesión', it: 'Torna all\'accesso', ar: 'العودة إلى تسجيل الدخول' })}</Link></p></div>:<><span className="eyebrow">{tx(locale, { en: 'Account recovery', es: 'Recuperación de la cuenta', it: 'Recupero account', ar: 'استعادة الحساب' })}</span><h1>{tx(locale, { en: 'Reset your password', es: 'Restablece tu contraseña', it: 'Reimposta la tua password', ar: 'استعادة كلمة المرور' })}</h1><p>{tx(locale, { en: 'Enter your email to preview the recovery flow.', es: 'Introduce tu correo para ver una vista previa de la recuperación.', it: 'Inserisci la tua email per vedere un\'anteprima del recupero.', ar: 'أدخل بريدك لمعاينة خطوات الاستعادة.' })}</p><form className="contact-form" onSubmit={(e)=>{e.preventDefault();setSent(true)}}><label>{tx(locale, { en: 'Email address', es: 'Correo electrónico', it: 'Indirizzo email', ar: 'البريد الإلكتروني' })}<input required type="email" placeholder="you@example.com"/></label><button className="auth-submit" type="submit">{tx(locale, { en: 'Send reset link', es: 'Enviar enlace de restablecimiento', it: 'Invia link di reimpostazione', ar: 'أرسل رابط الاستعادة' })}</button></form><p className="auth-switch">{tx(locale, { en: 'Remembered your password?', es: '¿Recordaste tu contraseña?', it: 'Hai ricordato la password?', ar: 'هل تذكرت كلمة المرور؟' })} <Link href="/login">{tx(locale, { en: 'Sign in', es: 'Iniciar sesión', it: 'Accedi', ar: 'سجّل دخولك' })}</Link></p></>}</div></main></SiteShell> }

export function AccountPage({ section = 'overview' }: { section?: string }) { const { locale } = useLocale(); const ar = locale === 'ar'; const nav=[[tx(locale, { en: 'Overview', es: 'Resumen', it: 'Panoramica', ar: 'نظرة عامة' }),'/account'],[tx(locale, { en: 'My bookings', es: 'Mis reservas', it: 'Le mie prenotazioni', ar: 'حجوزاتي' }),'/account/bookings'],[tx(locale, { en: 'Favorites', es: 'Favoritos', it: 'Preferiti', ar: 'المفضلة' }),'/account/favorites'],[tx(locale, { en: 'Profile settings', es: 'Ajustes del perfil', it: 'Impostazioni profilo', ar: 'إعدادات الحساب' }),'/account/profile']]; const activeKey=section==='overview'?(tx(locale, { en: 'Overview', es: 'Resumen', it: 'Panoramica', ar: 'نظرة عامة' })):section==='bookings'?(tx(locale, { en: 'My bookings', es: 'Mis reservas', it: 'Le mie prenotazioni', ar: 'حجوزاتي' })):section==='favorites'?(tx(locale, { en: 'Favorites', es: 'Favoritos', it: 'Preferiti', ar: 'المفضلة' })):(tx(locale, { en: 'Profile settings', es: 'Ajustes del perfil', it: 'Impostazioni profilo', ar: 'إعدادات الحساب' })); const heading=section === 'overview' ? (tx(locale, { en: 'Make space for your next adventure.', es: 'Haz hueco para tu próxima aventura.', it: 'Fai spazio alla tua prossima avventura.', ar: 'افسح مكانًا لمغامرتك القادمة.' })) : section === 'bookings' ? (tx(locale, { en: 'Your bookings', es: 'Tus reservas', it: 'Le tue prenotazioni', ar: 'حجوزاتك' })) : section === 'favorites' ? (tx(locale, { en: 'Saved journeys', es: 'Viajes guardados', it: 'Viaggi salvati', ar: 'الرحلات المحفوظة' })) : (tx(locale, { en: 'Profile settings', es: 'Ajustes del perfil', it: 'Impostazioni profilo', ar: 'إعدادات الحساب' })); return <SiteShell><main className="account-page container"><ImpersonationBanner /><aside className="account-nav"><span className="eyebrow">{tx(locale, { en: 'Your account', es: 'Tu cuenta', it: 'Il tuo account', ar: 'حسابك' })}</span><h1>{tx(locale, { en: 'Welcome back', es: 'Bienvenido de nuevo', it: 'Bentornato', ar: 'مرحبًا بعودتك' })}</h1>{nav.map(([label,href])=><Link className={activeKey===label?'active':''} key={href} href={href}>{label}<ArrowRight size={15}/></Link>)}<Link href="/">{tx(locale, { en: 'Sign out', es: 'Cerrar sesión', it: 'Esci', ar: 'تسجيل الخروج' })}</Link></aside><section className="account-content"><span className="eyebrow">{section === 'overview' ? (tx(locale, { en: 'Your travel desk', es: 'Tu mesa de viajes', it: 'Il tuo banco viaggi', ar: 'مكتب سفرك' })) : activeKey}</span><h2>{heading}</h2>{section==='overview'?<><div className="account-stats"><div><strong>0</strong><span>{tx(locale, { en: 'Upcoming trips', es: 'Próximos viajes', it: 'Prossimi viaggi', ar: 'رحلات قادمة' })}</span></div><div><strong>0</strong><span>{tx(locale, { en: 'Saved tours', es: 'Excursiones guardadas', it: 'Tour salvati', ar: 'رحلات محفوظة' })}</span></div><div><strong>1</strong><span>{tx(locale, { en: 'Open enquiry', es: 'Solicitud abierta', it: 'Richiesta aperta', ar: 'طلب مفتوح' })}</span></div></div><div className="account-empty"><h3>{tx(locale, { en: 'Your next chapter starts here.', es: 'Tu próximo capítulo empieza aquí.', it: 'Il tuo prossimo capitolo inizia qui.', ar: 'فصلك القادم يبدأ من هنا.' })}</h3><p>{tx(locale, { en: 'Explore our journeys and save the ones that make you curious.', es: 'Descubre nuestros viajes y guarda los que despierten tu curiosidad.', it: 'Esplora i nostri viaggi e salva quelli che accendono la tua curiosità.', ar: 'استكشف رحلاتنا واحفظ ما يثير فضولك.' })}</p><Link href="/egypt-tours/one-day-tours" className="primary-btn">{tx(locale, { en: 'Browse tours', es: 'Ver excursiones', it: 'Sfoglia i tour', ar: 'تصفح الرحلات' })}</Link></div></>:<div className="account-empty"><h3>{tx(locale, { en: 'Nothing here yet.', es: 'Nada por aquí todavía.', it: 'Niente qui per ora.', ar: 'لا يوجد شيء هنا بعد.' })}</h3><p>{tx(locale, { en: 'When you are ready, your STAR PYRAMIDS travel details will appear in this space.', es: 'Cuando estés listo, los detalles de tu viaje STAR PYRAMIDS aparecerán en este espacio.', it: 'Quando sarai pronto, i dettagli del tuo viaggio STAR PYRAMIDS appariranno in questo spazio.', ar: 'عندما تكون جاهزًا، ستظهر تفاصيل سفرك هنا.' })}</p><Link href="/make-your-trip" className="primary-btn">{tx(locale, { en: 'Start planning', es: 'Empieza a planificar', it: 'Inizia a pianificare', ar: 'ابدأ التخطيط' })}</Link></div>}</section></main></SiteShell> }
