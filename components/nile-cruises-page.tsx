'use client'

import Link from 'next/link'
import { Ship, ArrowRight, Star, Users, Waves, Anchor } from 'lucide-react'
import { Breadcrumb, SiteShell, HelpCTA, TourCategoryHero } from '@/components/site'
import { tx, useLocale } from '@/components/locale'
import { pickLocaleText } from '@/lib/locale-config'
import { cruiseTypes, getToursByCategory } from '@/data/tours'
import { useDbTours } from '@/lib/tours-client'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'

const iconMap: Record<string, typeof Ship> = { anchor: Anchor, star: Star, waves: Waves, ship: Ship }

const baseCopy = {
  en: { title: 'Nile Cruises', viewCruises: 'View cruises', tour: 'tour', tours: 'tours', eyebrow: 'Sail the Nile', intro: 'Choose a Nile journey from the cruises currently in our catalogue, with routes between Luxor and Aswan and options at different lengths.', feats: [{ Icon: Ship, text: 'Nile itineraries' }, { Icon: Users, text: 'Cruise options' }] },
  ar: { title: 'رحلات النيل', viewCruises: 'شاهد الرحلات', tour: 'رحلة', tours: 'رحلات', eyebrow: 'أبحر في النيل', intro: 'اختر رحلتك النيلية من الرحلات المتاحة في كتالوجنا، بمسارات بين الأقصر وأسوان ومدد مختلفة.', feats: [{ Icon: Ship, text: 'مسارات نيلية' }, { Icon: Users, text: 'خيارات متعددة' }] },
} as const

const copy = { ...baseCopy,
  es: { ...baseCopy.en, title: 'Cruceros por el Nilo', viewCruises: 'Ver cruceros', tour: 'crucero', tours: 'cruceros', eyebrow: 'Navega por el Nilo', intro: 'Elige un viaje por el Nilo entre los cruceros de nuestro catálogo, con rutas entre Luxor y Asuán y opciones de distinta duración.', feats: [{ Icon: Ship, text: 'Itinerarios por el Nilo' }, { Icon: Users, text: 'Opciones de crucero' }] },
  it: { ...baseCopy.en, title: 'Crociere sul Nilo', viewCruises: 'Vedi le crociere', tour: 'crociera', tours: 'crociere', eyebrow: 'Naviga sul Nilo', intro: 'Scegli un viaggio sul Nilo tra le crociere del nostro catalogo, con rotte tra Luxor e Assuan e opzioni di diversa durata.', feats: [{ Icon: Ship, text: 'Itinerari sul Nilo' }, { Icon: Users, text: 'Opzioni di crociera' }] },
} as const

export function NileCruisesPage() {
  return <SiteShell><NileCruisesContent/></SiteShell>
}

function NileCruisesContent() {
  const { locale } = useLocale()
  const t = copy[locale]
  const allCruises = useDbTours(cruiseTypes.flatMap((type) => getToursByCategory('nile-cruises').filter((tour) => tour.cruiseType === type.slug)))
  const featured = allCruises[0]

  return <>
    <TourCategoryHero
      image={featured.image}
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      primaryLabel={tx(locale, { en: 'Explore cruise styles', es: 'Explora los estilos de crucero', it: 'Esplora gli stili di crociera', ar: 'استكشف أنواع الكروز' })}
      primaryHref="#cruise-types"
      featuredLabel={tx(locale, { en: 'Featured Nile cruise', es: 'Crucero destacado por el Nilo', it: 'Crociera sul Nilo in evidenza', ar: 'كروز مميز' })}
      featuredTitle={pickLocaleText(locale, { en: featured.title, ar: featured.titleAr })}
      featuredHref={`/egypt-tours/${featured.slug}`}
      featuredLocation={locale === 'ar' ? localizeTourLocation(featured.location) : featured.location}
      featuredDuration={locale === 'ar' ? localizeTourDuration(featured.duration) : featured.duration}
      statsLabel={tx(locale, { en: 'Nile cruises summary', es: 'Resumen de cruceros por el Nilo', it: 'Riepilogo delle crociere sul Nilo', ar: 'ملخص رحلات النيل' })}
      stats={[
        { value: allCruises.length, label: tx(locale, { en: 'Cruises available', es: 'Cruceros disponibles', it: 'Crociere disponibili', ar: 'رحلات متاحة' }) },
        { value: cruiseTypes.length, label: tx(locale, { en: 'Cruise styles', es: 'Estilos de crucero', it: 'Stili di crociera', ar: 'أنواع كروز' }) },
      ]}
    />
    <Breadcrumb items={['Egypt Tours', 'Nile Cruises']}/>
    <main id="cruise-types" className="listing-page container">
      <div className="cruise-categories-grid">
        {cruiseTypes.map((ct) => {
          const Icon = iconMap[ct.icon] ?? Ship
          const count = allCruises.filter((tour) => tour.cruiseType === ct.slug).length
          return <Link key={ct.slug} href={`/egypt-tours/nile-cruises/${ct.slug}`} className="cruise-cat-card">
            <div className="cruise-cat-img">
              <img src={ct.image} alt={locale === 'ar' ? ct.titleAr : ct.titleEn} loading="lazy"/>
              <div className="cruise-cat-overlay"/>
              <span className="cruise-cat-badge"><Icon size={15}/> {locale === 'ar' ? ct.titleAr : ct.titleEn}</span>
            </div>
            <div className="cruise-cat-body">
              <h3>{locale === 'ar' ? ct.titleAr : ct.titleEn}</h3>
              <p>{locale === 'ar' ? ct.descAr : ct.descEn}</p>
              <span className="cruise-cat-count">{count} {count === 1 ? t.tour : t.tours}</span>
              <ul className="cruise-cat-features">
                {(locale === 'ar' ? ct.featuresAr : ct.featuresEn).map((f) => <li key={f}>{f}</li>)}
              </ul>
              <span className="cruise-cat-cta">{t.viewCruises} <ArrowRight size={15}/></span>
            </div>
          </Link>
        })}
      </div>
    </main>
    <HelpCTA/>
  </>
}
