'use client'

import { CmsPublicLink } from "@/components/cms/cms-public-link";
import { usePresentation, PresentationSection, PresentationOrder } from "@/components/cms/presentation-content-context";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, Compass, MapPin, Sun } from "lucide-react";
import { siteImages } from "@/data/content";
import { localizeCatalogue } from "@/lib/catalogue/catalogue-translations";
import { usePublicDestinationsStatus } from "@/lib/catalogue/catalogue-client";
import { destinationTours } from "@/lib/catalogue/destination-public";
import { invalidateToursCache, useDbToursStatus } from "@/lib/tours/tours-client";
import type { Destination, Tour } from "@/data/types";
import { useLocale, tx } from "../locale";
import { PageShowcaseHero, SiteShell, TourCard, TourCardPresentation } from "@/components/site";
import { useFaqHero } from "../cms/heroes/faq-hero-context";


type DestinationListProps = { initialDestinations?: Destination[]; loadError?: boolean }
export function DestinationsPage(props: DestinationListProps = {}) {
  return <SiteShell><DestinationsPageContent {...props} /></SiteShell>
}
function DestinationCatalogueStatus({ error, retry, empty = false }: { error?: boolean; retry: () => void; empty?: boolean }) {
  const { locale } = useLocale()
  return <div role={error ? 'alert' : 'status'} className="container section">
    <p>{error ? tx(locale, { en: 'Destinations could not be loaded. Please try again.', es: 'No se pudieron cargar los destinos. Inténtalo de nuevo.', it: 'Impossibile caricare le destinazioni. Riprova.' }) : empty ? tx(locale, { en: 'No destinations are available yet.', es: 'Aún no hay destinos disponibles.', it: 'Nessuna destinazione disponibile al momento.' }) : tx(locale, { en: 'Loading destinations…', es: 'Cargando destinos…', it: 'Caricamento destinazioni…' })}</p>
    {error && <button className="primary-btn" type="button" onClick={retry}>{tx(locale, { en: 'Try again', es: 'Reintentar', it: 'Riprova' })}</button>}
  </div>
}
function DestinationCatalogueHero({ count, eyebrow, title, copy, image, href, action }: { count: number; eyebrow: string; title: string; copy: string; image: string; href: string; action: string }) {
  const state = useFaqHero()
  const { locale } = useLocale()
  if (state?.hidden || state?.unavailable) return null
  const content = state?.content
  const text = content && locale !== 'ar' ? content.text[locale] : null
  return <PageShowcaseHero
    image={content?.image?.trim() || image}
    eyebrow={text?.eyebrow ?? eyebrow} title={text?.heading ?? title} intro={text?.description ?? copy}
    primaryLabel={text?.action ?? action} primaryHref={content?.href ?? href}
    secondaryLabel={tx(locale, { en: 'Explore destinations', es: 'Descubre los destinos', it: 'Scopri le destinazioni' })} secondaryHref="#destinations-catalogue"
    railLabel={tx(locale, { en: 'Discover Egypt', es: 'Descubre Egipto', it: 'Scopri l’Egitto' })}
    railTitle={tx(locale, { en: 'Find your next destination', es: 'Encuentra tu próximo destino', it: 'Trova la tua prossima destinazione' })}
    railHref="#destinations-catalogue" railMeta={[]}
    statsLabel={tx(locale, { en: 'Available destinations', es: 'Destinos disponibles', it: 'Destinazioni disponibili' })}
    stats={[{ value: count, label: tx(locale, { en: 'Destinations to explore', es: 'Destinos por descubrir', it: 'Destinazioni da esplorare' }) }]}
  />
}
function DestinationsPageContent({ initialDestinations, loadError }: DestinationListProps) {
  const cms = usePresentation("destinations")
 const { locale } = useLocale(); const status = usePublicDestinationsStatus(); const error = Boolean(status.error || (loadError && status.data === null)); const rows = status.data ?? (error ? undefined : initialDestinations?.map(row => localizeCatalogue(row, 'destination', locale))); const liveDestinations = (rows ?? []).filter(row => row.isPublished !== false); return <><DestinationCatalogueHero count={liveDestinations.length} eyebrow={tx(locale, { en: 'See the full picture', es: 'Mira el panorama completo', it: 'Guarda il quadro completo', ar: 'الصورة الكاملة' })} title={tx(locale, { en: 'Every destination tells a different Egypt story', es: 'Cada destino cuenta una historia distinta de Egipto', it: 'Ogni destinazione racconta una storia diversa dell\'Egitto', ar: 'كل وجهة تحكي قصة مختلفة عن مصر' })} copy={tx(locale, { en: 'Build a trip around the places that make you curious, from ancient capitals to salt-white deserts and coral-blue seas.', es: 'Crea un viaje en torno a los lugares que despierten tu curiosidad, desde capitales antiguas hasta desiertos blancos y mares de coral.', it: 'Costruisci un viaggio intorno ai luoghi che accendono la tua curiosità, dalle antiche capitali ai deserti bianchi e ai mari corallini.', ar: 'ابنِ رحلتك حول الأماكن التي تثير فضولك، من العواصم القديمة للصحارى البيضاء والشواطئ المرجانية.' })} image={siteImages.desert} href="/make-your-trip" action={tx(locale, { en: 'Build my route', es: 'Crea mi ruta', it: 'Crea il mio itinerario', ar: 'ابنِ خط سيرك' })}/><main id="destinations-catalogue" className="section container destinations-catalogue">{(error || !rows || !liveDestinations.length) && <DestinationCatalogueStatus error={error} empty={Boolean(rows && !liveDestinations.length)} retry={status.retry} />}<PresentationSection pageId="destinations" id="presentation"><div className="destination-large-grid">{liveDestinations.map(item=><article className="destination-large" key={item.slug}>{item.image && <img src={item.image} alt={item.title} loading="lazy"/>}<div><span className="eyebrow">{cms.text("presentation","description0",tx(locale, { en: 'Discover Egypt', es: 'Descubre Egipto', it: 'Scopri l\'Egitto', ar: 'اكتشف مصر' }))}</span><h2><Link href={`/destinations/${item.slug}`}>{item.title}</Link></h2><p>{item.copy}</p><Link href={`/destinations/${item.slug}`} className="text-link">{cms.text("presentation","description1",tx(locale, { en: 'Explore destination', es: 'Descubre el destino', it: 'Scopri la destinazione', ar: 'استكشف الوجهة' }))} <ArrowRight size={15}/></Link></div></article>)}</div></PresentationSection></main></> }

const destinationFactIcons = [Clock3, Sun, Compass, MapPin]

type DestinationDetailProps = { slug: string; initialDestination?: Destination; initialTours?: Tour[] }
export function DestinationDetailPage(props: DestinationDetailProps) {
  return <SiteShell><DestinationDetailContent {...props} /></SiteShell>
}
function DestinationDetailContent({ slug, initialDestination, initialTours = [] }: DestinationDetailProps) {

  const { locale } = useLocale()
  const status = usePublicDestinationsStatus()
  const tours = useDbToursStatus([], { includeNew: true })
  const [toursStarted, setToursStarted] = useState(false)
  useEffect(() => { invalidateToursCache(); setToursStarted(true) }, [])
  const liveItem = status.data === null ? (status.error ? undefined : initialDestination && localizeCatalogue(initialDestination, 'destination', locale)) : status.data.find(entry => entry.slug === slug)
  const item = liveItem && liveItem.isPublished !== false ? liveItem : undefined
  if (status.error || (!item && status.data === null)) return <DestinationCatalogueStatus error={Boolean(status.error)} retry={status.retry} />
  if (!item) return <main className="not-found"><h1>{tx(locale, { en: 'Destination not found', es: 'Destino no encontrado', it: 'Destinazione non trovata' })}</h1><Link href="/destinations" className="primary-btn">{tx(locale, { en: 'Explore destinations', es: 'Descubre los destinos', it: 'Scopri le destinazioni' })}</Link></main>
  return <DestinationDetailView item={item} relatedTours={destinationTours(item, tours.data?.length && !toursStarted ? initialTours : tours.data ?? (tours.error ? [] : initialTours))} />
}

/** Shared read-only page body. Preview passes unsaved data and never mounts catalogue/network hooks. */
export function DestinationDetailView({ item, relatedTours, preview = false }: { item: Destination; relatedTours: Tour[]; preview?: boolean }) {
  const cms = usePresentation('destination-detail')
  const { locale } = useLocale()
  const detail = item.detail

  return <>
    <main className="destination-detail-page"><PresentationOrder pageId="destination-detail">
      <section className="destination-detail-hero">
        {detail.heroImage && <img src={detail.heroImage} alt={detail.heroAlt}/>}
        <div className="destination-detail-shade"/>
        <div className="container destination-detail-hero-content">
          <nav aria-label={tx(locale, { en: 'Breadcrumb', es: 'Ruta de navegación', it: 'Percorso di navigazione', ar: 'مسار التنقل' })}><Link href="/destinations">{tx(locale, { en: 'Destinations', es: 'Destinos', it: 'Destinazioni', ar: 'الوجهات' })}</Link><span>›</span><span aria-current="page">{item.title}</span></nav>
          <span className="eyebrow">{detail.eyebrow}</span>
          <h1>{item.title}</h1>
          <p>{item.copy}</p>
          <div className="destination-hero-actions">
            <Link href="/make-your-trip" className="primary-btn">{cms.text("destination-story","planDestination",tx(locale, { en: 'Plan this destination', es: 'Planifica este destino', it: 'Pianifica questa destinazione', ar: 'خطط لهذه الوجهة' }))} <ArrowRight size={17}/></Link>
            <a href="#destination-experiences" className="destination-ghost-btn">{cms.text("destination-story","seeDestination",tx(locale, { en: 'See what awaits', es: 'Descubre lo que te espera', it: 'Scopri cosa ti aspetta', ar: 'اكتشف ما ينتظرك' }))}</a>
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

      <PresentationSection pageId="destination-detail" id="destination-story"><section className="destination-story container">
        <div>
          <span className="eyebrow">{cms.text("destination-story","description0",tx(locale, { en: 'The destination story', es: 'La historia del destino', it: 'La storia della destinazione', ar: 'حكاية الوجهة' }))}</span>
          <h2>{cms.text("destination-story","description1",tx(locale, { en: 'Come for the icons. Stay for the rhythm.', es: 'Ven por los iconos. Quédate por el ritmo.', it: 'Vieni per le icone. Resta per il ritmo.', ar: 'تعالَ للأيقونات. وابقَ للإيقاع.' }))}</h2>
          <p>{detail.intro}</p>
          <p>{cms.text("destination-story","description2",tx(locale, { en: 'We shape each day around proximity, light, energy, and the moments that deserve more than a quick stop.', es: 'Diseñamos cada día en torno a la cercanía, la luz, la energía y los momentos que merecen más que una parada rápida.', it: 'Modelliamo ogni giornata su vicinanza, luce, energia e momenti che meritano più di una sosta veloce.', ar: 'نصمم كل يوم حول القرب والإضاءة والطاقة واللحظات التي تستحق أكثر من وقفة سريعة.' }))}</p>
        </div>
        <aside>
          <span className="eyebrow">{cms.text("destination-story","description3",tx(locale, { en: 'Especially good for', es: 'Ideal para', it: 'Ideale per', ar: 'مناسبة بشكل خاص لـ' }))}</span>
          <div>{detail.bestFor.map((item) => <span key={item}><Check size={15}/>{item}</span>)}</div>
        </aside>
      </section></PresentationSection>

      <PresentationSection pageId="destination-detail" id="destination-experiences"><section id="destination-experiences" className="destination-experiences">
        <div className="container">
          <header className="destination-section-head"><div><span className="eyebrow">{cms.text("destination-experiences","description0",tx(locale, { en: 'Signature experiences', es: 'Experiencias emblemáticas', it: 'Esperienze imperdibili', ar: 'تجارب مميزة' }))}</span><h2>{cms.text("destination-experiences","description1",tx(locale, { en: 'The moments that define', es: 'Los momentos que definen', it: 'I momenti che definiscono', ar: 'اللحظات التي تميز' }))} {item.title}.</h2></div><p>{cms.text("destination-experiences","description2",tx(locale, { en: 'Not a checklist. A considered mix of landmarks, local texture, and enough space to actually feel the place.', es: 'No es una lista de tareas: es una mezcla cuidada de monumentos, ambiente local y espacio suficiente para sentir de verdad el lugar.', it: 'Non una lista di cose da spuntare, ma un mix studiato di monumenti, atmosfera locale e spazio per vivere davvero il luogo.', ar: 'ليست قائمة مهام، بل مزيج مدروس من المعالم والروح المحلية ومساحة كافية لتشعر بالمكان فعلًا.' }))}</p></header>
          <div className="destination-experience-grid">
            {detail.experiences.map((experience, index) => <article key={experience.title} className={index === 0 ? 'featured' : ''}>
              {experience.image && <img src={experience.image} alt={experience.alt} loading="lazy"/>}
              <div><span>0{index + 1}</span><h3>{experience.title}</h3><p>{experience.copy}</p></div>
            </article>)}
          </div>
        </div>
      </section></PresentationSection>

      <PresentationSection pageId="destination-detail" id="destination-rhythm"><section className="destination-rhythm container">
<div className="destination-rhythm-image">{detail.heroImage && <img src={detail.heroImage} alt={tx(locale, { en: `A memorable view of ${item.title}`, es: `Una vista inolvidable de ${item.title}`, it: `Una vista memorabile di ${item.title}`, ar: `منظر لا يُنسى من ${item.title}` })} loading="lazy"/>}<span>{cms.text("destination-rhythm","description0",tx(locale, { en: 'Suggested rhythm', es: 'Ritmo sugerido', it: 'Ritmo suggerito', ar: 'إيقاع مقترح' }))}</span></div>
        <div className="destination-rhythm-copy">
          <span className="eyebrow">{cms.text("destination-rhythm","description1",tx(locale, { en: 'A route that breathes', es: 'Una ruta que respira', it: 'Un itinerario che respira', ar: 'خط سير يتنفس' }))}</span>
          <h2>{cms.text("destination-rhythm","description2",tx(locale, { en: 'How to experience', es: 'Cómo vivir', it: 'Come vivere', ar: 'كيف تعيش' }))} {item.title} {cms.text("destination-rhythm","description3",tx(locale, { en: 'without rushing it.', es: 'sin prisas.', it: 'senza fretta.', ar: 'دون استعجال.' }))}</h2>
          <div className="destination-timeline">{detail.rhythm.map((step, index) => <article key={step.title}><b>0{index + 1}</b><div><small>{step.label}</small><h3>{step.title}</h3><p>{step.copy}</p></div></article>)}</div>
        </div>
      </section></PresentationSection>

      <PresentationSection pageId="destination-detail" id="destination-practical"><section className="destination-practical">
        <div className="container">
          <header><span className="eyebrow">{cms.text("destination-practical","description0",tx(locale, { en: 'Travel well', es: 'Viaja bien', it: 'Viaggia bene', ar: 'سافر بذكاء' }))}</span><h2>{cms.text("destination-practical","description1",tx(locale, { en: 'Small choices. Better days.', es: 'Pequeñas decisiones. Días mejores.', it: 'Piccole scelte. Giorni migliori.', ar: 'خيارات صغيرة وأيام أجمل.' }))}</h2></header>
          <div>{detail.practical.map((tip, index) => <article key={tip.title}><span>0{index + 1}</span><h3>{tip.title}</h3><p>{tip.copy}</p></article>)}</div>
        </div>
      </section></PresentationSection>

      {relatedTours.length > 0 && <PresentationSection pageId="destination-detail" id="destination-related"><section className="destination-related container">
        <header className="destination-section-head"><div><span className="eyebrow">{cms.text("destination-related","description0",tx(locale, { en: 'Travel with us', es: 'Viaja con nosotros', it: 'Viaggia con noi', ar: 'سافر معنا' }))}</span><h2>{cms.text("destination-related","description1",tx(locale, { en: 'Ways to experience', es: 'Formas de vivir', it: 'Modi per vivere', ar: 'طرق لتعيش بها' }))} {item.title}.</h2></div><CmsPublicLink href={cms.link("destination-related","links0","/egypt-tours/one-day-tours")} className="text-link">{cms.text("destination-related","description2",tx(locale, { en: 'View all tours', es: 'Ver todas las excursiones', it: 'Vedi tutti i tour', ar: 'شاهد كل الرحلات' }))} <ArrowRight size={15}/></CmsPublicLink></header>
        <div className={`destination-tour-grid${relatedTours.length === 1 ? ' single' : ''}`}>{relatedTours.map((tour) => preview ? <TourCardPresentation key={tour.slug} tour={tour} passive/> : <TourCard key={tour.slug} tour={tour}/>)}</div>
      </section></PresentationSection>}

      <PresentationSection pageId="destination-detail" id="destination-plan-cta"><section className="destination-plan-cta">
        {item.image && <img src={item.image} alt="" loading="lazy"/>}
        <div/>
        <div className="container"><span className="eyebrow">{cms.text("destination-plan-cta","description0",tx(locale, { en: 'Your Egypt, thoughtfully arranged', es: 'Tu Egipto, organizado con esmero', it: 'Il tuo Egitto, organizzato con cura', ar: 'مصر بتنظيم مدروس' }))}</span><h2>{cms.text("destination-plan-cta","description1",tx(locale, { en: 'Make', es: 'Haz de', it: 'Fai di', ar: 'اجعل' }))} {item.title} {cms.text("destination-plan-cta","description2",tx(locale, { en: 'part of a journey built around you.', es: 'parte de un viaje creado a tu medida.', it: 'parte di un viaggio costruito intorno a te.', ar: 'جزءًا من رحلة مبنية حولك.' }))}</h2><p>{cms.text("destination-plan-cta","description3",tx(locale, { en: 'Share your dates, pace, and interests. Our local team will connect the details into one smooth itinerary.', es: 'Comparte tus fechas, tu ritmo y tus intereses. Nuestro equipo local unirá los detalles en un itinerario fluido.', it: 'Condividi date, ritmo e interessi: il nostro team locale collegherà i dettagli in un itinerario fluido.', ar: 'شاركنا مواعيدك وإيقاعك واهتماماتك، وسيربط فريقنا المحلي التفاصيل في برنامج واحد سلس.' }))}</p><CmsPublicLink href={cms.link("destination-plan-cta","links0","/make-your-trip")} className="primary-btn">{cms.text("destination-plan-cta","description4",tx(locale, { en: 'Build my trip', es: 'Crea mi viaje', it: 'Crea il mio viaggio', ar: 'ابنِ رحلتي' }))} <ArrowRight size={17}/></CmsPublicLink></div>
      </section></PresentationSection>
    </PresentationOrder></main>
  </>
}
