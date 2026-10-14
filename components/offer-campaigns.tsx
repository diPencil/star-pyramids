'use client'
import { CmsPublicLink } from '@/components/cms-public-link'

import { usePresentation, PresentationSection, PresentationOrder } from '@/components/presentation-content-context'


import Link from 'next/link'
import { ArrowRight, CalendarDays, Check, Clock3, ShieldCheck, Sparkles, Tag } from 'lucide-react'
import { useDbOffers, useDbOffersStatus } from '@/lib/offers-blogs-client'
import { placedOffers, readCampaign, resolveTourCtaHref, safeCampaignHref, type CampaignPlacement } from '@/lib/marketing-campaigns'
import { useDbTours } from '@/lib/tours-client'
import { catalogTours } from '@/data/tours'
import { isOfferActive, offerHref } from '@/lib/special-offers'
import { PromotionCard, usePromotionCountdown } from './promotion-card'
import { AskQuestionButton } from './ask-question'
import { SiteShell } from './site'
import { formatPrice, tx, useLocale } from './locale'
import type { Offer } from '@/data/types'
import type { Locale } from '@/lib/locale-config'

function formatCampaignDate(value: string, locale: Locale): string {
  const day = value.slice(0, 10)
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  const intlLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB'
  return new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function useOffers(placement: CampaignPlacement) {
  const status = useDbOffersStatus()
  const rows = placedOffers(useDbOffers([]), placement)
  return { ...status, rows }
}

export function OfferCards({ placement, limit, slugs }: { placement: CampaignPlacement; limit?: number; slugs?: string[] }) {
  const { rows: sourceRows, loading, error, retry } = useOffers(placement)
  const rows = slugs === undefined ? sourceRows : slugs.flatMap((slug) => { const row = sourceRows.find((item) => item.slug === slug); return row ? [row] : [] })
  const { locale } = useLocale()
  if (loading) return <p role="status">{tx(locale, { en: 'Loading offers…', es: 'Cargando ofertas…', it: 'Caricamento offerte…', ar: 'جارٍ تحميل العروض…' })}</p>
  if (error) return <div role="alert"><p>{tx(locale, { en: 'Offers could not be loaded.', es: 'No se pudieron cargar las ofertas.', it: 'Impossibile caricare le offerte.', ar: 'تعذر تحميل العروض.' })}</p><button type="button" className="outline-btn" onClick={retry}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button></div>
  if (!rows.length) return <p className="campaign-empty">{tx(locale, { en: 'No current offers. Explore our tours or contact us to plan your trip.', es: 'No hay ofertas actuales. Explora nuestros viajes o contáctanos.', it: 'Nessuna offerta attuale. Esplora i tour o contattaci.', ar: 'لا توجد عروض حالية. تصفح الرحلات أو تواصل معنا لتخطيط رحلتك.' })}</p>
  return <div className="offer-grid">{rows.slice(0, limit).map(item => <PromotionCard key={item.slug} href={offerHref(item)} title={item.title} images={[item.image, ...(item.gallery ?? [])].filter((v, i, all) => Boolean(v) && all.indexOf(v) === i)} badge={item.badge} kicker={item.tourSlug ? tx(locale, { en: 'Tour offer', es: 'Oferta de viaje', it: 'Offerta tour', ar: 'عرض رحلة' }) : tx(locale, { en: 'Special offer', es: 'Oferta especial', it: 'Offerta speciale', ar: 'عرض خاص' })} duration={item.duration} description={item.copy} highlights={item.highlights} price={item.price} priceLabel={readCampaign(item.campaign).priceLabel} originalPrice={item.originalPrice} deadline={item.deadline} ctaLabel={tx(locale, { en: 'View offer', es: 'Ver oferta', it: 'Vedi offerta', ar: 'تفاصيل العرض' })} />)}</div>
}

export function CampaignAction({ item }: { item: Offer }) {
  const campaign = readCampaign(item.campaign)
  const { locale } = useLocale()
  const tours = useDbTours(catalogTours, { includeNew: true })
  // A linked tour wins while it stays published; otherwise the saved custom
  // URL and finally the contact fallback apply — never a broken link.
  const href = item.tourSlug ? offerHref(item) : resolveTourCtaHref(campaign.ctaTourSlug, tours) ?? (safeCampaignHref(campaign.ctaHref) ? campaign.ctaHref : `/contact?offer=${encodeURIComponent(item.slug)}`)
  const label = campaign.ctaLabel || tx(locale, { en: 'Plan my trip', es: 'Planificar mi viaje', it: 'Pianifica il mio viaggio', ar: 'خطط رحلتي' })
  return href.startsWith('/') ? <Link className="primary-btn" href={href}>{label}<ArrowRight size={16}/></Link> : <a className="primary-btn" href={href} target="_blank" rel="noopener noreferrer">{label}<ArrowRight size={16}/></a>
}

export function CampaignAdCard({ item }: { item: Offer }) {
  const { locale, currency } = useLocale()
  const campaign = readCampaign(item.campaign)
  return <article className="campaign-ad">
    {item.image && <img src={item.image} alt="" loading="lazy"/>}
    <div className="campaign-ad-content"><span className="campaign-badge">{item.badge}</span><h3><Link href={offerHref(item)}>{item.title}</Link></h3><p>{item.copy}</p>
      {item.price != null && <p className="campaign-price">{campaign.priceLabel}<strong>{formatPrice(item.price, currency, locale)}</strong></p>}
      <CampaignAction item={item}/>
    </div>
  </article>
}

export function CampaignPlacementSlot({ placement }: { placement: 'trips-sidebar' | 'blog-sidebar' }) {
  const { rows } = useOffers(placement)
  // The first active campaign wins by the admin's display order.
  return rows[0] ? <CampaignAdCard item={rows[0]}/> : null
}

export function CampaignDetail({ slug }: { slug: string }) {
  const cms = usePresentation("campaign-detail")

  const { locale, currency } = useLocale()
  const status = useDbOffersStatus()
  const found = useDbOffers([]).find(o => o.slug === slug && !o.tourSlug && isOfferActive(o))
  // Hooks must run unconditionally: the countdown hook sits above the
  // not-found early return so the hook order never changes between renders.
  const countdown = usePromotionCountdown(found?.deadline)
  const back = tx(locale, { en: 'All offers', es: 'Todas las ofertas', it: 'Tutte le offerte', ar: 'كل العروض' })
  if (!found) return <SiteShell><main className="container section"><h1>{status.loading ? cms.text("presentation","description0",tx(locale, { en: 'Loading offer…', es: 'Cargando oferta…', it: 'Caricamento offerta…', ar: 'جارٍ تحميل العرض…' })) : cms.text("presentation","description1",tx(locale, { en: 'Offer unavailable', es: 'Oferta no disponible', it: 'Offerta non disponibile', ar: 'العرض غير متاح' }))}</h1>{status.error && <button type="button" onClick={status.retry} className="outline-btn">{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button>}<Link href="/special-offers">{back}</Link></main></SiteShell>
  const item = found
  const campaign = readCampaign(item.campaign)
  const gallery = [...new Set(item.gallery ?? [])].filter(src => src && src !== item.image)
  const startsAt = item.startsAt ? formatCampaignDate(item.startsAt, locale) : ''
  const deadline = item.deadline ? formatCampaignDate(item.deadline, locale) : ''
  const countdownLabels = [
    tx(locale, { en: 'Days', es: 'Días', it: 'Giorni', ar: 'أيام' }),
    tx(locale, { en: 'Hours', es: 'Horas', it: 'Ore', ar: 'ساعات' }),
    tx(locale, { en: 'Mins', es: 'Min', it: 'Min', ar: 'دقائق' }),
    tx(locale, { en: 'Secs', es: 'Seg', it: 'Sec', ar: 'ثواني' }),
  ]
  const hasDiscount = item.price != null && item.originalPrice != null && item.originalPrice > item.price
  const facts = [
    item.duration ? { icon: Clock3, label: tx(locale, { en: 'Journey length', es: 'Duración del viaje', it: 'Durata del viaggio', ar: 'مدة الرحلة' }), value: item.duration } : null,
    deadline ? { icon: CalendarDays, label: tx(locale, { en: 'Offer available until', es: 'Oferta disponible hasta', it: 'Offerta disponibile fino al', ar: 'العرض متاح حتى' }), value: deadline } : null,
    item.price != null ? { icon: Tag, label: campaign.priceLabel || tx(locale, { en: 'Special value', es: 'Valor especial', it: 'Valore speciale', ar: 'قيمة العرض' }), value: formatPrice(item.price, currency, locale) } : null,
  ].filter((fact): fact is { icon: typeof Clock3; label: string; value: string } => fact !== null)
  return <SiteShell><main className="campaign-detail">
    <section className={`campaign-hero${item.image ? ' has-image' : ''}`} aria-labelledby="campaign-title">
      {item.image && <img className="campaign-hero-media" src={item.image} alt="" />}
      <div className="campaign-hero-shade" aria-hidden="true" />
      <div className="container">
        <nav className="campaign-breadcrumb" aria-label="Breadcrumb"><Link href="/special-offers">{back}</Link><span aria-hidden="true"> / </span><span>{item.title}</span></nav>
        <div className="campaign-hero-inner">
          <div className="campaign-hero-copy">
            <span className="campaign-hero-eyebrow"><Sparkles size={16}/>{cms.text("presentation","kicker",tx(locale, { en: 'Curated Egypt offer', es: 'Oferta seleccionada de Egipto', it: 'Offerta selezionata per l’Egitto', ar: 'عرض مختار لمصر' }))}</span>
            <h1 id="campaign-title">{item.title}</h1>
            <p>{item.copy}</p>
            {!!facts.length && <div className="campaign-hero-facts">{facts.map(({ icon: Icon, label, value }) => <div key={label}><Icon size={18}/><span><small>{label}</small><strong>{value}</strong></span></div>)}</div>}
            <span className="campaign-hero-assurance"><ShieldCheck size={16}/>{tx(locale, { en: 'Final dates, availability and inclusions are confirmed with our travel team.', es: 'Las fechas, la disponibilidad y las inclusiones finales se confirman con nuestro equipo.', it: 'Date, disponibilità e servizi finali vengono confermati con il nostro team.', ar: 'يتم تأكيد التواريخ والتوافر والتفاصيل النهائية مع فريق السفر.' })}</span>
          </div>
          <div className="campaign-hero-offer" aria-label={tx(locale, { en: 'Campaign offer', es: 'Oferta de campaña', it: 'Offerta della campagna', ar: 'عرض الحملة' })}>
            <span>{tx(locale, { en: 'Campaign offer', es: 'Oferta de campaña', it: 'Offerta della campagna', ar: 'عرض الحملة' })}</span>
            <strong>{item.badge}</strong>
            {item.price != null && <div><small>{campaign.priceLabel || tx(locale, { en: 'Your offer', es: 'Tu oferta', it: 'La tua offerta', ar: 'عرضك' })}</small>{hasDiscount && <del>{formatPrice(item.originalPrice as number, currency, locale)}</del>}<b>{formatPrice(item.price, currency, locale)}</b></div>}
          </div>
        </div>
      </div>
    </section>

    <div className="container">
      {countdown && (
        <aside className="campaign-countdown-strip" aria-label={tx(locale, { en: 'Offer countdown', es: 'Cuenta regresiva de la oferta', it: 'Conto alla rovescia dell’offerta', ar: 'العداد التنازلي للعرض' })}>
          <div className="campaign-countdown-lead">
            <Clock3 size={22} />
            <div className="campaign-countdown-text">
              <strong>{tx(locale, { en: 'Limited-time offer ends in:', es: 'Esta oferta por tiempo limitado finaliza en:', it: 'Offerta a tempo limitato scade tra:', ar: 'ينتهي هذا العرض المحدود خلال:' })}</strong>
              {deadline && <small>{tx(locale, { en: 'Valid until', es: 'Válido hasta', it: 'Valido fino al', ar: 'ساري حتى' })} {deadline}</small>}
            </div>
          </div>
          <div className="campaign-countdown-units">
            {countdown.map((value, index) => (
              <span key={countdownLabels[index]}>
                <b>{String(value).padStart(2, '0')}</b>
                <small>{countdownLabels[index]}</small>
              </span>
            ))}
          </div>
        </aside>
      )}

      <PresentationSection pageId="campaign-detail" id="campaign-story"><section className="campaign-story" aria-labelledby="campaign-story-title">
        <div className="campaign-story-copy">
          <span className="campaign-section-label">{cms.text("campaign-story","description0",tx(locale, { en: 'The offer', es: 'La oferta', it: 'L’offerta', ar: 'العرض' }))}</span>
          <h2 id="campaign-story-title">{cms.text("campaign-story","description1",tx(locale, { en: 'More value, shaped around your Egypt journey.', es: 'Más valor, diseñado para tu viaje por Egipto.', it: 'Più valore, pensato per il tuo viaggio in Egitto.', ar: 'قيمة أكبر مصممة حول رحلتك في مصر.' }))}</h2>
          <div className="campaign-prose">{(campaign.body || item.copy).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

          {!!item.highlights?.length && <PresentationSection pageId="campaign-detail" id="campaign-benefits-section"><section className="campaign-benefits-section" aria-labelledby="campaign-benefits-title">
            <div className="campaign-benefits-heading">
              <span className="campaign-section-label">{cms.text("campaign-benefits-section","description0",tx(locale, { en: 'Included value', es: 'Valor incluido', it: 'Valore incluso', ar: 'قيمة متضمنة' }))}</span>
              <h3 id="campaign-benefits-title">{cms.text("campaign-benefits-section","description1",tx(locale, { en: 'Built into this offer', es: 'Incluido en esta oferta', it: 'Incluso in questa offerta', ar: 'متضمن في هذا العرض' }))}</h3>
            </div>
            <ul className="campaign-highlights">
              {item.highlights.map((highlight, index) => (
                <li key={index}>
                  <span><Check size={16}/></span>
                  <strong>{highlight}</strong>
                </li>
              ))}
            </ul>
          </section></PresentationSection>}

          {campaign.terms && <section className="campaign-terms"><div><ShieldCheck size={22}/><h2>{tx(locale, { en: 'Offer terms', es: 'Condiciones de la oferta', it: 'Condizioni dell’offerta', ar: 'شروط العرض' })}</h2></div><p>{campaign.terms}</p></section>}
        </div>

        <aside className="campaign-booking" aria-label={tx(locale, { en: 'Offer summary', es: 'Resumen de la oferta', it: 'Riepilogo dell’offerta', ar: 'ملخص العرض' })}>
          <span className="campaign-badge">{item.badge}</span>
          <h2>{item.title}</h2>
          {item.price != null && <div className="campaign-price"><span>{campaign.priceLabel || tx(locale, { en: 'Offer price', es: 'Precio de la oferta', it: 'Prezzo dell’offerta', ar: 'سعر العرض' })}</span><div>{hasDiscount && <del>{formatPrice(item.originalPrice as number, currency, locale)}</del>}<strong>{formatPrice(item.price, currency, locale)}</strong></div></div>}
          {(startsAt || deadline || item.duration) && <dl className="campaign-summary-list">
            {startsAt && <div><dt>{tx(locale, { en: 'Starts', es: 'Comienza', it: 'Inizia', ar: 'يبدأ' })}</dt><dd><time dateTime={item.startsAt}>{startsAt}</time></dd></div>}
            {deadline && <div><dt>{tx(locale, { en: 'Ends', es: 'Finaliza', it: 'Termina', ar: 'ينتهي' })}</dt><dd><time dateTime={item.deadline}>{deadline}</time></dd></div>}
            {item.duration && <div><dt>{tx(locale, { en: 'Duration', es: 'Duración', it: 'Durata', ar: 'المدة' })}</dt><dd>{item.duration}</dd></div>}
          </dl>}
          <CampaignAction item={item}/>
          <AskQuestionButton
            tourSlug={item.slug}
            tourTitle={item.title}
            subjectType="offer"
            className="campaign-question"
            label={tx(locale, { en: 'Ask about this offer', es: 'Pregunta por esta oferta', it: 'Chiedi di questa offerta', ar: 'اسأل عن هذا العرض' })}
          />
          <CmsPublicLink className="campaign-more" href={cms.link("campaign-story","links0","/special-offers")}>{back}<ArrowRight size={15}/></CmsPublicLink>
        </aside>
      </section></PresentationSection>

      {!!gallery.length && <PresentationSection pageId="campaign-detail" id="campaign-gallery-section"><section className="campaign-gallery-section" aria-labelledby="campaign-gallery-title"><div className="campaign-section-head"><span className="campaign-section-label">{cms.text("campaign-gallery-section","description0",tx(locale, { en: 'Picture the journey', es: 'Imagina el viaje', it: 'Immagina il viaggio', ar: 'تخيل الرحلة' }))}</span><h2 id="campaign-gallery-title">{cms.text("campaign-gallery-section","description1",tx(locale, { en: 'A closer look at the experience', es: 'Una mirada más cercana a la experiencia', it: 'Uno sguardo più vicino all’esperienza', ar: 'نظرة أقرب على التجربة' }))}</h2></div><div className="campaign-gallery">{gallery.map((src, index) => <img key={src} src={src} alt={`${item.title} ${index + 1}`} loading="lazy"/>)}</div></section></PresentationSection>}
    </div>
  </main></SiteShell>
}

