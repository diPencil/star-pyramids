'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Camera, Check, Clock3, Compass, CarFront, Mail, MapPin, Phone, Search, ShieldCheck, Star, Sun, Ticket, Users, type LucideIcon } from 'lucide-react'
import { blogs, cars, destinations, events, faqs, offers, policies, siteImages, allSearchItems, findBlog, findDestination, findEvent, findOffer } from '@/data/content'
import type { Blog, Car, Event, Offer } from '@/data/types'
import { parseCarRequestQuery, parseSearchQuery } from '@/lib/query'
import { useLocale, formatPrice } from './locale'
import { Breadcrumb, Heading, HelpCTA, SiteShell, extra } from '@/components/site'

export function EditorialHero({ eyebrow, title, copy, image = siteImages.pyramids, action = 'Explore with us', href = '/egypt-tours/one-day-tours' }: { eyebrow?: string; title: string; copy: string; image?: string; action?: string; href?: string }) {
  return <section className="editorial-hero"><img src={image} alt=""/><div className="editorial-overlay"/><div className="container editorial-content">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1><p>{copy}</p><Link className="primary-btn" href={href}>{action}<ArrowRight size={17}/></Link></div></section>
}

export function DetailNotFound({ title, copy, backHref, backLabel }: { title: string; copy: string; backHref: string; backLabel: string }) {
  return <SiteShell><main className="not-found"><div className="not-found-mark">404</div><h1>{title}</h1><p>{copy}</p><Link href={backHref} className="primary-btn">{backLabel}</Link></main></SiteShell>
}

export function ContentCard({ item, type = 'blog' }: { item: Blog | Event | Offer; type?: 'blog' | 'event' | 'offer' }) {
  const href = type === 'blog' ? `/blogs/${item.slug}` : type === 'event' ? `/events/${item.slug}` : type === 'offer' ? `/special-offers/${item.slug}` : `/destinations/${item.slug}`
  const badge = 'badge' in item ? item.badge : undefined
  const meta = 'category' in item ? `${item.category} · ${item.date}` : 'date' in item ? item.date : undefined
  const description = 'excerpt' in item ? item.excerpt : item.copy
  return <article className="content-card"><Link href={href} className="content-image"><img src={item.image} alt={item.title}/>{badge && <b>{badge}</b>}</Link><div className="content-card-body">{meta && <small>{meta}</small>}<h3><Link href={href}>{item.title}</Link></h3><p>{description}</p><Link className="text-link" href={href}>Read more <ArrowRight size={15}/></Link></div></article>
}

export function AboutPage() { return <SiteShell><EditorialHero eyebrow="Since 1970" title="Travel deeper into Egypt" copy="For more than five decades, STAR PYRAMIDS Tours has helped curious travelers experience Egypt with thoughtful planning, warm local knowledge, and a little more time for wonder." image={siteImages.temple} href="/make-your-trip" action="Start planning"/><main><section className="section container split-editorial"><div><span className="eyebrow">Our story</span><h2>Egypt is not just a destination. It is a feeling.</h2><p>We are a team of local travel designers, guides, and hosts who believe the best journeys make space for both the headline landmarks and the quiet moments in between.</p><p>From your first question to the final airport transfer, we stay close to the details so you can stay present for the experience.</p><Link href="/contact" className="text-link">Meet the team <ArrowRight size={15}/></Link></div><img src={siteImages.pyramids} alt="The pyramids of Giza"/></section><section className="section pale"><div className="container"><Heading title="The way we travel" copy="Three promises behind every STAR PYRAMIDS journey."/><div className="value-grid">{[['Local insight','Travel with people who know the rhythm, history, and hidden corners of each place.'],['Thoughtful details','Clear planning, comfortable transfers, and the right pace for your group.'],['Real connection','Leave with a richer understanding of Egypt and memories that feel like yours.']].map(([title,copy],i)=><article className="value-card" key={title}><b>0{i+1}</b><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section><section className="section container quote-section"><blockquote>“The most meaningful souvenirs are the stories you bring home.”</blockquote><p>— The STAR PYRAMIDS team</p></section><section className="section pale"><div className="container split-editorial"><div><span className="eyebrow">Our Mission</span><h2>Travel that leaves Egypt better.</h2><p>We design journeys that respect ancient places, support local communities, and give every guest a genuine welcome.</p></div><div><span className="eyebrow">Our Vision</span><h2>Egypt, felt — not just seen.</h2><p>To be the team travelers trust with their once-in-a-lifetime journey, from the first question to the flight home.</p></div></div></section><section className="section container"><Heading title="Our partners" copy="Working with platforms travelers already trust."/><div className="trust-strip"><span>Official partner</span><b>VIATOR</b><b>TRIPADVISOR</b><b>TOURRADAR</b><b>CIVITATIS</b><b>GETYOURGUIDE</b></div></section><section className="section pale"><div className="container split-editorial"><div><span className="eyebrow">CEO Message</span><h2>Mahmoud Badia</h2><p>Executive Manager</p><p>Dear Valued Visitor, welcome to STAR PYRAMIDS Tours. For over five decades our family has helped travelers discover the real Egypt — with honest advice, careful planning, and hospitality from the heart. Warm regards.</p></div><div className="ceo-card"><span className="rev-avatar" style={{ background: 'var(--blue)', width: 84, height: 84, fontSize: 32 }}>MB</span><b>Mahmoud Badia</b><small>Executive Manager</small></div></div></section><HelpCTA /></main></SiteShell> }

export function ContactPage() { const { locale: cl } = useLocale(); const ex = extra[cl]; return <SiteShell><Breadcrumb items={[ex.contactTitle]} /><main className="contact-page"><div className="container"><span className="eyebrow">{ex.contactTitle}</span><h1>{ex.contactSub}</h1><div className="contact-grid"><div><div className="contact-list"><div><MapPin size={21} /><span><b>{ex.addrT}</b><small>Pyramids View Tower, Giza, Egypt</small></span></div><div><Phone size={21} /><span><b>+20 109 588 8830</b><small>{ex.callUs}</small></span></div><div><svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg><span><b>+20 109 588 8831</b><small>WhatsApp</small></span></div><div><Mail size={21} /><span><b>{ex.emailT}</b><small>info@starpyramids.com</small></span></div></div></div><div><h2>{ex.formT}</h2><ContactForm /></div></div></div><section className="section container"><div className="section-heading inline-heading"><div><span className="eyebrow">{ex.faqTeaser}</span><h2>{faqs[0][0]}</h2></div><Link className="text-link" href="/faq">{ex.seeMore} <ArrowRight size={15} /></Link></div></section><HelpCTA /></main></SiteShell> }

export function ContactForm() { const { locale: cf } = useLocale(); const ex = extra[cf]; const [sent, setSent] = useState(false); if (sent) return <div className="form-success"><Check size={34} /><h2>{ex.helpDoneT}</h2><p>{ex.helpDoneP1}{ex.helpDoneP2}</p></div>; return <form className="contact-form" onSubmit={(e) => { e.preventDefault(); setSent(true) }}><div className="form-grid"><label>{ex.helpName}<input required placeholder={ex.helpName} /></label><label>{ex.emailT}<input required type="email" placeholder="you@example.com" /></label><label className="full">{ex.sendMsg}<textarea required placeholder={ex.msgPh} /></label></div><button className="primary-btn" type="submit">{ex.sendMsg} <ArrowRight size={17} /></button><div className="socials contact-socials"><a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube">YouTube</a><a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">Facebook</a><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">Instagram</a><a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">TikTok</a></div></form> }

export function CarsPage() { return <SiteShell><EditorialHero eyebrow="Private transfers & rentals" title="Move through Egypt with ease" copy="Choose the right vehicle for airport transfers, day trips, and multi-city adventures." image={siteImages.redSea} href="/rent-car/request" action="Request a car"/><main className="section container"><div className="section-heading inline-heading"><div><span className="eyebrow">Our fleet</span><h2>Comfort for every kind of journey</h2></div><Link className="text-link" href="/rent-car/request">Need a custom vehicle? <ArrowRight size={15}/></Link></div><div className="car-grid">{cars.map(car=><CarCard key={car.slug} car={car}/>)}</div></main></SiteShell> }

export function CarCard({ car }: { car: Car }) { const { currency, locale } = useLocale(); return <article className="car-card"><img src={car.image} alt={car.title}/><div><span className="eyebrow">Available daily</span><h3>{car.title}</h3><p>{car.copy}</p><div className="car-specs"><span><Users size={15}/> {car.seats}</span><span><CarFront size={15}/> {car.transmission}</span></div><div className="car-card-bottom"><strong>{formatPrice(car.dailyPrice, currency, locale)} / day</strong><Link href={`/rent-car/request?vehicle=${car.slug}`} className="text-link">Request <ArrowRight size={15}/></Link></div></div></article> }

function CarRequestForm({ onDone }: { onDone: () => void }) { const params = useSearchParams(); const initial = parseCarRequestQuery(params); const [pickup, setPickup] = useState(initial.pickup); const [dropoff, setDropoff] = useState(initial.dropoff); const [pickupDate, setPickupDate] = useState(initial.date); const { currency, locale } = useLocale(); return <form className="contact-form" onSubmit={(e) => { e.preventDefault(); onDone() }}>{initial.vehicle || initial.tripType ? <p style={{ color: 'var(--muted)', marginTop: 0 }}>{initial.vehicle ? <>Selected vehicle: <strong>{initial.vehicle.title} ({formatPrice(initial.vehicle.dailyPrice, currency, locale)} / day)</strong><br /></> : null}{initial.tripType ? <>Trip type: <strong>{initial.tripType}</strong></> : null}</p> : null}<div className="form-grid"><label className="full">Pick-up location<input required placeholder="Airport, hotel, or city" value={pickup} onChange={(e) => setPickup(e.target.value)} /></label><label className="full">Drop-off location<input required placeholder="Where are you going?" value={dropoff} onChange={(e) => setDropoff(e.target.value)} /></label><label>Pick-up date<input required type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} /></label><label>Passengers<input required type="number" min="1" placeholder="2" /></label><label className="full">Notes<textarea placeholder="Tell us about your route" /></label></div><button className="primary-btn" type="submit">Send request <ArrowRight size={17} /></button></form> }

export function CarRequestPage() { const [sent,setSent] = useState(false); return <SiteShell><Breadcrumb items={['Rent Car','Request a vehicle']}/><main className="request-page container">{sent ? <div className="form-success large"><Check size={42}/><h1>Your request is on its way</h1><p>Our transport team will confirm your vehicle and route shortly.</p><Link className="primary-btn" href="/">Back home</Link></div> : <div className="request-card"><div><span className="eyebrow">Private transport</span><h1>Tell us how you want to move.</h1><p>From a quick airport transfer to a full itinerary vehicle, we will match you with the right car and driver.</p><img src={siteImages.cairo} alt="Cairo street"/></div><Suspense><CarRequestForm onDone={()=>setSent(true)}/></Suspense></div>}</main></SiteShell> }

export function DestinationsPage() { return <SiteShell><EditorialHero eyebrow="See the full picture" title="Every destination tells a different Egypt story" copy="Build a trip around the places that make you curious, from ancient capitals to salt-white deserts and coral-blue seas." image={siteImages.desert} href="/make-your-trip" action="Build my route"/><main className="section container"><div className="destination-large-grid">{destinations.map(item=><article className="destination-large" key={item.slug}><img src={item.image} alt={item.title}/><div><span className="eyebrow">Discover Egypt</span><h2>{item.title}</h2><p>{item.copy}</p><Link href={`/destinations/${item.slug}`} className="text-link">Explore destination <ArrowRight size={15}/></Link></div></article>)}</div></main></SiteShell> }

export function DestinationDetailPage({ slug }: { slug: string }) { const item = findDestination(slug); if (!item) return <DetailNotFound title="Destination not found" copy="The destination you were looking for has taken a different route." backHref="/destinations" backLabel="Explore destinations"/>; return <SiteShell><EditorialHero eyebrow="Destination guide" title={item.title} copy={item.copy} image={item.image} href="/make-your-trip" action="Plan this destination"/><main className="section container detail-layout"><article><h2>A place to take your time</h2><p>Let our local team connect the essential sights with the slower experiences that make this destination feel alive. We will shape your days around your interests, the season, and the kind of memories you want to make.</p><div className="detail-highlights">{['Private local guide','Comfortable transfers','Flexible daily rhythm'].map(x=><span key={x}><Check size={16}/>{x}</span>)}</div></article><aside className="booking-card"><span className="eyebrow">Start planning</span><h3>Make this part of your Egypt story.</h3><Link href="/make-your-trip" className="primary-btn">Build my trip <ArrowRight size={16}/></Link></aside></main></SiteShell> }

export function BlogsPage() { return <SiteShell><EditorialHero eyebrow="Stories & inspiration" title="Travel notes for curious Egypt explorers" copy="Practical guides, local perspective, and the small details that help you travel with more confidence." image={siteImages.cairo} href="/make-your-trip" action="Plan a trip"/><main className="section container"><div className="featured-blog"><img src={blogs[0].image} alt={blogs[0].title}/><div><span className="eyebrow">Featured story</span><h2>{blogs[0].title}</h2><p>{blogs[0].excerpt}</p><Link href={`/blogs/${blogs[0].slug}`} className="primary-btn">Read the story <ArrowRight size={16}/></Link></div></div><div className="content-grid blog-grid-expanded">{blogs.slice(1).map(item=><ContentCard item={item} key={item.slug}/>)}</div></main></SiteShell> }

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
      <div className="guide-tip-grid">{tips.map((tip) => <GuideTipCard key={tip.title} {...tip} />)}</div>
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

export function BlogEditorialPage({ item }: { item: Blog }) {
  const editorial = item.editorial!
  const related = blogs.filter((blog) => blog.slug !== item.slug).slice(0, 3)
  const heroImage = editorial.heroImage || item.image
  const heroAlt = editorial.heroAlt || item.title
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
    <div className="guide-breadcrumb"><div className="container"><Link href="/">Home</Link><span>›</span><Link href="/blogs">Blogs</Link><span>›</span><strong>{item.title}</strong></div></div>
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
          {editorial.sidebarLinks && editorial.sidebarLinks.length > 0 && <nav aria-label="In this guide"><strong>In this guide</strong>{editorial.sidebarLinks.map((link) => <a key={link.href} href={link.href} className={activeSection === link.href.replace('#', '') ? 'active' : ''}>{link.label}</a>)}</nav>}
          {editorial.sidebarAction && <div className="guide-side-action"><span>{editorial.sidebarAction.label}</span><strong>{editorial.sidebarAction.heading}</strong><Link href={`/egypt-tours/${editorial.sidebarAction.tourSlug}`}>View the tour <ArrowRight size={15}/></Link></div>}
          <Link href="/make-your-trip" className="guide-ad-card">
            <img src="https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=800&q=80" alt="Private Luxury Pyramids Tour" className="guide-ad-card-img" loading="lazy" />
            <div className="guide-ad-card-overlay" />
            <div className="guide-ad-card-content">
              <span className="guide-ad-badge"><Star size={12} fill="currentColor" /> Special VIP Offer</span>
              <h4>Tailor-Made Egypt Journey</h4>
              <p>Skip the tourist lines with a licensed private Egyptologist & luxury vehicle.</p>
              <div className="guide-ad-price">
                <small>Special rate from</small>
                <strong>$65</strong>
              </div>
              <div className="guide-ad-btn">
                Plan My VIP Trip <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        </aside>

        <article className="guide-story">
          {editorial.sections?.map((section) => <GuideSection key={section.id} section={section} tips={editorial.tips} />)}

          {editorial.quote && <blockquote className="guide-quote"><span aria-hidden="true">{'\u201C'}</span><p>{editorial.quote}</p></blockquote>}

          {editorial.checklist && editorial.checklist.length > 0 && <section className="guide-checklist">
            <div><span className="guide-section-number">{String((editorial.sections?.length || 0) + 1).padStart(2, '0')}</span><span className="eyebrow">Before you go</span><h2>Your trip, simplified</h2></div>
            <ul>{editorial.checklist.map((item, i) => <li key={i}><Check size={17}/><span><strong>{item.title}</strong>{item.detail}</span></li>)}</ul>
          </section>}
        </article>
      </div>

      {editorial.cta && <section className="guide-cta">
        <img src={heroImage} alt={heroAlt} loading="lazy"/>
        <div className="guide-cta-shade"/>
        <div className="container guide-cta-content">
          <span>{editorial.cta.eyebrow}</span>
          <h2>{editorial.cta.heading}</h2>
          <p>{editorial.cta.copy}</p>
          <div>
            {editorial.cta.tourSlug && <Link href={`/egypt-tours/${editorial.cta.tourSlug}`} className="primary-btn">{editorial.cta.tourLabel || 'View the tour'} <ArrowRight size={17}/></Link>}
            <Link href="/make-your-trip" className="guide-cta-link">{editorial.cta.customLabel || 'Build my own trip'}</Link>
          </div>
        </div>
      </section>}

      <section className="container guide-related"><div className="guide-related-head"><div><span className="eyebrow">Keep exploring</span><h2>More stories from Egypt</h2></div><Link href="/blogs">All travel stories <ArrowRight size={16}/></Link></div><div className="guide-related-grid">{related.map((blog) => <article key={blog.slug}><Link href={`/blogs/${blog.slug}`}><img src={blog.image} alt={blog.title} loading="lazy"/></Link><small>{blog.category}</small><h3><Link href={`/blogs/${blog.slug}`}>{blog.title}</Link></h3><p>{blog.excerpt}</p></article>)}</div></section>
    </main>
  </SiteShell>
}

export function BlogDetailPage({ slug }: { slug: string }) {
  const item = findBlog(slug)
  if (!item) return <DetailNotFound title="Story not found" copy="The story you were looking for has taken a different route." backHref="/blogs" backLabel="Read all stories"/>
  if (item.editorial) return <BlogEditorialPage item={item}/>
  return <SiteShell><Breadcrumb items={['Blogs',item.title]}/><main className="article-page container"><div className="article-header"><span className="eyebrow">{item.category} · {item.date}</span><h1>{item.title}</h1><p>{item.excerpt}</p></div><img className="article-cover" src={item.image} alt={item.title}/><div className="article-body"><p>Egypt rewards travelers who look a little closer. The great landmarks are only the beginning; the real rhythm of a journey appears in the streets, the meals, the conversations, and the quiet spaces between one stop and the next.</p><h2>Make room for the unexpected</h2><p>Leave space in your itinerary for a second cup of tea, a local market, and the kind of discovery that never appears in a checklist. Our team can help you find that balance.</p><blockquote>Travel slowly enough to notice what makes a place itself.</blockquote><Link href="/make-your-trip" className="primary-btn">Use this inspiration <ArrowRight size={16}/></Link></div></main></SiteShell>
}

export function EventsPage() { return <SiteShell><EditorialHero eyebrow="Calendar of experiences" title="Join Egypt when it feels most alive" copy="Seasonal escapes, cultural weekends, and celebrations designed around the moments worth traveling for." image={siteImages.nile} href="/contact" action="Ask about an event"/><main className="section container"><div className="event-list">{events.map(item=><ContentCard item={item} type="event" key={item.slug}/>)}</div></main></SiteShell> }

export function EventDetailPage({ slug }: { slug: string }) { const item = findEvent(slug); if (!item) return <DetailNotFound title="Event not found" copy="The event you were looking for has taken a different route." backHref="/events" backLabel="See all events"/>; return <SiteShell><EditorialHero eyebrow={item.date} title={item.title} copy={item.copy} image={item.image} href="/contact" action="Ask about availability"/><main className="section container detail-layout"><article><span className="eyebrow"><MapPin size={15}/> {item.location}</span><h2>A reason to gather</h2><p>We pair this special moment with carefully chosen hotels, local hosts, and a route that gives you time to enjoy both the event and the destination around it.</p></article><aside className="booking-card"><h3>Want to join us?</h3><p>Tell us who is traveling and we will share the next available itinerary.</p><Link href="/contact" className="primary-btn">Send an enquiry</Link></aside></main></SiteShell> }

export function OffersPage() { return <SiteShell><EditorialHero eyebrow="Travel well, travel further" title="Special offers for your next Egypt story" copy="Thoughtful extras and seasonal value, available for a limited time." image={siteImages.pyramids} href="/contact" action="Ask about an offer"/><main className="section container"><div className="content-grid offers-grid">{offers.map(item=><ContentCard item={item} type="offer" key={item.slug}/>)}</div></main></SiteShell> }

export function OfferDetailPage({ slug }: { slug: string }) { const item = findOffer(slug); if (!item) return <DetailNotFound title="Offer not found" copy="The offer you were looking for has taken a different route." backHref="/special-offers" backLabel="See all offers"/>; return <SiteShell><EditorialHero eyebrow={item.badge} title={item.title} copy={item.copy} image={item.image} href="/contact" action="Claim this offer"/><main className="section container detail-layout"><article><h2>Make more of your time in Egypt</h2><p>This offer is designed to add ease and value without taking away from the experience. Share your travel dates and we will confirm availability and the exact inclusions for your journey.</p><div className="detail-highlights"><span><Check size={16}/> Personal trip planning</span><span><Check size={16}/> Local support throughout</span><span><Check size={16}/> Clear terms before booking</span></div></article><aside className="booking-card"><h3>Ready to make it yours?</h3><Link href="/contact" className="primary-btn">Contact our team</Link></aside></main></SiteShell> }

export function GuidePage() { const groups: [string, string, string[]][] = [['Ancient civilization', 'Temples, tombs, and five thousand years of stories.', ['Pharaohs', 'Mythology', 'Pyramids', 'Temples', 'Tombs']], ['Tourist attractions', 'Where to go, city by city.', ['Cairo', 'Luxor', 'Aswan', 'Alexandria', 'Sinai', 'Museums', 'Oases']], ['Travel tips', 'Practical know-how before you fly.', ['Before you travel', 'While you are in Egypt', 'Visas', 'Packing', 'Tipping']], ['Destinations', 'Coasts, deserts, cities, and the Nile.', ['Red Sea', 'White Desert', 'Siwa Oasis', 'Nile Valley']], ['Tour packages', 'How to choose the right format.', ['Classic tours', 'Small groups', 'Honeymoon', 'Adventure', 'Spiritual']], ['Sustainability', 'Travel kindly and leave a positive footprint.', ['Local communities', 'Accessible travel', 'Responsible choices']]]; return <SiteShell><EditorialHero eyebrow="Learn before you go" title="Egypt travel guide" copy="Attractions, tips, destinations, and honest advice for planning a smoother journey." image={siteImages.desert} href="/make-your-trip" action="Plan my trip" /><main className="section container"><div className="faq-list">{groups.map(([title, copy, topics]) => <details className="faq-item" key={title}><summary>{title}</summary><p>{copy}</p><div className="location-stops">{topics.map(t => <span key={t}>{t}</span>)}</div></details>)}</div></main><HelpCTA /></SiteShell> }

export function AccessiblePage() { return <SiteShell><EditorialHero eyebrow="Travel for everyone" title="Accessible travel in Egypt" copy="Extra assistance, adapted pacing, and honest advice so every guest can enjoy Egypt comfortably." image={siteImages.pyramids} href="/contact" action="Ask about assistance" /><main><section className="section container split-editorial"><div><span className="eyebrow">5% discount</span><h2>Extra care, on us.</h2><p>Guests requiring accessibility assistance receive 5% off all our tour packages. Tell us what you need and we will adapt vehicles, pacing, hotel rooms, and sightseeing to match.</p><div className="detail-highlights">{['Adapted vehicles', 'Step-free options', 'Patient, trained guides'].map(x => <span key={x}><Check size={16} />{x}</span>)}</div></div><img src={siteImages.temple} alt="Accessible travel in Egypt" /></section><HelpCTA /></main></SiteShell> } export function FAQPage() { const [open,setOpen] = useState(0); return <SiteShell><EditorialHero eyebrow="Questions, answered" title="A smoother way to plan Egypt" copy="Find clear answers to common questions, then talk to our team when you are ready for the details." image={siteImages.temple} href="/contact" action="Ask a question"/><main className="section container faq-page"><div className="faq-intro"><span className="eyebrow">Good to know</span><h2>Before you go</h2><p>We believe planning should feel as welcoming as the trip itself.</p></div><div className="faq-list">{faqs.map(([question,answer],i)=><div className={`faq-item ${open===i?'open':''}`} key={question}><button onClick={()=>setOpen(open===i?-1:i)}><span>{question}</span><b>{open===i?'−':'+'}</b></button>{open===i&&<p>{answer}</p>}</div>)}</div></main></SiteShell> }

export function SearchPage() { const params=useSearchParams(); const initial=parseSearchQuery(params).q; const [query,setQuery]=useState(initial); useEffect(()=>setQuery(initial),[initial]); const results=allSearchItems.filter(item=>`${item.title} ${item.copy}`.toLowerCase().includes(query.toLowerCase())); return <SiteShell><main className="search-page container"><div className="search-page-header"><span className="eyebrow">Explore the site</span><h1>Find your next Egypt story</h1><label><Search size={20}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value.slice(0,120))} placeholder="Search tours, destinations, stories..."/></label></div><div className="search-results"><p>{results.length} result{results.length===1?'':'s'}{query?` for “${query}”`:''}</p><div className="content-grid">{results.map(item=><article className="content-card" key={`${item.type}-${item.slug}`}><img className="content-image" src={item.image} alt={item.title}/><div className="content-card-body"><small>{item.type}</small><h3>{item.title}</h3><p>{item.copy}</p><Link href={item.type==='Blog'?`/blogs/${item.slug}`:item.type==='Event'?`/events/${item.slug}`:item.type==='Offer'?`/special-offers/${item.slug}`:`/destinations/${item.slug}`} className="text-link">Explore <ArrowRight size={15}/></Link></div></article>)}</div></div></main></SiteShell> }

export function PolicyPage({ type }: { type: 'privacy' | 'terms' }) { const title=type==='privacy'?'Privacy Policy':'Terms and Conditions'; return <SiteShell><Breadcrumb items={[title]}/><main className="policy-page container"><span className="eyebrow">STAR PYRAMIDS Tours</span><h1>{title}</h1><p className="policy-lede">Clear, respectful, and easy to understand. These notes explain how we work with you.</p>{policies[type].map(item=><section key={item.h}><h2>{item.h}</h2><p>{item.p}</p></section>)}</main></SiteShell> }

export function RegisterPage() { return <AuthPage title="Create your account" copy="Save trips, keep enquiries together, and make planning feel easier." button="Create account"/> }
export function ForgotPasswordPage() { return <AuthPage title="Reset your password" copy="Enter your email and we will send a secure reset link." button="Send reset link"/> }
export function AuthPage({ title, copy, button }: { title: string; copy: string; button: string }) { const [sent,setSent]=useState(false); return <SiteShell><main className="auth-page-centered"><div className="auth-card"><div className="auth-mobile-logo"><Link href="/"><span className="brand-copy"><strong>STAR PYRAMIDS</strong><small>SINCE 1970</small></span></Link></div>{sent?<div className="form-success"><Check size={34}/><h2>Check your inbox</h2><p>We have sent the next steps to your email.</p></div>:<><span className="eyebrow">Your travel account</span><h1>{title}</h1><p>{copy}</p><form className="contact-form" onSubmit={(e)=>{e.preventDefault();setSent(true)}}><label>Email address<input required type="email" placeholder="you@example.com"/></label><label>Password<input required type="password" placeholder="At least 8 characters"/></label><button className="auth-submit" type="submit">{button}</button></form><p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p></>}</div></main></SiteShell> }

export function AccountPage({ section = 'overview' }: { section?: string }) { const nav=[['Overview','/account'],['My bookings','/account/bookings'],['Favorites','/account/favorites'],['Profile settings','/account/profile']]; return <SiteShell><main className="account-page container"><aside className="account-nav"><span className="eyebrow">Your account</span><h1>Welcome back</h1>{nav.map(([label,href])=><Link className={section===label.toLowerCase().replace(' ','-')?'active':''} key={href} href={href}>{label}<ArrowRight size={15}/></Link>)}<Link href="/">Sign out</Link></aside><section className="account-content"><span className="eyebrow">{section === 'overview' ? 'Your travel desk' : section}</span><h2>{section === 'overview' ? 'Make space for your next adventure.' : section === 'bookings' ? 'Your bookings' : section === 'favorites' ? 'Saved journeys' : 'Profile settings'}</h2>{section==='overview'?<><div className="account-stats"><div><strong>0</strong><span>Upcoming trips</span></div><div><strong>0</strong><span>Saved tours</span></div><div><strong>1</strong><span>Open enquiry</span></div></div><div className="account-empty"><h3>Your next chapter starts here.</h3><p>Explore our journeys and save the ones that make you curious.</p><Link href="/egypt-tours/one-day-tours" className="primary-btn">Browse tours</Link></div></>:<div className="account-empty"><h3>Nothing here yet.</h3><p>When you are ready, your STAR PYRAMIDS travel details will appear in this space.</p><Link href="/make-your-trip" className="primary-btn">Start planning</Link></div>}</section></main></SiteShell> }
