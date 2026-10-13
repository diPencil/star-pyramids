"use client"

import { useMemo } from "react"
import { ExternalLink, Play } from "lucide-react"
import type { TourJourneyVideo, TourVideoPlatform } from "@/data/types"
import { HorizontalSlider } from "./horizontal-slider"
import { tx } from "./locale"
import { pickLocaleText, type Locale } from '@/lib/locale-config'
import { useMergedTourVideos, useTourGalleryVideos } from "@/lib/journey-gallery-client"

type VideoSource = {
  kind: "embed" | "direct" | "external"
  platform: TourVideoPlatform | "external"
  src: string
}

const platformNames: Record<VideoSource["platform"], string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  vimeo: "Vimeo",
  direct: "Video",
  external: "Video",
}

function formattedDate(value: string, locale: Locale) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const intlLocale = locale === 'ar' ? 'ar-EG' : locale === 'es' ? 'es-ES' : locale === 'it' ? 'it-IT' : 'en-GB'
  return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", year: "numeric" }).format(date)
}

// Fully database-driven: centralized gallery videos (global + assigned to
// this tour) merged with the tour's legacy `journeyVideos` JSON (gallery
// first, legacy deduped by normalized URL). No placeholder reels, no mock
// platform cards, no dashboard notes. When no real video exists the section
// stays visible with its heading and one honest visitor-facing message.
// Without a tourSlug the legacy list renders alone.
export function TourVideoGallery({ videos, locale, tourTitle, tourSlug }: { videos?: readonly TourJourneyVideo[]; locale: Locale; tourTitle: string; tourSlug?: string }) {
  const galleryVideos = useTourGalleryVideos(tourSlug ?? '', videos ?? [])
  const items = useMergedTourVideos(galleryVideos, useMemo(() => [...(videos ?? [])]
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)), [videos]))

  const previousLabel = tx(locale, { en: "Previous video", es: "Vídeo anterior", it: "Video precedente", ar: "الفيديو السابق" })
  const nextLabel = tx(locale, { en: "Next video", es: "Vídeo siguiente", it: "Video successivo", ar: "الفيديو التالي" })

  const heading = <div className="tour-video-heading">
    <div>
      <span>{tx(locale, { en: "Newest stories first", es: "Historias recientes primero", it: "Le storie più recenti prima", ar: "أحدث الفيديوهات أولاً" })}</span>
      <h2 id="journey-videos-title">{tx(locale, { en: "Gallery of Exciting Journeys", es: "Galería de viajes fascinantes", it: "Galleria di viaggi emozionanti", ar: "فيديوهات من رحلاتنا" })}</h2>
      <p>{tx(locale, { en: `Real moments from ${tourTitle}, collected from our social channels.`, es: `Momentos reales de ${tourTitle}, recogidos de nuestros canales sociales.`, it: `Momenti autentici di ${tourTitle}, raccolti dai nostri canali social.`, ar: "لحظات حقيقية من هذه الرحلة عبر منصاتنا." })}</p>
    </div>
  </div>

  if (!items.length) return <section className="tour-content-section tour-video-section" aria-labelledby="journey-videos-title">
    {heading}
    <div className="tour-video-empty" role="status"><Play size={22} fill="currentColor"/><span>{tx(locale, { en: "No journey videos available right now. Check back soon.", es: "Aún no hay vídeos del viaje; vuelve pronto.", it: "Ancora nessun video del viaggio; torna presto.", ar: "لا توجد فيديوهات حالياً. عد قريباً." })}</span></div>
  </section>

  return <section className="tour-content-section tour-video-section" aria-labelledby="journey-videos-title">
    {heading}
    <HorizontalSlider className="tour-video-track" ariaLabel={tx(locale, { en: "Journey videos", es: "Vídeos del viaje", it: "Video del viaggio", ar: "فيديوهات الرحلة" })} previousLabel={previousLabel} nextLabel={nextLabel}>
      {items.map((entry) => {
        const title = pickLocaleText(locale, { en: entry.title, ar: entry.titleAr ?? undefined })
        const date = entry.date ? formattedDate(entry.date, locale) : null
        return <article className="tour-video-reel" key={entry.key}>
          <div className="tour-video-frame">
            {entry.source.kind === "embed" && <iframe title={title} src={entry.source.src} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}
            {entry.source.kind === "direct" && <video controls playsInline preload="metadata" poster={entry.thumbnail ?? undefined}><source src={entry.source.src}/>{tx(locale, { en: "Your browser does not support video playback.", es: "Tu navegador no admite la reproducción de vídeo.", it: "Il tuo browser non supporta la riproduzione video.", ar: "متصفحك لا يدعم تشغيل الفيديو." })}</video>}
            {entry.source.kind === "external" && <a href={entry.source.src} target="_blank" rel="noopener noreferrer" className="tour-video-external"><span><Play size={28} fill="currentColor"/></span><b>{tx(locale, { en: "Watch on the original platform", es: "Ver en la plataforma original", it: "Guarda sulla piattaforma originale", ar: "شاهد الفيديو على المنصة" })}</b><ExternalLink size={18}/></a>}
            <span className={`tour-video-platform platform-${entry.source.platform}`}>{platformNames[entry.source.platform]}</span>
          </div>
          <div className="tour-video-meta"><strong>{title}</strong>{date && <time dateTime={entry.date ?? ''}>{date}</time>}</div>
        </article>
      })}
    </HorizontalSlider>
  </section>
}
