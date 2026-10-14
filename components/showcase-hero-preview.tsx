'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { InitialLocaleProvider, LocaleProvider } from './locale'
import { ShowcaseHeroProvider } from './showcase-hero-context'
import { readShowcasePreviewMessage, type ShowcaseHero, type ShowcaseHeroId } from '@/lib/showcase-heroes'
import type { EnabledLocale } from '@/lib/locale-config'
export function ShowcaseHeroPreview({ id, initialContent, initialLocale, children }: { id: ShowcaseHeroId; initialContent: ShowcaseHero | null; initialLocale: EnabledLocale; children: ReactNode }) {
  const [content, setContent] = useState(initialContent)
  const [locale, setLocale] = useState(initialLocale)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const next = readShowcasePreviewMessage(id, event, window.location.origin, window.parent, window.parent !== window)
      if (next) { setContent(next.content); setLocale(next.locale) }
    }
    window.addEventListener('message', receive)
    if (window.parent !== window) window.parent.postMessage({ type: 'star-showcase-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [id])
  return <InitialLocaleProvider locale={locale} preview><LocaleProvider key={locale} initialLocale={locale}><ShowcaseHeroProvider state={{ hidden: false, content }}><div inert>{children}</div></ShowcaseHeroProvider></LocaleProvider></InitialLocaleProvider>
}
