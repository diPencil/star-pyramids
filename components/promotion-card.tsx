'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Star } from 'lucide-react'
import { CardGallery } from '@/components/site'
import { formatPrice, useLocale } from './locale'
import type { Tour } from '@/data/types'

export function promotionGalleryForTour(tour: Tour, fallbackImages: readonly string[]) {
  if (tour.gallery) return tour.gallery
  let offset = 0
  for (const character of tour.slug) offset = (offset + character.charCodeAt(0)) % fallbackImages.length
  return [tour.image, ...fallbackImages.slice(offset), ...fallbackImages.slice(0, offset)]
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
  originalPrice?: number
  ctaLabel?: string
}

function usePromotionCountdown(deadline?: string) {
  const [parts, setParts] = useState<number[] | null>(null)

  useEffect(() => {
    if (!deadline) return
    const calculate = () => {
      const difference = Math.max(0, new Date(deadline).getTime() - Date.now())
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
  countdownLabels = ['Days', 'Hours', 'Mins', 'Secs'],
  description,
  highlights,
  price,
  originalPrice,
  ctaLabel,
}: PromotionCardProps) {
  const { currency, locale } = useLocale()
  const countdown = usePromotionCountdown(deadline)
  const hasCommercialMeta = duration || typeof rating === 'number'

  return <article className="offer-card">
    <div className="offer-image">
      <CardGallery images={images} title={title} href={href}>{badge && <b>{badge}</b>}</CardGallery>
    </div>
    <div className="offer-card-body">
      <span>{kicker}</span>
      <h3><Link href={href}>{title}</Link></h3>
      {hasCommercialMeta && <small>{duration}{duration && typeof rating === 'number' ? ', ' : ''}{typeof rating === 'number' && <>{rating.toFixed(1)} <Star size={13} fill="#f7951d" color="#f7951d"/></>}</small>}
      {description && <p className="offer-card-copy">{description}</p>}
      {countdown && <div className="offer-countdown">{countdown.map((value, index) => <span key={countdownLabels[index]}><b>{String(value).padStart(2, '0')}</b><small>{countdownLabels[index]}</small></span>)}</div>}
      {highlights && <ul className="offer-card-highlights">{highlights.map((highlight) => <li key={highlight}><Check size={14}/>{highlight}</li>)}</ul>}
      {typeof price === 'number' && <strong>{typeof originalPrice === 'number' && originalPrice > price && <><del>{formatPrice(originalPrice, currency, locale)}</del>{' '}</>}{formatPrice(price, currency, locale)}</strong>}
      {ctaLabel && <Link className="offer-card-cta" href={href}>{ctaLabel}<ArrowRight size={15}/></Link>}
    </div>
  </article>
}
