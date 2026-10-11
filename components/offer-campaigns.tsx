'use client'

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { useDbOffers, useDbOffersStatus } from '@/lib/offers-blogs-client'
import { placedOffers, readCampaign, safeCampaignHref, type CampaignPlacement } from '@/lib/marketing-campaigns'
import { isOfferActive, offerHref } from '@/lib/special-offers'
import { PromotionCard } from './promotion-card'
import { SiteShell } from './site'
import { formatPrice, tx, useLocale } from './locale'
import type { Offer } from '@/data/types'

function useOffers(placement: CampaignPlacement) {
  const status = useDbOffersStatus()
  const rows = placedOffers(useDbOffers([]), placement)
  return { ...status, rows }
}

export function OfferCards({ placement, limit }: { placement: CampaignPlacement; limit?: number }) {
  const { rows, loading, error, retry } = useOffers(placement)
  const { locale } = useLocale()
  if (loading) return <p role="status">{tx(locale, { en: 'Loading offers…', es: 'Cargando ofertas…', it: 'Caricamento offerte…', ar: 'جارٍ تحميل العروض…' })}</p>
  if (error) return <div role="alert"><p>{tx(locale, { en: 'Offers could not be loaded.', es: 'No se pudieron cargar las ofertas.', it: 'Impossibile caricare le offerte.', ar: 'تعذر تحميل العروض.' })}</p><button className="outline-btn" onClick={retry}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button></div>
  if (!rows.length) return <p className="campaign-empty">{tx(locale, { en: 'No current offers. Explore our tours or contact us to plan your trip.', es: 'No hay ofertas actuales. Explora nuestros viajes o contáctanos.', it: 'Nessuna offerta attuale. Esplora i tour o contattaci.', ar: 'لا توجد عروض حالية. تصفح الرحلات أو تواصل معنا لتخطيط رحلتك.' })}</p>
  return <div className="offer-grid">{rows.slice(0, limit).map(item => <PromotionCard key={item.slug} href={offerHref(item)} title={item.title} images={[item.image, ...(item.gallery ?? [])].filter((v, i, all) => Boolean(v) && all.indexOf(v) === i)} badge={item.badge} kicker={item.tourSlug ? tx(locale, { en: 'Tour offer', es: 'Oferta de viaje', it: 'Offerta tour', ar: 'عرض رحلة' }) : tx(locale, { en: 'Special offer', es: 'Oferta especial', it: 'Offerta speciale', ar: 'عرض خاص' })} duration={item.duration} description={item.copy} highlights={item.highlights} price={item.price} priceLabel={readCampaign(item.campaign).priceLabel} originalPrice={item.originalPrice} deadline={item.deadline} ctaLabel={tx(locale, { en: 'View offer', es: 'Ver oferta', it: 'Vedi offerta', ar: 'تفاصيل العرض' })} />)}</div>
}

export function CampaignAction({ item }: { item: Offer }) {
  const campaign = readCampaign(item.campaign)
  const { locale } = useLocale()
  const href = item.tourSlug ? offerHref(item) : safeCampaignHref(campaign.ctaHref) ? campaign.ctaHref : `/contact?offer=${encodeURIComponent(item.slug)}`
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
  const { locale, currency } = useLocale()
  const status = useDbOffersStatus()
  const item = useDbOffers([]).find(o => o.slug === slug && !o.tourSlug && isOfferActive(o))
  const back = tx(locale, { en: 'All offers', es: 'Todas las ofertas', it: 'Tutte le offerte', ar: 'كل العروض' })
  if (!item) return <SiteShell><main className="container section"><h1>{status.loading ? tx(locale, { en: 'Loading offer…', es: 'Cargando oferta…', it: 'Caricamento offerta…', ar: 'جارٍ تحميل العرض…' }) : tx(locale, { en: 'Offer unavailable', es: 'Oferta no disponible', it: 'Offerta non disponibile', ar: 'العرض غير متاح' })}</h1>{status.error && <button onClick={status.retry} className="outline-btn">{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova', ar: 'إعادة المحاولة' })}</button>}<Link href="/special-offers">{back}</Link></main></SiteShell>
  const campaign = readCampaign(item.campaign)
  const gallery = [...new Set(item.gallery ?? [])].filter(src => src && src !== item.image)
  return <SiteShell><main className="campaign-detail">
    <div className="container"><nav className="campaign-breadcrumb" aria-label="Breadcrumb"><Link href="/special-offers">{back}</Link><span aria-hidden="true"> / </span><span>{item.title}</span></nav>
      <section className="campaign-hero"><div className="campaign-hero-copy"><span className="campaign-badge">{item.badge}</span><h1>{item.title}</h1><p>{item.copy}</p>{item.duration && <span>{item.duration}</span>}<CampaignAction item={item}/></div><div className="campaign-hero-media">{item.image ? <img src={item.image} alt={item.title}/> : <span>{item.title}</span>}</div></section>
      <div className="campaign-detail-layout"><article>
        {campaign.body && <section className="campaign-prose">{campaign.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</section>}
        {!!item.highlights?.length && <section><h2>{tx(locale, { en: 'What makes this offer special', es: 'Qué hace especial esta oferta', it: 'Cosa rende speciale questa offerta', ar: 'مميزات العرض' })}</h2><ul className="campaign-highlights">{item.highlights.map((h, i) => <li key={i}><Check size={18}/><span>{h}</span></li>)}</ul></section>}
        {!!gallery.length && <div className="campaign-gallery">{gallery.map(src => <img key={src} src={src} alt={item.title} loading="lazy"/>)}</div>}
        {campaign.terms && <section className="campaign-prose"><h2>{tx(locale, { en: 'Offer terms', es: 'Condiciones de la oferta', it: 'Condizioni dell’offerta', ar: 'شروط العرض' })}</h2><p>{campaign.terms}</p></section>}
      </article><aside className="campaign-booking"><span className="campaign-badge">{item.badge}</span><h2>{item.title}</h2>{item.price != null && <div className="campaign-price"><span>{campaign.priceLabel}</span>{item.originalPrice != null && item.originalPrice > item.price && <del>{formatPrice(item.originalPrice, currency, locale)}</del>}<strong>{formatPrice(item.price, currency, locale)}</strong></div>}{item.deadline && <p>{tx(locale, { en: 'Available until', es: 'Disponible hasta', it: 'Disponibile fino al', ar: 'متاح حتى' })} <time dateTime={item.deadline}>{item.deadline.slice(0, 10)}</time></p>}<CampaignAction item={item}/><Link className="campaign-more" href="/special-offers">{back}<ArrowRight size={15}/></Link></aside></div>
    </div>
  </main></SiteShell>
}

