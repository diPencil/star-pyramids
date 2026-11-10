'use client'

import { EmptyOffersHero } from "../cars/empty-fleet-hero";
import { CmsPublicLink } from "@/components/cms/cms-public-link";
import { usePresentation, PresentationSection, PresentationOrder } from "@/components/cms/presentation-content-context";
import { OfferCards, CampaignDetail } from "./offer-campaigns";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { siteImages } from "@/data/content";
import { placedOffers } from "@/lib/marketing/marketing-campaigns";
import { useDbOffers } from "@/lib/catalogue/offers-blogs-client";
import { useDbTours } from "@/lib/tours/tours-client";
import { useLocale, tx } from "../locale";
import { PageShowcaseHero, SiteShell } from "@/components/site";


export function OffersPage() {
  return <SiteShell><OffersPageContent /></SiteShell>
}

function OffersPageContent() {
  const cms = usePresentation("offers")

  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveTours = useDbTours([], { includeNew: true })
  const dbOffers = placedOffers(useDbOffers([]), 'offers')
  const featured = liveTours.find(tour => dbOffers.some(offer => offer.tourSlug === tour.slug)) ?? liveTours[0]
  const tourOfferCount = dbOffers.filter(offer => offer.tourSlug).length
  const campaignCount = dbOffers.length - tourOfferCount
  return <main className="offers-page"><PresentationOrder pageId="offers">
      {!featured && <EmptyOffersHero />}
      {featured && <PageShowcaseHero image={featured.image} eyebrow={tx(locale, { en: 'Curated Egypt savings', es: 'Ahorros seleccionados en Egipto', it: 'Risparmi selezionati in Egitto', ar: 'توفير مختار بعناية في مصر' })} title={tx(locale, { en: 'Egypt travel offers worth packing for.', es: 'Ofertas de viaje a Egipto por las que merece la pena hacer la maleta.', it: 'Offerte di viaggio in Egitto per cui vale la pena fare le valigie.', ar: 'عروض سفر في مصر تستاهل تجهزلها شنطة.' })} intro={tx(locale, { en: 'More nights, thoughtful extras, and memorable combinations designed to give your Egypt journey more value.', es: 'Más noches, extras con encanto y combinaciones memorables para dar más valor a tu viaje a Egipto.', it: 'Più notti, extra pensati e combinazioni memorabili per dare più valore al tuo viaggio in Egitto.', ar: 'ليالٍ أكثر وإضافات مدروسة وتركيبات لا تُنسى تمنح رحلتك لمصر قيمة أكبر.' })} primaryLabel={tx(locale, { en: 'Explore current offers', es: 'Descubre las ofertas actuales', it: 'Scopri le offerte attuali', ar: 'استكشف العروض الحالية' })} primaryHref="#current-offers" secondaryLabel={tx(locale, { en: 'View the featured package', es: 'Ver el paquete destacado', it: 'Vedi il pacchetto in evidenza', ar: 'شاهد الباقة المميزة' })} secondaryHref={`/egypt-tours/${featured.slug}`} railLabel={tx(locale, { en: 'Featured package', es: 'Paquete destacado', it: 'Pacchetto in evidenza', ar: 'باقة مميزة' })} railTitle={(locale === 'ar' ? featured.titleAr : undefined) || featured.title} railHref={`/egypt-tours/${featured.slug}`} railMeta={[{ Icon: Clock3, label: featured.duration }, { Icon: MapPin, label: featured.location }]} statsLabel={tx(locale, { en: 'Offers summary', es: 'Resumen de ofertas', it: 'Riepilogo offerte', ar: 'ملخص العروض' })} stats={[{ value: tourOfferCount, label: tx(locale, { en: 'Tour offers', es: 'Ofertas de viaje', it: 'Offerte tour', ar: 'عروض رحلات' }) }, { value: campaignCount, label: tx(locale, { en: 'Travel campaigns', es: 'Campañas de viaje', it: 'Campagne di viaggio', ar: 'حملات سفر' }) }]}/>}

      <PresentationSection pageId="offers" id="offers-trust"><section className="offers-trust" aria-label={tx(locale, { en: 'Booking benefits', es: 'Ventajas de reservar', it: 'Vantaggi della prenotazione', ar: 'مميزات الحجز' })}>
        <div className="container">{cms.cards("offers-trust").map(({id,title,copy,Icon})=><div key={id}><Icon size={22}/><span><strong>{title}</strong><small>{copy}</small></span></div>)}</div>
      </section></PresentationSection>

      <PresentationSection pageId="offers" id="current-offers"><section id="current-offers" className="offers-current container">
        <header className="offers-section-head">
          <div><span className="eyebrow">{cms.text("current-offers","description0",tx(locale, { en: 'Current opportunities', es: 'Oportunidades actuales', it: 'Opportunità attuali', ar: 'فرص حالية' }))}</span><h2>{cms.text("current-offers","description1",tx(locale, { en: 'Choose the value that fits your journey.', es: 'Elige el valor que encaje con tu viaje.', it: 'Scegli il valore adatto al tuo viaggio.', ar: 'اختر القيمة المناسبة لرحلتك.' }))}</h2></div>
          <p>{cms.text("current-offers","description2",tx(locale, { en: 'Every offer can be shaped around your dates, group, and preferred pace. Ask our team for the exact inclusions before you commit.', es: 'Cada oferta puede adaptarse a tus fechas, tu grupo y tu ritmo. Pregunta a nuestro equipo por las inclusiones exactas antes de decidirte.', it: 'Ogni offerta può essere modellata su date, gruppo e ritmo. Chiedi al nostro team le inclusioni esatte prima di impegnarti.', ar: 'كل عرض يمكن تشكيله حول مواعيدك ومجموعتك وإيقاعك المفضل. اسأل فريقنا عن المشمول الدقيق قبل الحجز.' }))}</p>
        </header>

        <OfferCards placement="offers"/>
      </section></PresentationSection>

      <PresentationSection pageId="offers" id="offers-process"><section className="offers-process">
        <div className="container">
          <header><span className="eyebrow">{cms.text("offers-process","description0",tx(locale, { en: 'Simple and personal', es: 'Sencillo y personal', it: 'Semplice e personale', ar: 'بسيط وشخصي' }))}</span><h2>{cms.text("offers-process","description1",tx(locale, { en: 'From offer to confirmed journey.', es: 'De la oferta al viaje confirmado.', it: 'Dall\'offerta al viaggio confermato.', ar: 'من العرض لرحلة مؤكدة.' }))}</h2></header>
        <div className="offers-process-grid">{cms.cards("offers-process").map(({id,title,copy,number})=><div key={id}><strong>{number}</strong><h3>{title}</h3><p>{copy}</p></div>)}</div>
        </div>
      </section></PresentationSection>

      <PresentationSection pageId="offers" id="offers-final"><section className="offers-final">
        <img src={cms.media("offers-final","media0",siteImages.nile)} alt={cms.text("offers-final","description0",tx(locale, { en: 'A Nile journey through Egypt', es: 'Un viaje por el Nilo en Egipto', it: 'Un viaggio sul Nilo in Egitto', ar: 'رحلة نيلية في مصر' }))} loading="lazy"/>
        <div className="offers-final-shade"/>
        <div className="container offers-final-content">
          <span className="eyebrow">{cms.text("offers-final","description1",tx(locale, { en: 'Need a different kind of value?', es: '¿Buscas otro tipo de valor?', it: 'Cerchi un altro tipo di valore?', ar: 'هل تحتاج إلى نوع مختلف من القيمة؟' }))}</span>
          <h2>{cms.text("offers-final","description2",tx(locale, { en: 'Let us shape an offer around your Egypt plans.', es: 'Diseñemos una oferta en torno a tus planes en Egipto.', it: 'Creiamo un\'offerta intorno ai tuoi piani in Egitto.', ar: 'دعنا نصمم عرضًا حول خططك لمصر.' }))}</h2>
          <p>{cms.text("offers-final","description3",tx(locale, { en: 'Tell us your dates, group size, and wish list. Our travel designers will recommend the best available route and inclusions.', es: 'Cuéntanos tus fechas, el tamaño del grupo y tu lista de deseos. Nuestros diseñadores de viajes te recomendarán la mejor ruta y las mejores inclusiones disponibles.', it: 'Dicci date, numero di partecipanti e desideri: i nostri travel designer consiglieranno il miglior itinerario e le migliori inclusioni disponibili.', ar: 'أخبرنا بمواعيدك وحجم مجموعتك وقائمة أمنياتك. سيرشح لك مصممو رحلاتنا أفضل خط سير ومشمول متاح.' }))}</p>
          <CmsPublicLink href={cms.link("offers-final","links0","/make-your-trip")} className="primary-btn">{cms.text("offers-final","description4",tx(locale, { en: 'Make your trip', es: 'Crea tu viaje', it: 'Crea il tuo viaggio', ar: 'خطط رحلتك' }))} <ArrowRight size={17}/></CmsPublicLink>
        </div>
      </section></PresentationSection>
    </PresentationOrder></main>
}



export function OfferDetailPage({ slug }: { slug: string }) { return <CampaignDetail slug={slug}/> }
