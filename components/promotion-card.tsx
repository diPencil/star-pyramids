'use client'

import Link from 'next/link'
import { offerDeadline } from '@/lib/special-offers'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Star } from 'lucide-react'
import { CardGallery } from '@/components/site'
import { formatPrice, useLocale, tx } from './locale'
import type { Tour } from '@/data/types'

export function promotionGalleryForTour(tour: Tour, fallbackImages: readonly string[]) {
  // Stored galleries arrive decoded as arrays; an empty gallery (or a legacy
  // undecoded payload) must fall through to the cover + static fallbacks
  // instead of rendering an empty CardGallery. Empty sources can never
  // become a blank first slide.
  if (tour.gallery?.length) return tour.gallery
  let offset = 0
  for (const character of tour.slug) offset = (offset + character.charCodeAt(0)) % fallbackImages.length
  return [tour.image, ...fallbackImages.slice(offset), ...fallbackImages.slice(0, offset)]
    .filter((source): source is string => typeof source === 'string' && source.length > 0)
    .filter((source, index, all) => all.indexOf(source) === index)
    .slice(0, 5)
}

type PromotionCardProps = {
  href: string
  title: string
  images: readonly string[]
  badge?: string
  kicker: string
  duration?: string
  rating?: number
  deadline?: string
  countdownLabels?: readonly [string, string, string, string]
  description?: string
  highlights?: readonly string[]
  price?: number
  priceLabel?: string
  originalPrice?: number
  ctaLabel?: string
}

function usePromotionCountdown(deadline?: string) {
  const [parts, setParts] = useState<number[] | null>(null)

  useEffect(() => {
    if (!deadline) return
    const calculate = () => {
      const difference = Math.max(0, offerDeadline(deadline) - Date.now())
      return [
        Math.floor(difference / 86400000),
        Math.floor(difference / 3600000) % 24,
        Math.floor(difference / 60000) % 60,
        Math.floor(difference / 1000) % 60,
      ]
    }
    setParts(calculate())
    const timer = window.setInterval(() => setParts(calculate()), 1000)
    return () => window.clearInterval(timer)
  }, [deadline])

  return parts
}

export function PromotionCard({
  href,
  title,
  images,
  badge,
  kicker,
  duration,
  rating,
  deadline,
  countdownLabels,
  description,
  highlights,
  price,
  priceLabel,
  originalPrice,
  ctaLabel,
}: PromotionCardProps) {
  const { currency, locale } = useLocale()
  const countdown = usePromotionCountdown(deadline)
  const hasCommercialMeta = duration || typeof rating === 'number'
  // Genuinely imageless offers keep a branded panel with their own title —
  // never a blank 190px box, never invented imagery.
  const safeImages = images.filter((source): source is string => typeof source === 'string' && source.length > 0)

  const resolvedCountdownLabels = countdownLabels ?? [
    tx(locale, { en: 'Days', es: 'Días', it: 'Giorni', ar: 'أيام' }),
    tx(locale, { en: 'Hours', es: 'Horas', it: 'Ore', ar: 'ساعات' }),
    tx(locale, { en: 'Mins', es: 'Min', it: 'Min', ar: 'دقايق' }),
    tx(locale, { en: 'Secs', es: 'Seg', it: 'Sec', ar: 'ثواني' }),
  ]

  return <article className="offer-card">
    <div className="offer-image">
      {safeImages.length ? (
        <CardGallery images={safeImages} title={title} href={href}>{badge && <b>{badge}</b>}</CardGallery>
      ) : (
        <div className="offer-image-fallback" role="img" aria-label={title}><span>{kicker}</span><strong>{title}</strong></div>
      )}
    </div>
    <div className="offer-card-body">
      <span>{kicker}</span>
      <h3><Link href={href}>{title}</Link></h3>
      {hasCommercialMeta && <small>{duration}{duration && typeof rating === 'number' ? ', ' : ''}{typeof rating === 'number' && <>{rating.toFixed(1)} <Star size={13} fill="#f7951d" color="#f7951d"/></>}</small>}
      {description && <p className="offer-card-copy">{description}</p>}
      {countdown && <div className="offer-countdown">{countdown.map((value, index) => <span key={resolvedCountdownLabels[index]}><b>{String(value).padStart(2, '0')}</b><small>{resolvedCountdownLabels[index]}</small></span>)}</div>}
      {highlights && <ul className="offer-card-highlights">{highlights.map((highlight) => <li key={highlight}><Check size={14}/>{highlight}</li>)}</ul>}
      {typeof price === 'number' && priceLabel && <small>{priceLabel}</small>}
      {typeof price === 'number' && <strong>{typeof originalPrice === 'number' && originalPrice > price && <><del>{formatPrice(originalPrice, currency, locale)}</del>{' '}</>}{formatPrice(price, currency, locale)}</strong>}
      {ctaLabel && <Link className="offer-card-cta" href={href}>{ctaLabel}<ArrowRight size={15}/></Link>}
    </div>
  </article>
}
