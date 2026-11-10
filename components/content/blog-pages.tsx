'use client'

import { CmsPublicLink } from "@/components/cms/cms-public-link";
import { usePresentation, PresentationSection } from "@/components/cms/presentation-content-context";
import Link from "next/link";
import { CampaignPlacementSlot } from "../offers/offer-campaigns";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Camera, Check, Clock3, Compass, EyeOff, Sun, Ticket, type LucideIcon, ShieldCheck } from "lucide-react";
import { useDbBlogs } from "@/lib/catalogue/offers-blogs-client";
import { useDbTours } from "@/lib/tours/tours-client";
import { getToursBySlugs } from "@/data/tours";
import type { Blog } from "@/data/types";
import { useLocale, tx } from "../locale";
import { Breadcrumb, PageShowcaseHero, SiteShell } from "@/components/site";
import { DetailNotFound } from "./public-content-pages"


export function BlogsPage({ initialBlogs }: { initialBlogs: Blog[] }) { return <SiteShell><BlogsPageContent initialBlogs={initialBlogs} /></SiteShell> }

function BlogMagazineCard({ item }: { item: Blog }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const href = `/blogs/${item.slug}`
  const image = item.editorial?.heroImage ?? item.image
  const imageAlt = item.editorial?.heroAlt ?? item.title

  return <article className="blog-mag-card">
    <Link href={href} className="blog-mag-media" aria-label={item.title}>
      <img src={image} alt={imageAlt} loading="lazy"/>
      <span>{item.category}</span>
    </Link>
    <div className="blog-mag-copy">
      <div className="blog-mag-meta">
        <span><CalendarDays size={14}/>{item.date}</span>
        {item.editorial?.readTime && <span><Clock3 size={14}/>{item.editorial.readTime}</span>}
      </div>
      <h3><Link href={href}>{item.title}</Link></h3>
      <p>{item.excerpt}</p>
      <Link href={href} className="blog-mag-link">
        {tx(locale, { en: 'Read the story', es: 'Lee la historia', it: 'Leggi la storia', ar: 'اقرأ الدليل' })} <ArrowRight size={16}/>
      </Link>
    </div>
  </article>
}

function BlogsPageContent({ initialBlogs }: { initialBlogs: Blog[] }) {
  const cms = usePresentation("blogs")

  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveBlogs = useDbBlogs(initialBlogs).filter((blog) => blog.isPublished !== false)
  const featured = liveBlogs[0]
  const categories = new Set(liveBlogs.map((blog) => blog.category)).size
  if (!featured) return null
  return <main>
    <PageShowcaseHero image={featured.image} eyebrow={tx(locale, { en: 'Stories & inspiration', es: 'Historias e inspiración', it: 'Storie e ispirazione', ar: 'حكايات وإلهام' })} title={tx(locale, { en: 'Travel notes for curious Egypt explorers', es: 'Notas de viaje para exploradores curiosos de Egipto', it: 'Note di viaggio per curiosi esploratori dell\'Egitto', ar: 'ملاحظات سفر لعشاق مصر الفضوليين' })} intro={tx(locale, { en: 'Practical guides, local perspective, and the small details that help you travel with more confidence.', es: 'Guías prácticas, mirada local y los pequeños detalles que te ayudan a viajar con más confianza.', it: 'Guide pratiche, prospettiva locale e piccoli dettagli per viaggiare con più sicurezza.', ar: 'أدلة عملية ووجهة نظر محلية وتفاصيل صغيرة تساعدك تسافر بثقة أكبر.' })} primaryLabel={tx(locale, { en: 'Explore the stories', es: 'Descubre las historias', it: 'Scopri le storie', ar: 'استكشف القصص' })} primaryHref="#blog-stories" secondaryLabel={tx(locale, { en: 'Read the featured story', es: 'Lee la historia destacada', it: 'Leggi la storia in evidenza', ar: 'اقرأ القصة المميزة' })} secondaryHref={`/blogs/${featured.slug}`} railLabel={tx(locale, { en: 'Featured story', es: 'Historia destacada', it: 'Storia in evidenza', ar: 'قصة مميزة' })} railTitle={featured.title} railHref={`/blogs/${featured.slug}`} railMeta={[{ Icon: CalendarDays, label: featured.date }, { Icon: Compass, label: featured.category }]} statsLabel={tx(locale, { en: 'Journal summary', es: 'Resumen del blog', it: 'Riepilogo del diario', ar: 'ملخص المدونة' })} stats={[{ value: liveBlogs.length, label: tx(locale, { en: 'Stories & guides', es: 'Historias y guías', it: 'Storie e guide', ar: 'قصص وأدلة' }) }, { value: categories, label: tx(locale, { en: 'Story categories', es: 'Categorías', it: 'Categorie di storie', ar: 'تصنيفات' }) }]}/>
    <PresentationSection pageId="blogs" id="blog-stories"><section id="blog-stories" className="blogs-editorial section container">
      <article className="blog-feature-story">
        <Link href={`/blogs/${featured.slug}`} className="blog-feature-media" aria-label={featured.title}>
          <img src={featured.editorial?.heroImage ?? featured.image} alt={featured.editorial?.heroAlt ?? featured.title}/>
          <span>{cms.text("blog-stories","description0",tx(locale, { en: 'Editor\'s pick', es: 'Selección del editor', it: 'Scelta del redattore', ar: 'اختيار المجلة' }))}</span>
        </Link>
        <div className="blog-feature-copy">
          <span className="eyebrow">{cms.text("blog-stories","description1",tx(locale, { en: 'Featured story', es: 'Historia destacada', it: 'Storia in evidenza', ar: 'قصة مميزة' }))}</span>
          <div className="blog-mag-meta">
            <span><Compass size={14}/>{featured.category}</span>
            <span><CalendarDays size={14}/>{featured.date}</span>
            {featured.editorial?.readTime && <span><Clock3 size={14}/>{featured.editorial.readTime}</span>}
          </div>
          <h2>{featured.title}</h2>
          <p>{featured.excerpt}</p>
          <Link href={`/blogs/${featured.slug}`} className="blog-feature-link">
            {cms.text("blog-stories","description2",tx(locale, { en: 'Read the full story', es: 'Lee la historia completa', it: 'Leggi la storia completa', ar: 'اقرأ القصة كاملة' }))} <ArrowRight size={17}/>
          </Link>
        </div>
      </article>

      <header className="blog-index-head">
        <div>
          <span className="eyebrow">{cms.text("blog-stories","description3",tx(locale, { en: 'From the travel journal', es: 'De nuestro diario de viajes', it: 'Dal diario di viaggio', ar: 'من مجلة السفر' }))}</span>
          <h2>{cms.text("blog-stories","description4",tx(locale, { en: 'Fresh perspectives for your next Egypt journey.', es: 'Nuevas perspectivas para tu próximo viaje a Egipto.', it: 'Nuove prospettive per il tuo prossimo viaggio in Egitto.', ar: 'أفكار جديدة لرحلتك القادمة في مصر.' }))}</h2>
        </div>
        <p>{tx(locale, { en: `${Math.max(liveBlogs.length - 1, 0)} recent guides and stories`, es: `${Math.max(liveBlogs.length - 1, 0)} guías e historias recientes`, it: `${Math.max(liveBlogs.length - 1, 0)} guide e storie recenti`, ar: `${Math.max(liveBlogs.length - 1, 0)} أدلة وقصص حديثة` })}</p>
      </header>

      <div className="blog-magazine-grid">
        {liveBlogs.slice(1).map((item) => <BlogMagazineCard item={item} key={item.slug}/>) }
      </div>
    </section></PresentationSection>
  </main>
}

const guideIconMap: Record<string, LucideIcon> = { Sun, Clock3, Compass, ShieldCheck, Ticket, Camera }

function GuideTipCard({ icon, title, copy }: { icon: string; title: string; copy: string }) {
  const Icon = guideIconMap[icon] || Compass
  return <article><Icon size={24}/><h3>{title}</h3><p>{copy}</p></article>
}

function GuideSection({ section, tips }: { section: { id: string; number: string; eyebrow: string; heading: string; lede?: string; copy?: readonly string[]; list?: readonly string[]; image?: { src: string; alt: string; caption?: string }; reverse?: boolean }; tips?: readonly { icon: string; title: string; copy: string }[] }) {
  const hasImage = !!section.image
  const hasCopy = !!(section.copy && section.copy.length) || !!section.lede || !!(section.list && section.list.length)
  if (section.id === 'essentials' && tips && tips.length) {
    return <section id={section.id} className="guide-essentials">
      <div className="guide-heading"><span className="guide-section-number">{section.number}</span><div><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2></div></div>
      <div id="tips" className="guide-tip-grid">{tips.map((tip) => <GuideTipCard key={tip.title} {...tip} />)}</div>
    </section>
  }
  if (hasImage && hasCopy) {
    return <section id={section.id} className={`guide-split${section.reverse ? ' guide-split-reverse' : ''}`}>
      {section.reverse ? <>
        <div className="guide-copy"><span className="guide-section-number">{section.number}</span><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2>{section.lede && <p className="guide-lede">{section.lede}</p>}{section.copy?.map((p, i) => <p key={i}>{p}</p>)}{section.list && <ul>{section.list.map((item, i) => <li key={i}><Check size={16}/>{item}</li>)}</ul>}</div>
        <div className="guide-image"><img src={section.image!.src} alt={section.image!.alt} loading="lazy"/>{section.image!.caption && <span>{section.image!.caption}</span>}</div>
      </> : <>
        <div className="guide-image"><img src={section.image!.src} alt={section.image!.alt} loading="lazy"/>{section.image!.caption && <span>{section.image!.caption}</span>}</div>
        <div className="guide-copy"><span className="guide-section-number">{section.number}</span><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2>{section.lede && <p className="guide-lede">{section.lede}</p>}{section.copy?.map((p, i) => <p key={i}>{p}</p>)}{section.list && <ul>{section.list.map((item, i) => <li key={i}><Check size={16}/>{item}</li>)}</ul>}</div>
      </>}
    </section>
  }
  if (hasImage && !hasCopy) {
    return <figure className="guide-wide-image"><img src={section.image!.src} alt={section.image!.alt} loading="lazy"/>{section.image!.caption && <figcaption>{section.image!.caption}</figcaption>}</figure>
  }
  return <section id={section.id} className="guide-intro">
    <span className="guide-section-number">{section.number}</span>
    <div><span className="eyebrow">{section.eyebrow}</span><h2>{section.heading}</h2>{section.lede && <p className="guide-lede">{section.lede}</p>}{section.copy?.map((p, i) => <p key={i}>{p}</p>)}</div>
  </section>
}

export function BlogEditorialPage({ item, allBlogs }: { item: Blog; allBlogs: Blog[] }) {
  const cms = usePresentation("blog-detail")

  const editorial = item.editorial!
  const { currency, locale } = useLocale()
  const adAr = locale === 'ar'
  const related = allBlogs.filter((blog) => blog.isPublished !== false && blog.slug !== item.slug).slice(0, 3)
  // VIP card context comes from the story's own editorial configuration.
  // The lookup base is built from the configured slug itself (it may point
  // at a featured-only tour outside the curated catalogue subsets), so the
  // link and price resolve to the live DB record: static catalogue data
  // renders first, then upgrades to the database price when it arrives.
  const vipTourSlug = editorial.sidebarAction?.tourSlug
  const vipTourBase = useMemo(() => (vipTourSlug ? getToursBySlugs([vipTourSlug]) : []), [vipTourSlug])
  const vipTour = vipTourSlug ? useDbTours(vipTourBase, { includeNew: true }).find((tour) => tour.slug === vipTourSlug) : undefined
  const heroImage = editorial.heroImage || item.image
  const heroAlt = editorial.heroAlt || item.title
  const checklistAnchor = !editorial.tips?.length && editorial.sidebarLinks?.some((link) => link.href === '#tips') ? 'tips' : 'checklist'
  const [activeSection, setActiveSection] = useState<string>('')

  useEffect(() => {
    if (!editorial.sidebarLinks || !editorial.sidebarLinks.length) return
    const ids = editorial.sidebarLinks.map((l) => l.href.replace('#', ''))
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!targets.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [editorial.sidebarLinks])

  return <SiteShell>
    <div className="guide-breadcrumb"><div className="container"><Link href="/">{cms.text("presentation","description0",tx(locale, { en: 'Home', es: 'Inicio', it: 'Home', ar: 'الرئيسية' }))}</Link><span>›</span><Link href="/blogs">{cms.text("presentation","description1",tx(locale, { en: 'Blogs', es: 'Blog', it: 'Blog', ar: 'المدونة' }))}</Link><span>›</span><strong>{item.title}</strong></div></div>
    <main className="guide-page">
      <header className="guide-hero">
        <img src={heroImage} alt={heroAlt} />
        <div className="guide-hero-shade" />
        <div className="container guide-hero-content">
          <div className="guide-meta"><span>{item.category}</span><span>{item.date}</span>{editorial.readTime && <span>{editorial.readTime}</span>}</div>
          <h1>{item.title}</h1>
          <p>{item.excerpt} {editorial.heroDescription}</p>
        </div>
      </header>

      {editorial.facts && editorial.facts.length > 0 && <section className="guide-facts" aria-label="At a glance">
        <div className="container guide-facts-inner">{editorial.facts.map(({ icon, label, value }) => {
          const Icon = guideIconMap[icon] || Compass
          return <div key={label}><Icon size={22} aria-hidden="true"/><span><small>{label}</small><strong>{value}</strong></span></div>
        })}</div>
      </section>}

      <div className="container guide-layout">
        <aside className="guide-sidebar">
          {editorial.sidebarLinks && editorial.sidebarLinks.length > 0 && <nav aria-label="In this guide"><strong>{cms.text("presentation","description2",tx(locale, { en: 'In this guide', es: 'En esta guía', it: 'In questa guida', ar: 'في هذا الدليل' }))}</strong>{editorial.sidebarLinks.map((link) => <a key={link.href} href={link.href} className={activeSection === link.href.replace('#', '') ? 'active' : ''}>{link.label}</a>)}</nav>}
          {editorial.sidebarAction && <div className="guide-side-action"><span>{editorial.sidebarAction.label}</span><strong>{editorial.sidebarAction.heading}</strong><Link href={`/egypt-tours/${editorial.sidebarAction.tourSlug}`}>{cms.text("presentation","description3",tx(locale, { en: 'View the tour', es: 'Ver la excursión', it: 'Vedi il tour', ar: 'استعرض الرحلة' }))} <ArrowRight size={15}/></Link></div>}
          <CampaignPlacementSlot placement="blog-sidebar"/>
        </aside>

        <article className="guide-story">
          {editorial.sections?.map((section) => <GuideSection key={section.id} section={section} tips={editorial.tips} />)}

          {editorial.quote && <blockquote className="guide-quote"><span aria-hidden="true">{'\u201C'}</span><p>{editorial.quote}</p></blockquote>}

          {editorial.wideImage && <figure className="guide-wide-image"><img src={editorial.wideImage.src} alt={editorial.wideImage.alt} loading="lazy"/>{editorial.wideImage.caption && <figcaption>{editorial.wideImage.caption}</figcaption>}</figure>}

          {editorial.checklist && editorial.checklist.length > 0 && <PresentationSection pageId="blog-detail" id="guide-checklist"><section id={checklistAnchor} className="guide-checklist">
            <div><span className="guide-section-number">{String((editorial.sections?.length || 0) + 1).padStart(2, '0')}</span><span className="eyebrow">{editorial.checklistEyebrow || cms.text("guide-checklist","description0",tx(locale, { en: 'Before you go', es: 'Antes de viajar', it: 'Prima di partire', ar: 'قبل السفر' }))}</span><h2>{editorial.checklistHeading || cms.text("guide-checklist","description1",tx(locale, { en: 'Your trip, simplified', es: 'Tu viaje, simplificado', it: 'Il tuo viaggio, semplificato', ar: 'رحلتك ببساطة' }))}</h2></div>
            <ul>{editorial.checklist.map((item, i) => <li key={i}><Check size={17}/><span><strong>{item.title}</strong>{item.detail}</span></li>)}</ul>
          </section></PresentationSection>}
        </article>
      </div>

      {editorial.cta && <PresentationSection pageId="blog-detail" id="guide-cta"><section className="guide-cta">
        <img src={heroImage} alt={heroAlt} loading="lazy"/>
        <div className="guide-cta-shade"/>
        <div className="container guide-cta-content">
          <span>{editorial.cta.eyebrow}</span>
          <h2>{editorial.cta.heading}</h2>
          <p>{editorial.cta.copy}</p>
          <div>
            {editorial.cta.tourSlug && <Link href={`/egypt-tours/${editorial.cta.tourSlug}`} className="primary-btn">{editorial.cta.tourLabel || 'View the tour'} <ArrowRight size={17}/></Link>}
            <CmsPublicLink href={cms.link("guide-cta","links0","/make-your-trip")} className="guide-cta-link">{editorial.cta.customLabel || 'Build my own trip'}</CmsPublicLink>
          </div>
        </div>
      </section></PresentationSection>}

      <PresentationSection pageId="blog-detail" id="guide-related"><section className="container guide-related"><div className="guide-related-head"><div><span className="eyebrow">{cms.text("guide-related","description0",tx(locale, { en: 'Keep exploring', es: 'Sigue explorando', it: 'Continua a esplorare', ar: 'واصل الاستكشاف' }))}</span><h2>{cms.text("guide-related","description1",tx(locale, { en: 'More stories from Egypt', es: 'Más historias de Egipto', it: 'Altre storie dall\'Egitto', ar: 'قصص أخرى من مصر' }))}</h2></div><CmsPublicLink href={cms.link("guide-related","links0","/blogs")}>{cms.text("guide-related","description2",tx(locale, { en: 'All travel stories', es: 'Todas las historias de viaje', it: 'Tutte le storie di viaggio', ar: 'كل قصص السفر' }))} <ArrowRight size={16}/></CmsPublicLink></div><div className="guide-related-grid">{related.map((blog) => <article key={blog.slug}><Link href={`/blogs/${blog.slug}`}><img src={blog.image} alt={blog.title} loading="lazy"/></Link><small>{blog.category}</small><h3><Link href={`/blogs/${blog.slug}`}>{blog.title}</Link></h3><p>{blog.excerpt}</p></article>)}</div></section></PresentationSection>
    </main>
  </SiteShell>
}

export function BlogDetailPage({ slug, initialBlogs }: { slug: string; initialBlogs: Blog[] }) {
  const liveBlogs = useDbBlogs(initialBlogs)
  const item = liveBlogs.find((blog) => blog.slug === slug)
  const { locale } = useLocale()
  const ar = locale === 'ar'
  if (!item) return <DetailNotFound title={tx(locale, { en: 'Story not found', es: 'Historia no encontrada', it: 'Storia non trovata', ar: 'القصة غير موجودة' })} copy={tx(locale, { en: 'The story you were looking for has taken a different route.', es: 'La historia que buscabas ha tomado otro camino.', it: 'La storia che cercavi ha preso un\'altra strada.', ar: 'القصة التي تبحث عنها سلكت طريقًا آخر.' })} backHref="/blogs" backLabel={tx(locale, { en: 'Read all stories', es: 'Lee todas las historias', it: 'Leggi tutte le storie', ar: 'اقرأ كل القصص' })}/>
  if (item.isPublished === false) return <SiteShell><main className="container section"><div className="account-empty blog-hidden-card" role="status"><span className="blog-hidden-ic" aria-hidden="true"><EyeOff size={22} /></span><h1>{tx(locale, { en: 'This story is currently unavailable', es: 'Esta historia no está disponible ahora mismo', it: 'Questa storia non è al momento disponibile', ar: 'هذا المقال غير متاح حاليًا' })}</h1><p>{tx(locale, { en: 'Browse our other published stories and travel guides.', es: 'Descubre nuestras otras historias publicadas y guías de viaje.', it: 'Scopri le nostre altre storie pubblicate e guide di viaggio.', ar: 'تصفح مقالاتنا المنشورة وأدلة السفر الأخرى.' })}</p><Link href="/blogs" className="primary-btn">{tx(locale, { en: 'Read all stories', es: 'Lee todas las historias', it: 'Leggi tutte le storie', ar: 'اقرأ كل القصص' })}</Link></div></main></SiteShell>
  if (item.editorial) return <BlogEditorialPage item={item} allBlogs={liveBlogs}/>
  return <SiteShell><Breadcrumb items={[tx(locale, { en: 'Blogs', es: 'Blog', it: 'Blog', ar: 'المدونة' }),item.title]}/><main className="article-page container"><div className="article-header"><span className="eyebrow">{item.category}, {item.date}</span><h1>{item.title}</h1><p>{item.excerpt}</p></div>{item.image && <img className="article-cover" src={item.image} alt={item.title}/>}<div className="article-body"><p>{item.excerpt}</p><Link href="/blogs" className="primary-btn">{tx(locale, { en: 'Read all stories', es: 'Lee todas las historias', it: 'Leggi tutte le storie', ar: 'اقرأ كل القصص' })} <ArrowRight size={16}/></Link></div></main></SiteShell>
}
