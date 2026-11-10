'use client'

import { trackPublicInteraction } from "@/lib/tracking/tracking-events";
import Image from "next/image";
import Link from "next/link";
import { useState, type MouseEvent as CardMouseEvent } from "react";
import { Heart, Share2, Check, Clock3, Ship, Anchor } from "lucide-react";
import { getCruiseTypeBySlug, tourImages as images } from "@/data/tours";
import { localizeTourDuration, localizeTourLocation } from "@/lib/tours/tour-format";
import { useCustomerFavorites } from "@/lib/account/customer-account";
import type { Tour, TourVariant } from "@/data/types";
import { tx, useLocale, formatPrice } from "../locale";
import { pickLocaleText } from "@/lib/i18n/locale-config";


export function CardGallery({ images: imgs, title, href, children, onSelect }: { images: readonly string[]; title: string; href: string; children?: React.ReactNode; onSelect?: () => void }) {
  const [idx, setIdx] = useState(0)
  const scrub = (e: CardMouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setIdx(Math.min(imgs.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * imgs.length))))
  }
  return (
    <div className="card-gallery" onMouseMove={scrub} onMouseLeave={() => setIdx(0)}>
      <Link href={href} aria-label={title} className="tour-gallery-link" onClick={onSelect}>
        {imgs.map((src, i) => (
          <Image
            key={src + i}
            src={src}
            alt={i === 0 ? title : ''}
            aria-hidden={i !== 0}
            className={i === idx ? 'on' : ''}
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 25vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          />
        ))}
      </Link>
      {children}
      <div className="tour-dots" role="tablist" aria-label="Photos">
        {imgs.map((_, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === idx} aria-label={'Show photo ' + (i + 1)} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)} />
        ))}
      </div>
    </div>
  )
}

export function TourCard({ tour, variant = 'multi' }: { tour: Tour; variant?: TourVariant }) {
  const [copied, setCopied] = useState(false)
  const favorites = useCustomerFavorites()
  const { currency, locale: plc } = useLocale()
  const href = `/egypt-tours/${tour.slug}`
  const title = pickLocaleText(plc, { en: tour.title, ar: tour.titleAr })
  const saved = favorites.has(tour.slug)
  const share = async () => {
    const url = window.location.origin + href
    if (navigator.share) {
      try { await navigator.share({ title, url }) } catch { /* sharing was cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard can be unavailable */ }
  }

  return <TourCardPresentation tour={tour} variant={variant} saved={saved} copied={copied} onToggle={() => favorites.toggle(tour.slug)} onShare={share}/>
}

/** Same visual card for public interactivity and read-only editor previews. No account/network hooks. */
export function TourCardPresentation({ tour, variant = 'multi', saved = false, copied = false, onToggle, onShare, passive = false }: { tour: Tour; variant?: TourVariant; saved?: boolean; copied?: boolean; onToggle?: () => void; onShare?: () => void; passive?: boolean }) {
  const { currency, locale: plc } = useLocale()
  const href = `/egypt-tours/${tour.slug}`
  const title = pickLocaleText(plc, { en: tour.title, ar: tour.titleAr })
  const cruiseTypeInfo = variant === 'cruise' && tour.cruiseType ? getCruiseTypeBySlug(tour.cruiseType) : undefined
  let offset = 0
  for (const ch of tour.slug) offset = (offset + ch.charCodeAt(0)) % images.length
  const gallery = (tour.gallery && tour.gallery.length > 0) ? tour.gallery : [tour.image, ...images.slice(offset), ...images.slice(0, offset)].filter((src, index, all) => all.indexOf(src) === index).slice(0, 5)

  const selectTour = passive ? undefined : () => trackPublicInteraction({ event: 'sp_select_item', itemId: tour.slug })

  return <article className={`tour-card ${variant}`}>
    <div className="tour-image">
      <CardGallery images={gallery} title={title} href={href} onSelect={selectTour}>
        <button type="button" className="tour-fav" aria-label={saved ? tx(plc, { en: 'Remove from saved', es: 'Quitar de guardados', it: 'Rimuovi dai salvati', ar: 'إزالة من المحفوظات' }) : tx(plc, { en: 'Save tour', es: 'Guardar el viaje', it: 'Salva il viaggio', ar: 'حفظ الرحلة' })} aria-pressed={saved} disabled={passive} onClick={onToggle}><Heart size={17} fill={saved ? '#f7951d' : 'none'} color={saved ? '#f7951d' : '#1f2937'} strokeWidth={2} /></button>
        <button type="button" className="tour-share" aria-label={copied ? tx(plc, { en: 'Link copied', es: 'Enlace copiado', it: 'Link copiato', ar: 'تم نسخ الرابط' }) : tx(plc, { en: 'Share tour', es: 'Compartir el viaje', it: 'Condividi il viaggio', ar: 'مشاركة الرحلة' })} disabled={passive} onClick={onShare}>{copied ? <Check size={17} color="#1d4ed8" /> : <Share2 size={17} color="#1f2937" />}</button>
      </CardGallery>
    </div>
    <div className="tour-body">
      {cruiseTypeInfo ? <div className="meta cruise-meta"><span className="cities-pill">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location}</span><em>{plc === 'ar' ? cruiseTypeInfo.titleAr : cruiseTypeInfo.titleEn}</em></div> : <div className="meta">◉ {plc === 'ar' ? localizeTourLocation(tour.location) : tour.location} <em>{tour.travelStyle ?? 'Classic'}</em></div>}
      <h3><Link href={href} onClick={selectTour}>{title}</Link></h3>
      <div className="tour-bottom"><div><small>{tx(plc, { en: 'Start From', es: 'Desde', it: 'Da', ar: 'يبدأ من' })}</small><strong>{formatPrice(tour.price, currency, plc)}</strong></div><span>{variant === 'day' ? <Clock3 size={12} /> : variant === 'cruise' ? <Ship size={12} /> : variant === 'shore' ? <Anchor size={12} /> : null}{plc === 'ar' ? localizeTourDuration(tour.duration) : tour.duration}</span></div>
    </div>
  </article>
}
