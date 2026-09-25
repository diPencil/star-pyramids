"use client"

import Image from "next/image"
import { useMemo } from "react"
import { ExternalLink, Play } from "lucide-react"
import type { TourJourneyVideo, TourVideoPlatform } from "@/data/types"
import { HorizontalSlider } from "./horizontal-slider"

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

function safeUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

function getVideoSource(video: TourJourneyVideo): VideoSource | null {
  const url = safeUrl(video.url)
  if (!url) return null

  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  const parts = url.pathname.split("/").filter(Boolean)
  const requestedPlatform = video.platform

  if (host === "youtu.be" || host === "youtube.com" || host === "m.youtube.com") {
    const id = host === "youtu.be" ? parts[0] : url.searchParams.get("v") ?? (parts[0] === "shorts" || parts[0] === "embed" ? parts[1] : null)
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: "embed", platform: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}` }
  }

  if (host === "instagram.com" && (parts[0] === "reel" || parts[0] === "reels" || parts[0] === "p") && parts[1]) {
    return { kind: "embed", platform: "instagram", src: `https://www.instagram.com/${parts[0]}/${encodeURIComponent(parts[1])}/embed/` }
  }

  if ((host === "tiktok.com" || host.endsWith(".tiktok.com"))) {
    const videoIndex = parts.indexOf("video")
    const id = videoIndex >= 0 ? parts[videoIndex + 1] : null
    if (id && /^\d+$/.test(id)) return { kind: "embed", platform: "tiktok", src: `https://www.tiktok.com/player/v1/${id}?autoplay=0` }
  }

  if (host === "facebook.com" || host === "m.facebook.com" || host === "fb.watch") {
    return { kind: "embed", platform: "facebook", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false` }
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts.find((part) => /^\d+$/.test(part))
    if (id) return { kind: "embed", platform: "vimeo", src: `https://player.vimeo.com/video/${id}` }
  }

  if (/\.(mp4|webm|ogg)$/i.test(url.pathname) || requestedPlatform === "direct") {
    return { kind: "direct", platform: "direct", src: url.toString() }
  }

  return { kind: "external", platform: "external", src: url.toString() }
}

function formattedDate(value: string, locale: "en" | "ar") {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)
}

export function TourVideoGallery({ videos, posters, locale, tourTitle }: { videos?: readonly TourJourneyVideo[]; posters?: readonly string[]; locale: "en" | "ar"; tourTitle: string }) {
  const items = useMemo(() => [...(videos ?? [])]
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .map((video) => ({ video, source: getVideoSource(video) }))
    .filter((item): item is { video: TourJourneyVideo; source: VideoSource } => Boolean(item.source)), [videos])

  const ar = locale === "ar"
  const previewPosters = useMemo(() => {
    const available = (posters ?? []).filter(Boolean)
    if (!available.length) return []
    return Array.from({ length: Math.max(5, available.length) }, (_, index) => available[index % available.length])
  }, [posters])
  const previousLabel = ar ? "الفيديو السابق" : "Previous video"
  const nextLabel = ar ? "الفيديو التالي" : "Next video"

  return <section className="tour-content-section tour-video-section" aria-labelledby="journey-videos-title">
    <div className="tour-video-heading">
      <div>
        <span>{ar ? "أحدث الفيديوهات أولاً" : "Newest stories first"}</span>
        <h2 id="journey-videos-title">{ar ? "فيديوهات من رحلاتنا" : "Gallery of Exciting Journeys"}</h2>
        <p>{ar ? "لحظات حقيقية من هذه الرحلة عبر منصاتنا." : `Real moments from ${tourTitle}, collected from our social channels.`}</p>
      </div>
    </div>
    {items.length ? <HorizontalSlider className="tour-video-track" ariaLabel={ar ? "فيديوهات الرحلة" : "Journey videos"} previousLabel={previousLabel} nextLabel={nextLabel}>
      {items.map(({ video, source }) => {
        const title = ar && video.titleAr ? video.titleAr : video.title
        const date = formattedDate(video.publishedAt, locale)
        return <article className="tour-video-reel" key={video.id}>
          <div className="tour-video-frame">
            {source.kind === "embed" && <iframe title={title} src={source.src} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>}
            {source.kind === "direct" && <video controls playsInline preload="metadata" poster={video.thumbnail}><source src={source.src}/>{ar ? "متصفحك لا يدعم تشغيل الفيديو." : "Your browser does not support video playback."}</video>}
            {source.kind === "external" && <a href={source.src} target="_blank" rel="noopener noreferrer" className="tour-video-external"><span><Play size={28} fill="currentColor"/></span><b>{ar ? "شاهد الفيديو على المنصة" : "Watch on the original platform"}</b><ExternalLink size={18}/></a>}
            <span className={`tour-video-platform platform-${source.platform}`}>{platformNames[source.platform]}</span>
          </div>
          <div className="tour-video-meta"><strong>{title}</strong>{date && <time dateTime={video.publishedAt}>{date}</time>}</div>
        </article>
      })}
    </HorizontalSlider> : previewPosters.length ? <>
      <HorizontalSlider className="tour-video-track" ariaLabel={ar ? "معاينات فيديوهات الرحلة" : "Journey video previews"} previousLabel={previousLabel} nextLabel={nextLabel}>
        {previewPosters.map((poster, index) => {
          const platform = ["youtube", "instagram", "facebook", "youtube", "instagram"][index % 5]
          return <article className="tour-video-reel tour-video-preview" key={`${poster}-${index}`}>
            <div className="tour-video-frame">
              <Image src={poster} alt="" fill sizes="(max-width: 760px) 72vw, 240px"/>
              <span className="tour-video-preview-shade"/>
              <span className={`tour-video-preview-play platform-${platform}`}><Play size={34} fill="currentColor"/></span>
              <span className={`tour-video-platform platform-${platform}`}>{platformNames[platform as TourVideoPlatform]}</span>
            </div>
          </article>
        })}
      </HorizontalSlider>
      <p className="tour-video-dashboard-note">{ar ? "ستُستبدل هذه المعاينات تلقائياً بأحدث فيديوهات الرحلة عند نشرها من لوحة التحكم." : "These previews will be replaced automatically by the latest journey videos published from the dashboard."}</p>
    </> : <div className="tour-video-empty" role="status"><Play size={22} fill="currentColor"/><span>{ar ? "ستظهر فيديوهات الرحلة هنا بعد إضافتها من لوحة التحكم." : "Journey videos will appear here when they are added from the dashboard."}</span></div>}
  </section>
}
