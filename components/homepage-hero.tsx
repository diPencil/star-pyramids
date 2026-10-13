'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocale } from './locale'
import type { HomeHero } from '@/lib/website-heroes'

export type PublicHomeHero = { hidden: boolean; content: HomeHero | null; unavailable?: boolean }
export function HomepageHero({ state, heading, eyebrow, children }: { state?: PublicHomeHero; heading: string; eyebrow: string; children: ReactNode }) {
  const { locale } = useLocale()
  const content = state?.content
  const copy = content && locale !== 'ar' ? content.text[locale] : null
  const videoRef = useRef<HTMLVideoElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [videoUrl, setVideoUrl] = useState('')
  useEffect(() => {
    if (!content || content.mediaType !== 'video' || state?.hidden) { setVideoUrl(''); return }
    const mobile = window.matchMedia('(max-width: 760px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (name: string, handler: () => void) => void; removeEventListener?: (name: string, handler: () => void) => void } }).connection
    const sync = () => setVideoUrl(reduced.matches || connection?.saveData ? '' : mobile.matches && content.mobileUrl ? content.mobileUrl : content.mediaUrl)
    sync()
    mobile.addEventListener('change', sync); reduced.addEventListener('change', sync); connection?.addEventListener?.('change', sync)
    return () => { mobile.removeEventListener('change', sync); reduced.removeEventListener('change', sync); connection?.removeEventListener?.('change', sync) }
  }, [content, state?.hidden])
  useEffect(() => {
    const video = videoRef.current
    if (!video || !panelRef.current) return
    let visible = true
    const sync = () => { if (visible && document.visibilityState === 'visible') void video.play().catch(() => {}); else video.pause() }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(panelRef.current)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync); video.pause() }
  }, [videoUrl])
  const showHero = !state?.hidden && !state?.unavailable
  return <section ref={panelRef} className="home-hero">
    {showHero && <>
      {!content ? <Image src="/egypt-hero.png" alt="Egyptian temple columns in warm desert light at sunset" fill priority sizes="100vw" className="home-hero-img" /> : <>
        <picture style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {content.mediaType === 'image' && content.mobileUrl && <source media="(max-width: 760px)" srcSet={content.mobileUrl} />}
          <img src={content.mediaType === 'video' ? content.poster : content.mediaUrl} alt={copy?.alt ?? ''} className="home-hero-img" style={{ objectPosition: content.position }} fetchPriority="high" />
        </picture>
        {videoUrl && <video key={videoUrl} ref={videoRef} src={videoUrl} poster={content.poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: content.position, pointerEvents: 'none' }} />}
      </>}
      <div className="home-hero-shade" style={content?.overlay !== null && content?.overlay !== undefined ? { background: `rgba(10,32,76,${content.overlay})` } : undefined} />
      <div className="home-hero-copy" style={content ? { maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' } : undefined}><span>{copy?.eyebrow ?? eyebrow}</span><h1>{copy?.heading ?? heading}</h1></div>
    </>}
    {children}
  </section>
}
