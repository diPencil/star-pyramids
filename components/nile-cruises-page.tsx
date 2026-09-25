'use client'

import Link from 'next/link'
import { Ship, ArrowRight, Star, Users, Waves, Anchor } from 'lucide-react'
import { Breadcrumb, SiteShell, HelpCTA, TourCategoryHero } from '@/components/site'
import { useLocale } from '@/components/locale'
import { cruiseTypes, getCruisesByType } from '@/data/tours'
import { localizeTourDuration, localizeTourLocation } from '@/lib/tour-format'

const iconMap: Record<string, typeof Ship> = { anchor: Anchor, star: Star, waves: Waves, ship: Ship }

const copy = {
  en: { title: 'Nile Cruises', viewCruises: 'View cruises', tour: 'tour', tours: 'tours', eyebrow: 'Sail the Nile', intro: 'Choose a Nile journey from the cruises currently in our catalogue, with routes between Luxor and Aswan and options at different lengths.', feats: [{ Icon: Ship, text: 'Nile itineraries' }, { Icon: Users, text: 'Cruise options' }] },
  ar: { title: 'رحلات النيل', viewCruises: 'شاهد الرحلات', tour: 'رحلة', tours: 'رحلات', eyebrow: 'أبحر في النيل', intro: 'اختر رحلتك النيلية من الرحلات المتاحة في كتالوجنا، بمسارات بين الأقصر وأسوان ومدد مختلفة.', feats: [{ Icon: Ship, text: 'مسارات نيلية' }, { Icon: Users, text: 'خيارات متعددة' }] },
} as const

export function NileCruisesPage() {
  return <SiteShell><NileCruisesContent/></SiteShell>
}

function NileCruisesContent() {
  const { locale } = useLocale()
  const t = copy[locale]
  const allCruises = cruiseTypes.flatMap((type) => getCruisesByType(type.slug))
  const featured = allCruises[0]

  return <>
    <TourCategoryHero
      image={featured.image}
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      primaryLabel={locale === 'ar' ? 'استكشف أنواع الكروز' : 'Explore cruise styles'}
      primaryHref="#cruise-types"
      featuredLabel={locale === 'ar' ? 'كروز مميز' : 'Featured Nile cruise'}
      featuredTitle={locale === 'ar' && featured.titleAr ? featured.titleAr : featured.title}
      featuredHref={`/egypt-tours/${featured.slug}`}
      featuredLocation={locale === 'ar' ? localizeTourLocation(featured.location) : featured.location}
      featuredDuration={locale === 'ar' ? localizeTourDuration(featured.duration) : featured.duration}
      statsLabel={locale === 'ar' ? 'ملخص رحلات النيل' : 'Nile cruises summary'}
      stats={[
        { value: allCruises.length, label: locale === 'ar' ? 'رحلات متاحة' : 'Cruises available' },
        { value: cruiseTypes.length, label: locale === 'ar' ? 'أنواع كروز' : 'Cruise styles' },
      ]}
    />
    <Breadcrumb items={['Egypt Tours', 'Nile Cruises']}/>
    <main id="cruise-types" className="listing-page container">
      <div className="cruise-categories-grid">
        {cruiseTypes.map((ct) => {
          const Icon = iconMap[ct.icon] ?? Ship
          const count = getCruisesByType(ct.slug).length
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
