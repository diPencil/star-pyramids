'use client'

import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { EditorialHero } from './extended-pages'
import { Breadcrumb, SiteShell } from './site'
import { useLocale, tx } from './locale'
import { useFaqHero } from './faq-hero-context'
import { originalInformationPage, type InformationPageId } from '@/lib/information-pages'
import './information-page.css'
import type { PublicPageContent } from '@/lib/page-sections'
import { originalPageContent } from '@/lib/page-sections'
import { CmsPublicLink } from './cms-public-link'

export function InformationPage({ id, pageContent }: { id: InformationPageId; pageContent?: PublicPageContent }) {
  return <SiteShell><InformationPageContent id={id} pageContent={pageContent} /></SiteShell>
}

function InformationPageContent({ id, pageContent }: { id: InformationPageId; pageContent?: PublicPageContent }) {
  const { locale } = useLocale()
  const language = locale === 'ar' ? 'en' : locale
  const help = (pageContent === undefined ? originalPageContent(id) : pageContent.content)?.sections.find((section) => section.id === 'help')
  const state = useFaqHero()
  const original = originalInformationPage(id)
  const content = state ? state.content : original
  const text = (content ?? original).text[language]
  const pageName = id === 'guide'
    ? tx(locale, { en: 'Egypt travel guide', es: 'Guía de viaje de Egipto', it: 'Guida di viaggio dell’Egitto' })
    : tx(locale, { en: 'Accessible travel', es: 'Viajes accesibles', it: 'Viaggi accessibili' })
  const sections = content?.sections ?? []
  const [intro, ...rest] = sections
  const topics = id === 'accessible' ? rest : sections
  return <main className="information-page">
    <EditorialHero eyebrow={text.eyebrow} title={text.heading} copy={text.description} image={(content ?? original).image} href={(content ?? original).href} action={text.action} />
    <Breadcrumb items={[pageName]} />
    {(state?.hidden || state?.unavailable) && <div className="container information-title"><h1>{pageName}</h1></div>}
    {state?.unavailable ? <section className="section container information-unavailable" role="status">
      <p>{tx(locale, { en: 'This page’s content is temporarily unavailable. Please contact our team for help planning your journey.', es: 'El contenido de esta página no está disponible temporalmente. Contacta con nuestro equipo para planificar tu viaje.', it: 'Il contenuto di questa pagina è temporaneamente non disponibile. Contatta il nostro team per pianificare il viaggio.' })}</p>
      <Link href="/contact" className="text-link">{tx(locale, { en: 'Contact our team', es: 'Contacta con nuestro equipo', it: 'Contatta il nostro team' })}<ArrowRight size={16} /></Link>
    </section> : <>
      {id === 'accessible' && intro && <section className="section container split-editorial information-intro" aria-labelledby="information-intro-title">
        <div><h2 id="information-intro-title">{intro.text[language].heading}</h2><p>{intro.text[language].description}</p><Link href={intro.href} className="primary-btn">{intro.text[language].action}<ArrowRight size={17} /></Link></div>
        <img src="/egypt-hero.png" alt={tx(locale, { en: 'Ancient temple columns in Egypt', es: 'Columnas de un antiguo templo en Egipto', it: 'Colonne di un antico tempio in Egitto' })} loading="lazy" />
      </section>}
      {topics.length > 0 && <section className="section container information-topics" aria-label={tx(locale, { en: 'Planning your visit', es: 'Planifica tu visita', it: 'Pianifica la visita' })}>
        <div className="faq-list">{topics.map((section, index) => <details className="faq-item" key={section.id} open={index === 0 ? true : undefined}>
          <summary><h2>{section.text[language].heading}</h2><ChevronDown size={20} aria-hidden="true" /></summary>
          <p>{section.text[language].description}</p>
          <Link className="text-link" href={section.href}>{section.text[language].action}<ArrowRight size={16} /></Link>
        </details>)}</div>
      </section>}
    </>}
    {help?.visible && !pageContent?.unavailable && <section className="help container information-help">
      <h2>{help.text[language].heading}</h2>
      <p>{help.text[language].description}</p>
      <CmsPublicLink href={help.href ?? ''} className="primary-btn">{help.text[language].action}<ArrowRight size={17} /></CmsPublicLink>
    </section>}
  </main>
}
