'use client'

import { useEffect, useState } from 'react'
import { RebuiltHomePage } from './homepage'
import { InitialLocaleProvider } from './locale'
import type { EnabledLocale } from '@/lib/locale-config'
import { readHeroPreviewMessage, type HomeHero } from '@/lib/website-heroes'
import type { PublicPageContent } from '@/lib/page-sections'

export function HomepageHeroPreview({ initialContent, initialLocale, pageContent }: { initialContent: HomeHero | null; initialLocale: EnabledLocale; pageContent?: PublicPageContent }) {
  const [content, setContent] = useState(initialContent)
  const [locale, setLocale] = useState(initialLocale)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const next = readHeroPreviewMessage(event, window.location.origin, window.parent, window.parent !== window)
      if (!next) return
      setContent(next.content)
      setLocale(next.locale)
    }
    window.addEventListener('message', receive)
    if (window.parent !== window) window.parent.postMessage({ type: 'star-hero-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [])
  return <InitialLocaleProvider locale={locale} preview><div inert><RebuiltHomePage key={locale} initialLocale={locale} hero={{ hidden: false, content }} pageContent={pageContent} /></div></InitialLocaleProvider>
}
