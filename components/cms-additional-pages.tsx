'use client'
import { useState } from 'react'
import { useLocale } from './locale'
import { originalPageContent, type PublicPageContent } from '@/lib/page-sections'

export function CmsFaqBody({ state }: { state?: PublicPageContent }) {
  const { locale } = useLocale()
  const language = locale === 'ar' ? 'en' : locale
  const [open, setOpen] = useState<string | null>(null)
  const sections = (state === undefined ? originalPageContent('faq') : state.content)?.sections ?? []
  const intro = sections.find((section) => section.id === 'intro')
  const questions = sections.find((section) => section.id === 'questions')
  const items = questions?.visible && !state?.unavailable ? questions.items?.filter((item) => item.visible) ?? [] : []
  const active = open === null ? items[0]?.id : open
  return <main className="section container faq-page">{sections.filter((section) => section.visible && !state?.unavailable).map((section) => section.id === 'intro' ? <div className="faq-intro" key={section.id}><span className="eyebrow">{intro!.text[language].eyebrow}</span><h2>{intro!.text[language].heading}</h2><p>{intro!.text[language].description}</p></div> : section.id === 'questions' ? <div className="faq-list" key={section.id}>{items.map((item) => <div className={`faq-item ${active === item.id ? 'open' : ''}`} key={item.id}><button onClick={() => setOpen(active === item.id ? '' : item.id)} aria-expanded={active === item.id}><span>{item.text[language].question}</span><b>{active === item.id ? '−' : '+'}</b></button>{active === item.id && <p>{item.text[language].answer}</p>}</div>)}</div> : null)}</main>
}

export function CmsPolicyPage({ pageId, state }: { pageId: 'privacy' | 'terms'; state: PublicPageContent }) {
  const { locale } = useLocale()
  const language = locale === 'ar' ? 'en' : locale
  const sections = state.content?.sections ?? []
  const heading = sections.find((section) => section.id === 'hero')
  const content = sections.find((section) => section.id === 'content')
  return <div className={pageId + '-page'}>{heading && <><h1>{heading.text[language].heading}</h1><p>{heading.text[language].description}</p></>}{!state.unavailable && content?.visible && content.items?.filter((item) => item.visible).map((item) => <section key={item.id}><h2>{item.text[language].heading}</h2><p style={{ whiteSpace: 'pre-line' }}>{item.text[language].description}</p></section>)}</div>
}
