'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, CalendarCheck, CalendarDays, Camera, Check, CircleAlert, Clock3, Compass, CarFront, Gift, Headphones, Mail, MapPin, MessageCircle, Minus, Phone, Plus, Search, Send, Share2, ShieldCheck, Sparkles, Star, Sun, Ticket, Users, type LucideIcon } from 'lucide-react'
import { blogs, cars, destinations, events, faqs, offers, policies, siteImages, allSearchItems, findBlog, findCar, findDestination, findEvent, findOffer } from '@/data/content'
import { isCustomSlug, useBrandSettings, useLiveCollection, useLiveDestinations, useLiveEvents, useLiveFind, useLiveTours } from '@/lib/admin-store'
import { eventCity, eventMapQuery, eventPriceLabel, eventStatusLabel, getEventStatus, getPublishedEvents, getRelatedEvents, isEventPublished, parseLegacyEventRange, resolveEventRange } from '@/lib/events'
import { EventRequestForm } from './event-request-form'
import { phoneHref, whatsappHref } from '@/data/company'
import { findTour, getTourOffer, seasonalOfferDeadline, seasonalTours } from '@/data/tours'
import type { Blog, Car, Event, Offer, Tour } from '@/data/types'
import { parseCarRequestQuery, parseSearchQuery } from '@/lib/query'
import { CAR_LOCATION_MAX, CAR_NOTE_MAX, clearCarPreview, hasCarErrors, readCarPreview, recordCarRequestPreview, validateCarRequest, type CarFieldErrors, type CarRequestDraft, type CarRequestPreview } from '@/lib/car-request'
import { countries, defaultCountry } from '@/data/countries'
import { arabicCountryNames } from './auth-pages'
import { ImpersonationBanner } from './impersonation-banner'
import { useLocale, formatPrice } from './locale'
import { Breadcrumb, Heading, HelpCTA, PageShowcaseHero, SiteShell, TourCard, extra, images } from '@/components/site'
import { PromotionCard, promotionGalleryForTour } from '@/components/promotion-card'

export function EditorialHero({ eyebrow, title, copy, image = siteImages.pyramids, action = 'Explore with us', href = '/egypt-tours/one-day-tours' }: { eyebrow?: string; title: string; copy: string; image?: string; action?: string; href?: string }) {
  return <section className="editorial-hero"><img src={image} alt=""/><div className="editorial-overlay"/><div className="container editorial-content">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1><p>{copy}</p><Link className="primary-btn" href={href}>{action}<ArrowRight size={17}/></Link></div></section>
}

export function DetailNotFound({ title, copy, backHref, backLabel }: { title: string; copy: string; backHref: string; backLabel: string }) {
  return <SiteShell><main className="not-found"><div className="not-found-mark">404</div><h1>{title}</h1><p>{copy}</p><Link href={backHref} className="primary-btn">{backLabel}</Link></main></SiteShell>
}

export function ContentCard({ item, type = 'blog' }: { item: Blog | Event | Offer; type?: 'blog' | 'event' | 'offer' }) {
  const { locale } = useLocale()
  const href = type === 'blog' ? `/blogs/${item.slug}` : type === 'event' ? `/events/${item.slug}` : type === 'offer' ? `/special-offers/${item.slug}` : `/destinations/${item.slug}`
  const badge = 'badge' in item ? item.badge : undefined
  const meta = 'category' in item ? `${item.category}, ${item.date}` : 'date' in item ? item.date : undefined
  const description = 'excerpt' in item ? item.excerpt : item.copy
  return <article className="content-card"><Link href={href} className="content-image"><img src={item.image} alt={item.title}/>{badge && <b>{badge}</b>}</Link><div className="content-card-body">{meta && <small>{meta}</small>}<h3><Link href={href}>{item.title}</Link></h3><p>{description}</p><Link className="text-link" href={href}>{locale === 'ar' ? 'اقرأ المزيد' : 'Read more'} <ArrowRight size={15}/></Link></div></article>
}

export { AboutPage } from './about-page'

export function ContactPage() {
  return <SiteShell><ContactPageContent /></SiteShell>
}

function ContactPageContent() {
  const { locale: cl } = useLocale()
  const brand = useBrandSettings()
  const ar = cl === 'ar'
  const ex = extra[cl]
  const contactMethods = [
    { Icon: Mail, title: ar ? 'راسل فريق الرحلات' : 'Email our travel team', value: brand.email, note: ar ? 'لبرامج الرحلات والأسئلة العامة' : 'For itineraries and general questions', href: `mailto:${brand.email}` },
    { Icon: Phone, title: ar ? 'اتصل بفريقنا' : 'Call our travel team', value: brand.phone, note: ar ? 'للتواصل المباشر والاستفسارات' : 'For direct enquiries and travel help', href: phoneHref(brand.phone) },
    { Icon: MessageCircle, title: ar ? 'راسلنا على واتساب' : 'Chat with us on WhatsApp', value: brand.whatsapp, note: ar ? 'ابدأ محادثة واتساب مباشرة' : 'Start a direct WhatsApp conversation', href: whatsappHref(brand.whatsapp) },
  ]
  const steps = ar
    ? [['01', 'احكيلنا عن رحلتك', 'شاركنا مواعيدك، عدد المسافرين، والأماكن اللي نفسك تشوفها.'], ['02', 'نرتب التفاصيل', 'فريقنا المحلي يراجع فكرتك ويجمع أنسب مسار وتجارب ليك.'], ['03', 'تستلم تصور واضح', 'نرجعلك بخطة مفهومة وتفاصيل جاهزة للمراجعة قبل أي التزام.']]
    : [['01', 'Tell us about your trip', 'Share your dates, group size, and the places you want to experience.'], ['02', 'We shape the details', 'Our local team reviews your idea and connects the right route and experiences.'], ['03', 'Receive a clear proposal', 'We return with an easy-to-review plan before you make any commitment.']]

  return <main className="contact-v2">
      <PageShowcaseHero image={siteImages.nile} eyebrow={ar ? 'فريق محلي, تخطيط شخصي' : 'Local team, personal planning'} title={ar ? 'رحلتك لمصر تبدأ بمحادثة.' : 'Your Egypt journey starts with a conversation.'} intro={ar ? 'قولنا نفسك تشوف مصر إزاي، وإحنا نساعدك تحول الفكرة لمسار متوازن يناسب وقتك واهتماماتك.' : 'Tell us how you want to experience Egypt, and we will help turn the idea into a thoughtful route shaped around your time and interests.'} primaryLabel={ar ? 'ابدأ المحادثة' : 'Start the conversation'} primaryHref="#contact-enquiry" secondaryLabel={ar ? 'خطط رحلتك بالتفصيل' : 'Build a detailed trip'} secondaryHref="/make-your-trip" railLabel={ar ? 'ابدأ من هنا' : 'Start here'} railTitle={ar ? 'احكيلنا عن الرحلة اللي في بالك.' : 'Tell us the journey you have in mind.'} railHref="#contact-enquiry" railMeta={[{ Icon: MessageCircle, label: ar ? 'طلب تجريبي' : 'Preview enquiry' }, { Icon: ShieldCheck, label: ar ? 'لا يتم إرسال بيانات' : 'No data sent' }]} statsLabel={ar ? 'ملخص التواصل' : 'Contact summary'} stats={[{ value: contactMethods.length, label: ar ? 'طرق للتواصل' : 'Ways to connect' }, { value: steps.length, label: ar ? 'خطوات للتخطيط' : 'Planning steps' }]}/>
      <Breadcrumb items={[ex.contactTitle]}/>

      <section className="contact-v2-trust" aria-label={ar ? 'مميزات التواصل معنا' : 'Reasons to contact us'}>
        <div className="container">
          <span><MapPin size={20} /><b>{ar ? 'خبرة محلية داخل مصر' : 'Egypt-based local insight'}</b></span>
          <span><Clock3 size={20} /><b>{ar ? 'تخطيط حسب وقتك' : 'Planning around your time'}</b></span>
          <span><ShieldCheck size={20} /><b>{ar ? 'تفاصيل واضحة قبل الحجز' : 'Clear details before booking'}</b></span>
        </div>
      </section>

      <section id="contact-enquiry" className="container contact-v2-main">
        <div className="contact-v2-intro">
          <span className="eyebrow">{ar ? 'خلينا نخططها سوا' : 'Let us plan it together'}</span>
          <h2>{ar ? 'إيه شكل الرحلة اللي في بالك؟' : 'What kind of journey do you have in mind?'}</h2>
          <p>{ar ? 'سواء يوم واحد في القاهرة، باكدج كاملة، نايل كروز، أو استقبال من المطار، ابعتلنا الفكرة الأساسية وسيب التفاصيل علينا.' : 'Whether it is one day in Cairo, a complete package, a Nile cruise, or an airport transfer, send us the starting point and let our team connect the details.'}</p>
          <div className="contact-v2-methods">
            {contactMethods.map(({ Icon, ...method }) => <a href={method.href} key={method.title} className="contact-v2-method" target={method.href.startsWith('https://wa.me/') ? '_blank' : undefined} rel={method.href.startsWith('https://wa.me/') ? 'noreferrer' : undefined}>
              <Icon size={22} />
              <span><small>{method.title}</small><strong>{method.value}</strong><em>{method.note}</em></span>
              <ArrowRight size={18} />
            </a>)}
          </div>
          <a className="contact-v2-address" href={brand.mapUrl || undefined} target={brand.mapUrl ? '_blank' : undefined} rel={brand.mapUrl ? 'noreferrer' : undefined}><MapPin size={22} /><span><small>{ex.addrT}</small><strong>{brand.address}</strong></span></a>
        </div>
        <div className="contact-v2-form-wrap">
          <header><span>{ar ? 'طلب رحلة' : 'Trip enquiry'}</span><h2>{ar ? 'ابدأ من هنا.' : 'Start here.'}</h2><p>{ar ? 'كل ما تحكيلنا أكتر، نقدر نساعدك بصورة أدق.' : 'The more you share, the more useful our first response can be.'}</p></header>
          <ContactForm />
        </div>
      </section>

      <section className="contact-v2-process">
        <div className="container">
          <header><span className="eyebrow">{ar ? 'بعد ما تبعتلنا' : 'What happens next'}</span><h2>{ar ? 'من أول رسالة لخطة رحلة واضحة.' : 'From first message to a clear travel plan.'}</h2></header>
          <div>{steps.map(([number, title, copy]) => <article key={number}><b>{number}</b><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="container contact-v2-faq">
        <div><span className="eyebrow">{ex.faqTeaser}</span><h2>{ar ? 'قبل ما تراسلنا.' : 'Before you get in touch.'}</h2><p>{ar ? 'إجابات سريعة على الأسئلة اللي غالبًا بتبدأ بيها الرحلة.' : 'Quick answers to the questions that usually begin a journey.'}</p></div>
        <div>{faqs.slice(0, 3).map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}<Link className="text-link" href="/faq">{ex.seeMore} <ArrowRight size={15} /></Link></div>
      </section>
    </main>
}

export function ContactForm() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [sent, setSent] = useState(false)
  if (sent) return <div className="form-success contact-v2-success"><Check size={38} /><span>{ar ? 'تم في النسخة التجريبية' : 'Preview complete'}</span><h2>{ar ? 'وصلنا لفكرة رحلتك.' : 'We have your trip idea.'}</h2><p>{ar ? 'ده تأكيد تجريبي داخل الموقع فقط، ولم يتم إرسال أي بيانات.' : 'This is an on-site preview confirmation. No details were transmitted.'}</p><button type="button" className="outline-btn" onClick={() => setSent(false)}>{ar ? 'اكتب رسالة جديدة' : 'Write another message'}</button></div>
  return <form className="contact-form contact-v2-form" onSubmit={(event) => { event.preventDefault(); setSent(true) }}>
    <div className="form-grid">
      <label>{ar ? 'الاسم بالكامل' : 'Full name'}<input required autoComplete="name" placeholder={ar ? 'اسمك' : 'Your name'} /></label>
      <label>{ar ? 'البريد الإلكتروني' : 'Email address'}<input required type="email" autoComplete="email" placeholder="you@example.com" /></label>
      <label className="full">{ar ? 'نوع الرحلة' : 'What can we help with?'}<select required defaultValue=""><option value="" disabled>{ar ? 'اختار نوع الرحلة' : 'Choose a trip type'}</option><option>{ar ? 'رحلة يوم واحد' : 'One-day tour'}</option><option>{ar ? 'باكدج متعددة الأيام' : 'Multi-day package'}</option><option>{ar ? 'نايل كروز' : 'Nile cruise'}</option><option>{ar ? 'رحلة شاطئية' : 'Shore excursion'}</option><option>{ar ? 'تأجير عربية أو استقبال' : 'Car hire or transfer'}</option><option>{ar ? 'رحلة مصممة مخصوص' : 'Custom journey'}</option></select></label>
      <label className="full">{ar ? 'احكيلنا عن الرحلة' : 'Tell us about your trip'}<textarea required placeholder={ar ? 'المواعيد، عدد المسافرين، والأماكن أو التجارب اللي مهتم بيها...' : 'Dates, group size, and the places or experiences you are interested in...'} /></label>
    </div>
    <button className="primary-btn" type="submit">{ar ? 'إرسال طلب تجريبي' : 'Send preview enquiry'} <Send size={17} /></button>
    <small className="contact-v2-form-note"><ShieldCheck size={14} />{ar ? 'نموذج تجريبي: بياناتك لا تغادر هذه الصفحة.' : 'Preview form: your details do not leave this page.'}</small>
  </form>
}

export function CarsPage() {
  return <SiteShell><CarsPageContent /></SiteShell>
}

function CarsPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveCars = useLiveCollection('cars', cars)
  const featured = liveCars[2] ?? liveCars[0]
  const maxSeats = liveCars.length ? Math.max(...liveCars.map((car) => Number.parseInt(car.seats, 10) || 0)) : 0
  if (!featured) return <main><div className="container"><section className="section"><div className="section-heading"><span className="eyebrow">{ar ? 'الأسطول' : 'Our fleet'}</span><h2>{ar ? 'لا توجد سيارات متاحة حاليًا' : 'No vehicles listed right now'}</h2><p>{ar ? 'عُد لاحقًا أو تواصل معنا وسنساعدك في ترتيب انتقالك.' : 'Check back later or contact us and we will help arrange your transfer.'}</p><Link href="/contact" className="primary-btn">{ar ? 'تواصل معنا' : 'Contact us'} <ArrowRight size={16} /></Link></div></section></div></main>
  return <main>
    <PageShowcaseHero image={featured.image} eyebrow={ar ? 'سائقون خصوصيون وأسطول حديث' : 'Private drivers & modern fleet'} title={ar ? 'تنقّل في مصر براحة تامة' : 'Move through Egypt with ease'} intro={ar ? 'استقبال من المطار ورحلات يومية وخطوط بين المدن مع سائق خاص وسيارات حديثة مكيفة.' : 'Airport pickups, day trips, and multi-city routes with a private driver and modern air-conditioned cars.'} primaryLabel={ar ? 'استكشف الأسطول' : 'Explore the fleet'} primaryHref="#fleet" secondaryLabel={ar ? 'اطلب هذه السيارة' : 'Request this vehicle'} secondaryHref={`/rent-car/request?vehicle=${featured.slug}`} railLabel={ar ? 'سيارة مميزة' : 'Featured vehicle'} railTitle={featured.title} railHref={`/rent-car/request?vehicle=${featured.slug}`} railMeta={[{ Icon: Users, label: featured.seats }, { Icon: CarFront, label: featured.transmission }]} statsLabel={ar ? 'ملخص الأسطول' : 'Fleet summary'} stats={[{ value: liveCars.length, label: ar ? 'خيارات سيارات' : 'Fleet choices' }, { value: maxSeats, label: ar ? 'مقعدًا كحد أقصى' : 'Seats maximum' }]}/>
    <div className="container">
    <section id="fleet" className="section">
      <div className="section-heading inline-heading"><div><span className="eyebrow">{ar ? 'الأسطول' : 'Our fleet'}</span><h2>{ar ? 'راحة لكل نوع رحلة' : 'Comfort for every kind of journey'}</h2></div><Link className="text-link" href="/rent-car/request">{ar ? 'هل تحتاج إلى سيارة مخصصة؟' : 'Need a custom vehicle?'} <ArrowRight size={15} /></Link></div>
      <div className="fleet-grid">{liveCars.map((car) => <CarCard key={car.slug} car={car} />)}</div>
    </section>
    </div>
  </main>
}

export function CarCard({ car }: { car: Car }) {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  return <article className="fleet-card">
    <div className="fleet-card-img">
      <img
        src={car.image}
        alt={car.title}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = '/fleet-vehicle-fallback.svg'
        }}
      />
      <span className="fleet-price-badge">{formatPrice(car.dailyPrice, currency, locale)}<small>{ar ? ' / يوم' : ' / day'}</small></span>
    </div>
    <div className="fleet-card-body">
      <div className="fleet-specs"><span><Users size={14} />{car.seats}</span><span><CarFront size={14} />{car.transmission}</span></div>
      <h3>{car.title}</h3>
      <p>{car.copy}</p>
      {car.credit && <small className="fleet-credit"><a href={car.credit.url} target="_blank" rel="noreferrer">{car.credit.label}</a></small>}
      <Link href={`/rent-car/request?vehicle=${car.slug}`} className="primary-btn fleet-cta">{ar ? 'اطلب هذه السيارة' : 'Request this car'} <ArrowRight size={16} /></Link>
    </div>
  </article>
}

type CarRequestValues = { vehicleSlug: string; tripType: '' | 'One Way' | 'Round Trip'; pickup: string; dropoff: string; pickupDate: string; returnDate: string; passengers: string; fullName: string; email: string; phone: string; notes: string }

function carTodayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function focusCarField(id: string) {
  const el = document.getElementById(id)
  if (el) {
    if (!el.hasAttribute('tabindex') && !/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(el.tagName)) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: false })
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

function CarRequestForm({ values, errors, summary, onChange, onSubmit }: { values: CarRequestValues; errors: CarFieldErrors; summary: string; onChange: (patch: Partial<CarRequestValues>) => void; onSubmit: (e: React.FormEvent) => void }) {
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const liveCars = useLiveCollection('cars', cars)
  const today = carTodayLocal()
  const errText = (field: keyof CarFieldErrors): string => {
    const code = errors[field]
    if (!code) return ''
    if (field === 'passengers' && values.passengers.trim() === '') return ar ? 'أدخل عدد الركاب.' : 'Enter the number of passengers.'
    const en: Record<string, string> = {
      vehicle: code === 'required' ? 'Select a vehicle.' : 'Select a vehicle from the fleet list.',
      tripType: 'Choose One Way or Round Trip.',
      pickup: code === 'required' ? 'Enter the pick-up location.' : `Pick-up location must be ${CAR_LOCATION_MAX} characters or fewer.`,
      dropoff: code === 'required' ? 'Enter the drop-off location.' : `Drop-off location must be ${CAR_LOCATION_MAX} characters or fewer.`,
      pickupDate: code === 'required' ? 'Enter your preferred pick-up date.' : 'Enter a valid preferred pick-up date (today or later).',
      returnDate: code === 'required' ? 'Enter your preferred return date.' : 'Enter a valid preferred return date on or after the pick-up date.',
      passengers: 'Passengers must be a whole number from 1 to 50.',
      name: code === 'required' ? 'Enter your full name.' : 'Enter a name with at least 2 letters.',
      email: code === 'required' ? 'Enter your email address.' : 'Enter a valid email address (name@example.com).',
      phone: code === 'required' ? 'Enter your phone number.' : 'Enter a valid phone number (at least 7 digits).',
      notes: `Notes must be ${CAR_NOTE_MAX} characters or fewer.`,
    }
    const arText: Record<string, string> = {
      vehicle: code === 'required' ? 'اختر السيارة.' : 'اختر سيارة من قائمة الأسطول.',
      tripType: 'اختر ذهاب فقط أو ذهاب وعودة.',
      pickup: code === 'required' ? 'أدخل مكان الاستلام.' : `يجب ألا يتجاوز مكان الاستلام ${CAR_LOCATION_MAX} حرفًا.`,
      dropoff: code === 'required' ? 'أدخل مكان الوصول.' : `يجب ألا يتجاوز مكان الوصول ${CAR_LOCATION_MAX} حرفًا.`,
      pickupDate: code === 'required' ? 'أدخل تاريخ الاستلام المفضل.' : 'أدخل تاريخ استلام مفضلًا صالحًا (اليوم أو بعده).',
      returnDate: code === 'required' ? 'أدخل تاريخ العودة المفضل.' : 'أدخل تاريخ عودة مفضلًا صالحًا في تاريخ الاستلام أو بعده.',
      passengers: 'يجب أن يكون عدد الركاب رقمًا صحيحًا من 1 إلى 50.',
      name: code === 'required' ? 'أدخل اسمك الكامل.' : 'أدخل اسمًا من حرفين على الأقل.',
      email: code === 'required' ? 'أدخل بريدك الإلكتروني.' : 'أدخل بريدًا إلكترونيًا صالحًا (name@example.com).',
      phone: code === 'required' ? 'أدخل رقم هاتفك.' : 'أدخل رقم هاتف صالحًا (7 أرقام على الأقل).',
      notes: `يجب ألا تتجاوز الملاحظات ${CAR_NOTE_MAX} حرف.`,
    }
    return ar ? arText[field] : en[field]
  }
  return <form className="contact-form" onSubmit={onSubmit} noValidate>
    {summary !== '' && <p className="co-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px' }}><CircleAlert size={15} />{summary}</p>}
    <div className="form-grid">
      <label className="full" htmlFor="car-vehicle">{ar ? 'السيارة' : 'Vehicle'} <em className="req" aria-hidden="true">*</em><select id="car-vehicle" required value={values.vehicleSlug} onChange={(e) => onChange({ vehicleSlug: e.target.value })} aria-invalid={Boolean(errors.vehicle)} aria-describedby={errors.vehicle ? 'car-vehicle-error' : undefined}><option value="">{ar ? 'اختر السيارة' : 'Select a vehicle'}</option>{liveCars.map((c) => <option key={c.slug} value={c.slug}>{c.title} ({formatPrice(c.dailyPrice, currency, locale)}{ar ? ' / يوم' : ' / day'})</option>)}</select>{errors.vehicle && <span className="field-error" id="car-vehicle-error" role="alert">{errText('vehicle')}</span>}</label>
      <div className="full req-trip-type"><span id="req-trip-label">{ar ? 'نوع الرحلة' : 'Trip type'} <em className="req" aria-hidden="true">*</em></span><div role="radiogroup" aria-labelledby="req-trip-label" aria-describedby={errors.tripType ? 'car-triptype-error' : undefined}>{(['One Way', 'Round Trip'] as const).map((opt) => <button key={opt} type="button" role="radio" aria-checked={values.tripType === opt} className={values.tripType === opt ? 'active' : ''} onClick={() => onChange({ tripType: values.tripType === opt ? '' : opt })}>{opt === 'One Way' ? (ar ? 'ذهاب فقط' : 'One Way') : (ar ? 'ذهاب وعودة' : 'Round Trip')}</button>)}</div>{errors.tripType && <span className="field-error" id="car-triptype-error" role="alert">{errText('tripType')}</span>}</div>
      <label className="full" htmlFor="car-pickup">{ar ? 'مكان الاستلام' : 'Pick-up location'} <em className="req" aria-hidden="true">*</em><input id="car-pickup" required placeholder={ar ? 'المطار أو الفندق أو المدينة' : 'Airport, hotel, or city'} maxLength={CAR_LOCATION_MAX} value={values.pickup} onChange={(e) => onChange({ pickup: e.target.value })} aria-invalid={Boolean(errors.pickup)} aria-describedby={errors.pickup ? 'car-pickup-error' : undefined} />{errors.pickup && <span className="field-error" id="car-pickup-error" role="alert">{errText('pickup')}</span>}</label>
      <label className="full" htmlFor="car-dropoff">{ar ? 'مكان الوصول' : 'Drop-off location'} <em className="req" aria-hidden="true">*</em><input id="car-dropoff" required placeholder={ar ? 'إلى أين تريد الذهاب؟' : 'Where are you going?'} maxLength={CAR_LOCATION_MAX} value={values.dropoff} onChange={(e) => onChange({ dropoff: e.target.value })} aria-invalid={Boolean(errors.dropoff)} aria-describedby={errors.dropoff ? 'car-dropoff-error' : undefined} />{errors.dropoff && <span className="field-error" id="car-dropoff-error" role="alert">{errText('dropoff')}</span>}</label>
      <label htmlFor="car-pickup-date">{ar ? 'تاريخ الاستلام المفضل' : 'Preferred pick-up date'} <em className="req" aria-hidden="true">*</em><input id="car-pickup-date" required type="date" min={today} dir="ltr" value={values.pickupDate} onChange={(e) => onChange({ pickupDate: e.target.value })} aria-invalid={Boolean(errors.pickupDate)} aria-describedby={errors.pickupDate ? 'car-pickup-date-error' : undefined} />{errors.pickupDate && <span className="field-error" id="car-pickup-date-error" role="alert">{errText('pickupDate')}</span>}</label>
      {values.tripType === 'Round Trip'
        ? <label htmlFor="car-return-date">{ar ? 'تاريخ العودة المفضل' : 'Preferred return date'} <em className="req" aria-hidden="true">*</em><input id="car-return-date" required type="date" min={values.pickupDate || today} dir="ltr" value={values.returnDate} onChange={(e) => onChange({ returnDate: e.target.value })} aria-invalid={Boolean(errors.returnDate)} aria-describedby={errors.returnDate ? 'car-return-date-error' : undefined} />{errors.returnDate && <span className="field-error" id="car-return-date-error" role="alert">{errText('returnDate')}</span>}</label>
        : <label htmlFor="car-passengers">{ar ? 'عدد الركاب' : 'Passengers'} <em className="req" aria-hidden="true">*</em><input id="car-passengers" required type="number" min="1" max="50" placeholder="2" dir="ltr" value={values.passengers} onChange={(e) => onChange({ passengers: e.target.value })} aria-invalid={Boolean(errors.passengers)} aria-describedby={errors.passengers ? 'car-passengers-error' : undefined} />{errors.passengers && <span className="field-error" id="car-passengers-error" role="alert">{errText('passengers')}</span>}</label>}
      {values.tripType === 'Round Trip' && <label className="full" htmlFor="car-passengers-rt">{ar ? 'عدد الركاب' : 'Passengers'} <em className="req" aria-hidden="true">*</em><input id="car-passengers-rt" required type="number" min="1" max="50" placeholder="2" dir="ltr" value={values.passengers} onChange={(e) => onChange({ passengers: e.target.value })} aria-invalid={Boolean(errors.passengers)} aria-describedby={errors.passengers ? 'car-passengers-error' : undefined} />{errors.passengers && <span className="field-error" id="car-passengers-error" role="alert">{errText('passengers')}</span>}</label>}
      <label className="full" htmlFor="car-name">{ar ? 'الاسم الكامل' : 'Full name'} <em className="req" aria-hidden="true">*</em><input id="car-name" required placeholder={ar ? 'اكتب اسمك الكامل' : 'Your full name'} maxLength={80} autoComplete="name" value={values.fullName} onChange={(e) => onChange({ fullName: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'car-name-error' : undefined} />{errors.name && <span className="field-error" id="car-name-error" role="alert">{errText('name')}</span>}</label>
      <label htmlFor="car-email">{ar ? 'البريد الإلكتروني' : 'Email'} <em className="req" aria-hidden="true">*</em><input id="car-email" required type="email" placeholder="you@example.com" maxLength={120} autoComplete="email" dir="ltr" value={values.email} onChange={(e) => onChange({ email: e.target.value })} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'car-email-error' : undefined} />{errors.email && <span className="field-error" id="car-email-error" role="alert">{errText('email')}</span>}</label>
      <label htmlFor="car-phone">{ar ? 'رقم الهاتف' : 'Phone'} <em className="req" aria-hidden="true">*</em><input id="car-phone" required type="tel" placeholder="+20 ..." maxLength={24} autoComplete="tel" dir="ltr" value={values.phone} onChange={(e) => onChange({ phone: e.target.value })} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'car-phone-error' : undefined} />{errors.phone && <span className="field-error" id="car-phone-error" role="alert">{errText('phone')}</span>}</label>
      <label className="full" htmlFor="car-notes">{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea id="car-notes" placeholder={ar ? 'حدثنا عن خط سيرك' : 'Tell us about your route'} maxLength={CAR_NOTE_MAX + 1} value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? 'car-notes-error' : 'car-notes-hint'} />{errors.notes && <span className="field-error" id="car-notes-error" role="alert">{errText('notes')}</span>}<small id="car-notes-hint" style={{ color: 'var(--muted)', fontWeight: 500 }}>{values.notes.length}/{CAR_NOTE_MAX}</small></label>
    </div>
    <button className="primary-btn" type="submit">{ar ? 'تجهيز الطلب' : 'Prepare request'} <ArrowRight size={17} /></button>
  </form>
}

export function CarRequestPage() {
  return <SiteShell><Suspense><CarRequestContent /></Suspense></SiteShell>
}

function CarRequestContent() {
  const brand = useBrandSettings()
  const params = useSearchParams()
  const initial = parseCarRequestQuery(params)
  const rawVehicleSlug = (() => {
    const raw = (params.get('vehicle') ?? '').trim().slice(0, 80)
    return /^[a-z0-9-]{1,80}$/.test(raw) ? raw : ''
  })()
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const liveCars = useLiveCollection('cars', cars)
  const [values, setValues] = useState<CarRequestValues>({ vehicleSlug: initial.vehicle?.slug ?? rawVehicleSlug, tripType: initial.tripType ?? '', pickup: initial.pickup, dropoff: initial.dropoff, pickupDate: initial.date, returnDate: '', passengers: '', fullName: '', email: '', phone: '', notes: '' })
  const [placed, setPlaced] = useState<CarRequestPreview | null>(null)
  const [storedBanner, setStoredBanner] = useState<CarRequestPreview | null>(null)
  // Stable identity of the currently saved browser-local preview. Set when a
  // preview is created or a stored one is resumed; cleared only on discard.
  // Edit keeps it, so preparing the preview again re-records the SAME request.
  const [activeRef, setActiveRef] = useState<string | null>(null)
  const [errors, setErrors] = useState<CarFieldErrors>({})
  const [summary, setSummary] = useState('')
  const patch = (p: Partial<CarRequestValues>) => setValues((v) => ({ ...v, ...p }))
  const vehicle = liveCars.find((car) => car.slug === values.vehicleSlug)
  const step = placed ? 3 : vehicle ? 2 : 1
  const notSet = ar ? 'لم يحدد' : 'Not set'
  const tripLabel = values.tripType === '' ? notSet : values.tripType === 'One Way' ? (ar ? 'ذهاب فقط' : 'One Way') : (ar ? 'ذهاب وعودة' : 'Round Trip')
  const steps = [ar ? 'اختيار السيارة' : 'Choose vehicle', ar ? 'تفاصيل الرحلة' : 'Trip details', ar ? 'معاينة الطلب' : 'Request preview']
  const hasQuerySignal = Boolean(initial.vehicle || rawVehicleSlug || initial.pickup || initial.dropoff || initial.date || initial.tripType)

  // Resume: prefill the form from the single versioned browser-local preview
  // when the URL carries no request signal of its own. Refresh only reads and
  // restores here — it never generates a reference. Malformed data is ignored.
  useEffect(() => {
    if (hasQuerySignal) return
    const stored = readCarPreview()
    if (!stored) return
    const d = stored.draft
    setValues({ vehicleSlug: d.vehicleSlug, tripType: d.tripType, pickup: d.pickup, dropoff: d.dropoff, pickupDate: d.preferredPickupDate, returnDate: d.preferredReturnDate, passengers: String(d.passengers), fullName: d.contact.fullName, email: d.contact.email, phone: d.contact.phone, notes: d.notes })
    setActiveRef(stored.localRef)
    setStoredBanner(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildDraft = (): CarRequestDraft => {
    const pax = values.passengers.trim()
    return {
      vehicleSlug: values.vehicleSlug,
      tripType: values.tripType,
      pickup: values.pickup.trim(),
      dropoff: values.dropoff.trim(),
      preferredPickupDate: values.pickupDate,
      preferredReturnDate: values.tripType === 'Round Trip' ? values.returnDate : '',
      passengers: pax === '' ? Number.NaN : Number(pax),
      notes: values.notes.trim().slice(0, CAR_NOTE_MAX + 1),
      contact: { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim() },
      currency,
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = buildDraft()
    const errs = validateCarRequest(raw)
    if (!vehicle) errs.vehicle = 'invalid'
    setErrors(errs)
    if (hasCarErrors(errs)) {
      setSummary(ar ? 'تعذر إنشاء المعاينة. راجع الحقول الموضحة أدناه.' : 'Could not create the preview. Review the highlighted fields below.')
      const ids: Record<keyof CarFieldErrors, string> = { vehicle: 'car-vehicle', tripType: 'req-trip-label', pickup: 'car-pickup', dropoff: 'car-dropoff', pickupDate: 'car-pickup-date', returnDate: 'car-return-date', passengers: values.tripType === 'Round Trip' ? 'car-passengers-rt' : 'car-passengers', name: 'car-name', email: 'car-email', phone: 'car-phone', notes: 'car-notes' }
      const order: Array<keyof CarFieldErrors> = ['vehicle', 'tripType', 'pickup', 'dropoff', 'pickupDate', 'returnDate', 'passengers', 'name', 'email', 'phone', 'notes']
      for (const field of order) {
        if (errs[field]) {
          focusCarField(ids[field])
          break
        }
      }
      return
    }
    const preview = recordCarRequestPreview({ ...raw, notes: raw.notes.slice(0, CAR_NOTE_MAX) }, activeRef)
    setErrors({})
    setSummary('')
    setStoredBanner(null)
    setActiveRef(preview.localRef)
    setPlaced(preview)
    window.setTimeout(() => focusCarField('car-preview-title'), 50)
  }

  const handleEdit = () => {
    setPlaced(null)
    window.setTimeout(() => focusCarField('car-vehicle'), 50)
  }

  const handleDiscard = () => {
    clearCarPreview()
    setPlaced(null)
    setStoredBanner(null)
    setActiveRef(null)
  }

  const renderPreview = (preview: CarRequestPreview) => {
    const d = preview.draft
    const previewCar = liveCars.find((car) => car.slug === d.vehicleSlug)
    const dateRows = d.tripType === 'Round Trip' && d.preferredReturnDate !== ''
      ? [{ label: ar ? 'تاريخ العودة المفضل' : 'Preferred return date', value: d.preferredReturnDate, ltr: true }]
      : []
    return <div className="form-success large">
      <Check size={42} />
      <h1 id="car-preview-title" tabIndex={-1}>{ar ? 'تم إنشاء معاينة لطلب السيارة' : 'Car request preview created'}</h1>
      <span className="req-ref" dir="ltr">{ar ? 'المرجع المحلي: ' : 'Local ref: '}{preview.localRef}</span>
      <div className="req-summary-rows" style={{ maxWidth: 520, margin: '18px auto', textAlign: 'start' }}>
        <div><span>{ar ? 'السيارة المطلوبة' : 'Requested vehicle'}</span><strong>{previewCar?.title ?? d.vehicleSlug}</strong></div>
        <div><span>{ar ? 'النوع' : 'Trip type'}</span><strong>{d.tripType === 'One Way' ? (ar ? 'ذهاب فقط' : 'One Way') : d.tripType === 'Round Trip' ? (ar ? 'ذهاب وعودة' : 'Round Trip') : notSet}</strong></div>
        <div><span>{ar ? 'من' : 'From'}</span><strong>{d.pickup}</strong></div>
        <div><span>{ar ? 'إلى' : 'To'}</span><strong>{d.dropoff}</strong></div>
        <div><span>{ar ? 'تاريخ الاستلام المفضل' : 'Preferred pick-up date'}</span><strong dir="ltr">{d.preferredPickupDate}</strong></div>
        {dateRows.map((row) => <div key={row.label}><span>{row.label}</span><strong dir="ltr">{row.value}</strong></div>)}
        <div><span>{ar ? 'الركاب' : 'Passengers'}</span><strong>{d.passengers}</strong></div>
        <div><span>{ar ? 'الاسم الكامل' : 'Full name'}</span><strong>{d.contact.fullName}</strong></div>
        <div><span>{ar ? 'البريد الإلكتروني' : 'Email'}</span><strong dir="ltr">{d.contact.email}</strong></div>
        <div><span>{ar ? 'رقم الهاتف' : 'Phone'}</span><strong dir="ltr">{d.contact.phone}</strong></div>
        {d.notes !== '' && <div><span>{ar ? 'ملاحظات' : 'Notes'}</span><strong style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</strong></div>}
      </div>
      <p><CircleAlert size={15} style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />{ar ? 'محفوظ في هذا المتصفح فقط. لم يتم إرسال هذا الطلب إلى STAR PYRAMIDS.' : 'Saved in this browser only. This request has not been submitted to STAR PYRAMIDS.'}</p>
      <p>{ar ? 'لم يتم حجز أي سيارة ولم يتم التحقق من التوافر أو تأكيد أي سعر.' : 'No vehicle has been reserved, no availability was checked, and no rate was confirmed.'}</p>
      <div className="car-success-actions">
        <button type="button" className="outline-btn" onClick={handleEdit}>{ar ? 'تعديل الطلب' : 'Edit request'}</button>
        <Link className="primary-btn" href="/rent-car">{ar ? 'استعرض السيارات' : 'Explore cars'}</Link>
        <Link className="outline-btn" href="/contact">{ar ? 'تواصل مع فريقنا' : 'Contact our team'}</Link>
      </div>
      <p><button type="button" className="text-link" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }} onClick={handleDiscard}>{ar ? 'تجاهل المعاينة المحلية' : 'Discard local preview'}</button></p>
    </div>
  }

  return <>
    <Breadcrumb items={ar ? ['تأجير السيارات', 'طلب سيارة'] : ['Rent Car', 'Request a vehicle']} />
    <main className="container car-request-page">
      <header className="car-request-head">
        <span className="eyebrow">{ar ? 'نقل خاص' : 'Private transport'}</span>
        <h1>{ar ? 'أخبرنا كيف تريد التنقل.' : 'Tell us how you want to move.'}</h1>
        <p>{ar ? 'املأ تفاصيل طلبك وسنجهز لك معاينة محلية يمكنك مراجعتها قبل التواصل معنا.' : 'Fill in your request details and we will prepare a local preview you can review before contacting us.'}</p>
      </header>
      <ol className="stepper req-stepper" aria-label={ar ? 'مراحل طلب السيارة' : 'Vehicle request progress'}>
        {steps.map((label, i) => {
          const state = step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'todo'
          const isDone = step > i + 1
          return <li key={label}>
            {i > 0 && <span className={`step-line${step > i ? ' done' : ''}`} aria-hidden="true" />}
            <span className={`step-pill ${state}`} aria-current={step === i + 1 ? 'step' : undefined}>
              <b className="step-num">{isDone ? <Check size={18} /> : i + 1}</b>
              {label}
            </span>
          </li>
        })}
      </ol>
      {storedBanner !== null && placed === null && <div className="car-form-card" role="note" style={{ padding: 18, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}><p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>{ar ? 'لديك معاينة محلية محفوظة في هذا المتصفح.' : 'You have a saved local preview in this browser.'} <span dir="ltr">({storedBanner.localRef})</span></p><div style={{ display: 'flex', gap: 10 }}><button type="button" className="outline-btn" onClick={() => { setActiveRef(storedBanner.localRef); setPlaced(storedBanner) }}>{ar ? 'عرض المعاينة' : 'View preview'}</button><button type="button" className="text-link" style={{ border: 0, background: 'none', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { clearCarPreview(); setStoredBanner(null); setActiveRef(null) }}>{ar ? 'تجاهل' : 'Discard'}</button></div></div>}
      {placed
        ? renderPreview(placed)
        : <div className="car-request-layout">
          <aside className="car-summary-card" aria-label={ar ? 'ملخص الطلب' : 'Request summary'}>
            <div>
              <span className="eyebrow">{ar ? 'ملخص طلبك' : 'Your summary'}</span>
              {vehicle
                ? <div className="req-vehicle-mini"><img src={vehicle.image} alt={vehicle.title} /><div><strong>{vehicle.title}</strong><span>{formatPrice(vehicle.dailyPrice, currency, locale)}{ar ? ' / يوم' : ' / day'}</span></div></div>
                : <p className="req-novehicle">{ar ? 'اختر السيارة من النموذج ليظهر ملخصك هنا.' : 'Select a vehicle in the form to see your summary here.'}</p>}
              <div className="req-summary-rows">
                <div><span>{ar ? 'النوع' : 'Trip type'}</span><strong>{tripLabel}</strong></div>
                <div><span>{ar ? 'من' : 'From'}</span><strong>{values.pickup || notSet}</strong></div>
                <div><span>{ar ? 'إلى' : 'To'}</span><strong>{values.dropoff || notSet}</strong></div>
                <div><span>{ar ? 'تاريخ الاستلام المفضل' : 'Preferred pick-up date'}</span><strong dir="ltr">{values.pickupDate || notSet}</strong></div>
                {values.tripType === 'Round Trip' && <div><span>{ar ? 'تاريخ العودة المفضل' : 'Preferred return date'}</span><strong dir="ltr">{values.returnDate || notSet}</strong></div>}
                <div><span>{ar ? 'الركاب' : 'Passengers'}</span><strong>{values.passengers || notSet}</strong></div>
              </div>
              <p><ShieldCheck size={15} />{ar ? 'شامل سائق خاص وتكييف' : 'Private driver and A/C included'}</p>
              <a className="req-wa" href={whatsappHref(brand.whatsapp)} target="_blank" rel="noreferrer">{ar ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}</a>
            </div>
          </aside>
          <div className="car-form-card"><CarRequestForm values={values} errors={errors} summary={summary} onChange={patch} onSubmit={handleSubmit} /></div>
        </div>}
    </main>
  </>
}

export function DestinationsPage() { const { locale } = useLocale(); const ar = locale === 'ar'; const liveDestinations = useLiveDestinations(destinations).filter((d) => d.showInDestinations !== false && d.isPublished !== false); return <SiteShell><EditorialHero eyebrow={ar ? 'الصورة الكاملة' : 'See the full picture'} title={ar ? 'كل وجهة تحكي قصة مختلفة عن مصر' : 'Every destination tells a different Egypt story'} copy={ar ? 'ابنِ رحلتك حول الأماكن التي تثير فضولك، من العواصم القديمة للصحارى البيضاء والشواطئ المرجانية.' : 'Build a trip around the places that make you curious, from ancient capitals to salt-white deserts and coral-blue seas.'} image={siteImages.desert} href="/make-your-trip" action={ar ? 'ابنِ خط سيرك' : 'Build my route'}/><main className="section container"><div className="destination-large-grid">{liveDestinations.map(item=><article className="destination-large" key={item.slug}><img src={item.image} alt={item.title}/><div><span className="eyebrow">{ar ? 'اكتشف مصر' : 'Discover Egypt'}</span><h2>{item.title}</h2><p>{item.copy}</p><Link href={`/destinations/${item.slug}`} className="text-link">{ar ? 'استكشف الوجهة' : 'Explore destination'} <ArrowRight size={15}/></Link></div></article>)}</div></main></SiteShell> }

const destinationFactIcons = [Clock3, Sun, Compass, MapPin]

export function DestinationDetailPage({ slug }: { slug: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveItem = useLiveFind('destinations', destinations, slug)
  const item = liveItem && liveItem.isPublished !== false ? liveItem : undefined
  if (!item) return <DetailNotFound title={ar ? 'الوجهة غير موجودة' : 'Destination not found'} copy={ar ? 'الوجهة التي تبحث عنها سلكت طريقًا آخر.' : 'The destination you were looking for has taken a different route.'} backHref="/destinations" backLabel={ar ? 'استكشف الوجهات' : 'Explore destinations'}/>
  const detail = item.detail
  const relatedTours = detail.tourSlugs.map(findTour).filter((tour): tour is Tour => Boolean(tour))

  return <SiteShell>
    <main className="destination-detail-page">
      <section className="destination-detail-hero">
        <img src={detail.heroImage} alt={detail.heroAlt}/>
        <div className="destination-detail-shade"/>
        <div className="container destination-detail-hero-content">
          <nav aria-label={ar ? 'مسار التنقل' : 'Breadcrumb'}><Link href="/destinations">{ar ? 'الوجهات' : 'Destinations'}</Link><span>/</span><span aria-current="page">{item.title}</span></nav>
          <span className="eyebrow">{detail.eyebrow}</span>
          <h1>{item.title}</h1>
          <p>{item.copy}</p>
          <div className="destination-hero-actions">
            <Link href="/make-your-trip" className="primary-btn">{ar ? 'خطط لهذه الوجهة' : 'Plan this destination'} <ArrowRight size={17}/></Link>
            <a href="#destination-experiences" className="destination-ghost-btn">{ar ? 'اكتشف ما ينتظرك' : 'See what awaits'}</a>
          </div>
        </div>
      </section>

      <section className="destination-facts" aria-label={ar ? `${item.title} باختصار` : `${item.title} at a glance`}>
        <div className="container">
          {detail.facts.map((fact, index) => {
            const Icon = destinationFactIcons[index] || Compass
            return <div key={fact.label}><Icon size={21}/><span><small>{fact.label}</small><strong>{fact.value}</strong></span></div>
          })}
        </div>
      </section>

      <section className="destination-story container">
        <div>
          <span className="eyebrow">{ar ? 'حكاية الوجهة' : 'The destination story'}</span>
          <h2>{ar ? 'تعالَ للأيقونات. وابقَ للإيقاع.' : 'Come for the icons. Stay for the rhythm.'}</h2>
          <p>{detail.intro}</p>
          <p>{ar ? 'نصمم كل يوم حول القرب والإضاءة والطاقة واللحظات التي تستحق أكثر من وقفة سريعة.' : 'We shape each day around proximity, light, energy, and the moments that deserve more than a quick stop.'}</p>
        </div>
        <aside>
          <span className="eyebrow">{ar ? 'مناسبة بشكل خاص لـ' : 'Especially good for'}</span>
          <div>{detail.bestFor.map((item) => <span key={item}><Check size={15}/>{item}</span>)}</div>
        </aside>
      </section>

      <section id="destination-experiences" className="destination-experiences">
        <div className="container">
          <header className="destination-section-head"><div><span className="eyebrow">{ar ? 'تجارب مميزة' : 'Signature experiences'}</span><h2>{ar ? 'اللحظات التي تميز' : 'The moments that define'} {item.title}.</h2></div><p>{ar ? 'ليست قائمة مهام، بل مزيج مدروس من المعالم والروح المحلية ومساحة كافية لتشعر بالمكان فعلًا.' : 'Not a checklist. A considered mix of landmarks, local texture, and enough space to actually feel the place.'}</p></header>
          <div className="destination-experience-grid">
            {detail.experiences.map((experience, index) => <article key={experience.title} className={index === 0 ? 'featured' : ''}>
              <img src={experience.image} alt={experience.alt} loading="lazy"/>
              <div><span>0{index + 1}</span><h3>{experience.title}</h3><p>{experience.copy}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="destination-rhythm container">
<div className="destination-rhythm-image"><img src={detail.heroImage} alt={ar ? `منظر لا يُنسى من ${item.title}` : `A memorable view of ${item.title}`} loading="lazy"/><span>{ar ? 'إيقاع مقترح' : 'Suggested rhythm'}</span></div>
        <div className="destination-rhythm-copy">
          <span className="eyebrow">{ar ? 'خط سير يتنفس' : 'A route that breathes'}</span>
          <h2>{ar ? 'كيف تعيش' : 'How to experience'} {item.title} {ar ? 'دون استعجال.' : 'without rushing it.'}</h2>
          <div className="destination-timeline">{detail.rhythm.map((step, index) => <article key={step.title}><b>0{index + 1}</b><div><small>{step.label}</small><h3>{step.title}</h3><p>{step.copy}</p></div></article>)}</div>
        </div>
      </section>

      <section className="destination-practical">
        <div className="container">
          <header><span className="eyebrow">{ar ? 'سافر بذكاء' : 'Travel well'}</span><h2>{ar ? 'خيارات صغيرة وأيام أجمل.' : 'Small choices. Better days.'}</h2></header>
          <div>{detail.practical.map((tip, index) => <article key={tip.title}><span>0{index + 1}</span><h3>{tip.title}</h3><p>{tip.copy}</p></article>)}</div>
        </div>
      </section>

      {relatedTours.length > 0 && <section className="destination-related container">
        <header className="destination-section-head"><div><span className="eyebrow">{ar ? 'سافر معنا' : 'Travel with us'}</span><h2>{ar ? 'طرق لتعيش بها' : 'Ways to experience'} {item.title}.</h2></div><Link href="/egypt-tours/one-day-tours" className="text-link">{ar ? 'شاهد كل الرحلات' : 'View all tours'} <ArrowRight size={15}/></Link></header>
        <div className={`destination-tour-grid${relatedTours.length === 1 ? ' single' : ''}`}>{relatedTours.map((tour) => <TourCard key={tour.slug} tour={tour}/>)}</div>
      </section>}

      <section className="destination-plan-cta">
        <img src={item.image} alt="" loading="lazy"/>
        <div/>
        <div className="container"><span className="eyebrow">{ar ? 'مصر بتنظيم مدروس' : 'Your Egypt, thoughtfully arranged'}</span><h2>{ar ? 'اجعل' : 'Make'} {item.title} {ar ? 'جزءًا من رحلة مبنية حولك.' : 'part of a journey built around you.'}</h2><p>{ar ? 'شاركنا مواعيدك وإيقاعك واهتماماتك، وسيربط فريقنا المحلي التفاصيل في برنامج واحد سلس.' : 'Share your dates, pace, and interests. Our local team will connect the details into one smooth itinerary.'}</p><Link href="/make-your-trip" className="primary-btn">{ar ? 'ابنِ رحلتي' : 'Build my trip'} <ArrowRight size={17}/></Link></div>
      </section>
    </main>
  </SiteShell>
}

export function BlogsPage() { return <SiteShell><BlogsPageContent /></SiteShell> }

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
        {ar ? 'اقرأ الدليل' : 'Read the story'} <ArrowRight size={16}/>
      </Link>
    </div>
  </article>
}

function BlogsPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveBlogs = useLiveCollection('blogs', blogs)
  const featured = liveBlogs[0]
  const categories = new Set(liveBlogs.map((blog) => blog.category)).size
  if (!featured) return null
  return <main>
    <PageShowcaseHero image={featured.image} eyebrow={ar ? 'حكايات وإلهام' : 'Stories & inspiration'} title={ar ? 'ملاحظات سفر لعشاق مصر الفضوليين' : 'Travel notes for curious Egypt explorers'} intro={ar ? 'أدلة عملية ووجهة نظر محلية وتفاصيل صغيرة تساعدك تسافر بثقة أكبر.' : 'Practical guides, local perspective, and the small details that help you travel with more confidence.'} primaryLabel={ar ? 'استكشف القصص' : 'Explore the stories'} primaryHref="#blog-stories" secondaryLabel={ar ? 'اقرأ القصة المميزة' : 'Read the featured story'} secondaryHref={`/blogs/${featured.slug}`} railLabel={ar ? 'قصة مميزة' : 'Featured story'} railTitle={featured.title} railHref={`/blogs/${featured.slug}`} railMeta={[{ Icon: CalendarDays, label: featured.date }, { Icon: Compass, label: featured.category }]} statsLabel={ar ? 'ملخص المدونة' : 'Journal summary'} stats={[{ value: liveBlogs.length, label: ar ? 'قصص وأدلة' : 'Stories & guides' }, { value: categories, label: ar ? 'تصنيفات' : 'Story categories' }]}/>
    <section id="blog-stories" className="blogs-editorial section container">
      <article className="blog-feature-story">
        <Link href={`/blogs/${featured.slug}`} className="blog-feature-media" aria-label={featured.title}>
          <img src={featured.editorial?.heroImage ?? featured.image} alt={featured.editorial?.heroAlt ?? featured.title}/>
          <span>{ar ? 'اختيار المجلة' : 'Editor\'s pick'}</span>
        </Link>
        <div className="blog-feature-copy">
          <span className="eyebrow">{ar ? 'قصة مميزة' : 'Featured story'}</span>
          <div className="blog-mag-meta">
            <span><Compass size={14}/>{featured.category}</span>
            <span><CalendarDays size={14}/>{featured.date}</span>
            {featured.editorial?.readTime && <span><Clock3 size={14}/>{featured.editorial.readTime}</span>}
          </div>
          <h2>{featured.title}</h2>
          <p>{featured.excerpt}</p>
          <Link href={`/blogs/${featured.slug}`} className="blog-feature-link">
            {ar ? 'اقرأ القصة كاملة' : 'Read the full story'} <ArrowRight size={17}/>
          </Link>
        </div>
      </article>

      <header className="blog-index-head">
        <div>
          <span className="eyebrow">{ar ? 'من مجلة السفر' : 'From the travel journal'}</span>
          <h2>{ar ? 'أفكار جديدة لرحلتك القادمة في مصر.' : 'Fresh perspectives for your next Egypt journey.'}</h2>
        </div>
        <p>{ar ? `${Math.max(liveBlogs.length - 1, 0)} أدلة وقصص حديثة` : `${Math.max(liveBlogs.length - 1, 0)} recent guides and stories`}</p>
      </header>

      <div className="blog-magazine-grid">
        {liveBlogs.slice(1).map((item) => <BlogMagazineCard item={item} key={item.slug}/>) }
      </div>
    </section>
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
  const { currency, locale } = useLocale()
  const adAr = locale === 'ar'
  const related = useLiveCollection('blogs', blogs).filter((blog) => blog.slug !== item.slug).slice(0, 3)
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
    <div className="guide-breadcrumb"><div className="container"><Link href="/">{adAr ? 'الرئيسية' : 'Home'}</Link><span>›</span><Link href="/blogs">{adAr ? 'المدونة' : 'Blogs'}</Link><span>›</span><strong>{item.title}</strong></div></div>
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
          {editorial.sidebarLinks && editorial.sidebarLinks.length > 0 && <nav aria-label="In this guide"><strong>{adAr ? 'في هذا الدليل' : 'In this guide'}</strong>{editorial.sidebarLinks.map((link) => <a key={link.href} href={link.href} className={activeSection === link.href.replace('#', '') ? 'active' : ''}>{link.label}</a>)}</nav>}
          {editorial.sidebarAction && <div className="guide-side-action"><span>{editorial.sidebarAction.label}</span><strong>{editorial.sidebarAction.heading}</strong><Link href={`/egypt-tours/${editorial.sidebarAction.tourSlug}`}>{adAr ? 'استعرض الرحلة' : 'View the tour'} <ArrowRight size={15}/></Link></div>}
          <Link href="/make-your-trip" className="guide-ad-card">
            <img src="https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=800&q=80" alt={adAr ? 'رحلة أهرامات فاخرة خاصة' : 'Private Luxury Pyramids Tour'} className="guide-ad-card-img" loading="lazy" />
            <div className="guide-ad-card-overlay" />
            <div className="guide-ad-card-content">
              <span className="guide-ad-badge"><Star size={12} fill="currentColor" /> {adAr ? 'عرض VIP مميز' : 'Special VIP Offer'}</span>
              <h4>{adAr ? 'رحلة مصر مصممة لك' : 'Tailor-Made Egypt Journey'}</h4>
              <p>{adAr ? 'تخطى طوابير السياح مع مرشد خاص معتمد وسيارة فاخرة.' : 'Skip the tourist lines with a licensed private Egyptologist & luxury vehicle.'}</p>
              <div className="guide-ad-price">
                <small>{adAr ? 'سعر مميز يبدأ من' : 'Special rate from'}</small>
                <strong>{formatPrice(65, currency, locale)}</strong>
              </div>
              <div className="guide-ad-btn">
                {adAr ? 'خطط لرحلة VIP' : 'Plan My VIP Trip'} <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        </aside>

        <article className="guide-story">
          {editorial.sections?.map((section) => <GuideSection key={section.id} section={section} tips={editorial.tips} />)}

          {editorial.quote && <blockquote className="guide-quote"><span aria-hidden="true">{'\u201C'}</span><p>{editorial.quote}</p></blockquote>}

          {editorial.checklist && editorial.checklist.length > 0 && <section className="guide-checklist">
            <div><span className="guide-section-number">{String((editorial.sections?.length || 0) + 1).padStart(2, '0')}</span><span className="eyebrow">{adAr ? 'قبل السفر' : 'Before you go'}</span><h2>{adAr ? 'رحلتك ببساطة' : 'Your trip, simplified'}</h2></div>
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

      <section className="container guide-related"><div className="guide-related-head"><div><span className="eyebrow">{adAr ? 'واصل الاستكشاف' : 'Keep exploring'}</span><h2>{adAr ? 'قصص أخرى من مصر' : 'More stories from Egypt'}</h2></div><Link href="/blogs">{adAr ? 'كل قصص السفر' : 'All travel stories'} <ArrowRight size={16}/></Link></div><div className="guide-related-grid">{related.map((blog) => <article key={blog.slug}><Link href={`/blogs/${blog.slug}`}><img src={blog.image} alt={blog.title} loading="lazy"/></Link><small>{blog.category}</small><h3><Link href={`/blogs/${blog.slug}`}>{blog.title}</Link></h3><p>{blog.excerpt}</p></article>)}</div></section>
    </main>
  </SiteShell>
}

export function BlogDetailPage({ slug }: { slug: string }) {
  const item = useLiveFind('blogs', blogs, slug)
  const { locale } = useLocale()
  const ar = locale === 'ar'
  if (!item) return <DetailNotFound title={ar ? 'القصة غير موجودة' : 'Story not found'} copy={ar ? 'القصة التي تبحث عنها سلكت طريقًا آخر.' : 'The story you were looking for has taken a different route.'} backHref="/blogs" backLabel={ar ? 'اقرأ كل القصص' : 'Read all stories'}/>
  if (item.editorial) return <BlogEditorialPage item={item}/>
  return <SiteShell><Breadcrumb items={[ar ? 'المدونة' : 'Blogs',item.title]}/><main className="article-page container"><div className="article-header"><span className="eyebrow">{item.category}, {item.date}</span><h1>{item.title}</h1><p>{item.excerpt}</p></div><img className="article-cover" src={item.image} alt={item.title}/><div className="article-body"><p>Egypt rewards travelers who look a little closer. The great landmarks are only the beginning; the real rhythm of a journey appears in the streets, the meals, the conversations, and the quiet spaces between one stop and the next.</p><h2>Make room for the unexpected</h2><p>Leave space in your itinerary for a second cup of tea, a local market, and the kind of discovery that never appears in a checklist. Our team can help you find that balance.</p><blockquote>Travel slowly enough to notice what makes a place itself.</blockquote><Link href="/make-your-trip" className="primary-btn">{ar ? 'استلهم لرحلتك' : 'Use this inspiration'} <ArrowRight size={16}/></Link></div></main></SiteShell>
}

/** Legacy aliases now backed by the structured helpers in `@/lib/events`. */
function parseEventRange(date: string): { start: Date | null; end: Date | null } {
  return parseLegacyEventRange(date)
}

function eventStatus(end: Date | null, ar: boolean, timestamp = Date.now()): string | null {
  if (!end) return null
  const today = new Date(timestamp)
  today.setHours(0, 0, 0, 0)
  return end >= today ? (ar ? 'قادم' : 'Upcoming') : (ar ? 'انتهى' : 'Past')
}

const EVENT_IMAGE_FALLBACK = '/placeholder.jpg'

function eventImageSrc(image: string | undefined): string {
  return image && image.trim() ? image : EVENT_IMAGE_FALLBACK
}

function onEventImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget
  if (!el.src.endsWith('/placeholder.jpg')) el.src = '/placeholder.jpg'
}

export function EventCard({ item }: { item: Event }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const range = resolveEventRange(item)
  const badge = range.start ? { day: String(range.start.getDate()).padStart(2, '0'), mon: range.start.toLocaleString(ar ? 'ar-EG' : 'en-US', { month: 'short' }) } : null
  const status = getEventStatus(item)
  const statusLabel = eventStatusLabel(status, ar)
  const title = ar && item.titleAr ? item.titleAr : item.title
  const copy = ar && item.copyAr ? item.copyAr : item.copy
  const venue = ar && item.locationAr ? item.locationAr : eventCity(item)
  const category = ar && item.categoryAr ? item.categoryAr : item.category
  return <article className="event-card">
    <Link href={`/events/${item.slug}`} className="event-card-img" aria-label={title}>
      <img src={eventImageSrc(item.image)} alt={title} loading="lazy" onError={onEventImageError} />
      {badge && <span className="event-date-badge"><b>{badge.day}</b><small>{badge.mon}</small></span>}
      {statusLabel && <span className={`event-card-status is-${status}`}>{statusLabel}</span>}
    </Link>
    <div className="event-card-body">
      <p className="event-card-date"><CalendarDays size={14} />{item.date}</p>
      {category && <p className="event-card-category">{category}</p>}
      <h3><Link href={`/events/${item.slug}`}>{title}</Link></h3>
      <p className="event-card-venue"><MapPin size={14} />{venue}</p>
      <p>{copy}</p>
      <p className="event-card-price">{eventPriceLabel(item, ar)}</p>
      <Link href={`/events/${item.slug}`} className="event-card-cta">{ar ? 'التفاصيل وطلب الحضور' : 'Details & request'} <ArrowRight size={15} /></Link>
    </div>
  </article>
}

export function EventsPage() {
  return <SiteShell><EventsPageContent /></SiteShell>
}

const EVENTS_PAGE_SIZE = 6

function EventsPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveEvents = useLiveEvents(events)
  const published = useMemo(() => getPublishedEvents(liveEvents), [liveEvents])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [city, setCity] = useState('all')
  const [state, setState] = useState<'all' | 'upcoming' | 'past'>('all')
  const [sort, setSort] = useState<'soonest' | 'latest' | 'name'>('soonest')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => [...new Set(published.map((e) => (ar && e.categoryAr ? e.categoryAr : e.category)).filter(Boolean))] as string[], [published, ar])
  const cities = useMemo(() => [...new Set(published.map((e) => eventCity({ city: ar ? e.cityAr ?? e.city : e.city, location: ar ? e.locationAr ?? e.location : e.location })))].filter(Boolean), [published, ar])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    const rows = published.filter((item) => {
      const title = ar && item.titleAr ? item.titleAr : item.title
      const copy = ar && item.copyAr ? item.copyAr : item.copy
      if (q && !`${title} ${copy} ${item.location} ${item.city ?? ''} ${item.category ?? ''}`.toLowerCase().includes(q)) return false
      const itemCategory = ar && item.categoryAr ? item.categoryAr : item.category
      if (category !== 'all' && itemCategory !== category) return false
      const itemCity = eventCity({ city: ar ? item.cityAr ?? item.city : item.city, location: ar ? item.locationAr ?? item.location : item.location })
      if (city !== 'all' && itemCity !== city) return false
      const st = getEventStatus(item, now)
      if (state === 'upcoming' && !(st === 'upcoming' || st === 'ongoing')) return false
      if (state === 'past' && st !== 'past') return false
      return true
    })
    const withTime = rows.map((item) => ({ item, t: resolveEventRange(item).start?.getTime() ?? Number.MAX_SAFE_INTEGER }))
    if (sort === 'name') withTime.sort((a, b) => (ar && a.item.titleAr ? a.item.titleAr : a.item.title).localeCompare(ar && b.item.titleAr ? b.item.titleAr : b.item.title, ar ? 'ar' : 'en'))
    else if (sort === 'latest') withTime.sort((a, b) => b.t - a.t)
    else withTime.sort((a, b) => a.t - b.t)
    return withTime.map((r) => r.item)
  }, [published, query, category, city, state, sort, ar])

  const now = Date.now()
  const upcomingCount = published.filter((e) => { const s = getEventStatus(e, now); return s === 'upcoming' || s === 'ongoing' }).length
  const cityCount = new Set(published.map((e) => eventCity(e))).size
  const sortedAll = useMemo(() => [...published].map((item) => ({ item, t: resolveEventRange(item).start?.getTime() ?? Number.MAX_SAFE_INTEGER })).sort((a, b) => a.t - b.t), [published])
  const featured = sortedAll.find(({ item }) => { const s = getEventStatus(item, now); return s === 'upcoming' || s === 'ongoing' })?.item ?? sortedAll[0]?.item

  useEffect(() => { setPage(1) }, [query, category, city, state, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / EVENTS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageRows = filtered.slice((safePage - 1) * EVENTS_PAGE_SIZE, safePage * EVENTS_PAGE_SIZE)

  return <main>
    <section className="events-page-hero">
      <img src={featured ? eventImageSrc(featured.image) : EVENT_IMAGE_FALLBACK} alt="" onError={onEventImageError} />
      <div className="events-page-hero-shade" />
      <div className="container events-page-hero-content">
        <div className="events-page-hero-copy">
          <span className="eyebrow">{ar ? 'أجندة فعاليات مصر' : 'Egypt events calendar'}</span>
          <h1>{ar ? 'فعاليات ورحلات موسمية تستحق السفر' : 'Egypt events & seasonal journeys'}</h1>
          <p>{ar ? 'احتفالات وعطلات ثقافية وتجارب محدودة التوقيت، مرتبة لتعيش مصر في أكثر لحظاتها حيوية.' : 'Celebrations, cultural escapes, and limited-time experiences shaped around Egypt at its most alive.'}</p>
          <div className="events-page-hero-actions">
            <a href="#events-list" className="primary-btn">{ar ? 'استكشف الفعاليات' : 'Explore upcoming events'} <ArrowRight size={17} /></a>
            {featured && <Link href={`/events/${featured.slug}`} className="events-hero-link">{ar ? 'تفاصيل الفعالية القادمة' : 'View the next event'} <ArrowRight size={16} /></Link>}
          </div>
        </div>
        <div className="events-hero-rail">
          {featured ? <Link href={`/events/${featured.slug}`} className="events-next-event">
            <span>{ar ? 'الفعالية القادمة' : 'Next event'}</span>
            <strong>{ar && featured.titleAr ? featured.titleAr : featured.title}</strong>
            <small><CalendarDays size={14} />{featured.date}<i aria-hidden="true"/><MapPin size={14} />{ar && featured.locationAr ? featured.locationAr : featured.location}</small>
          </Link> : <p className="events-next-empty">{ar ? 'لا توجد فعاليات منشورة حاليًا.' : 'No published events right now.'}</p>}
          <div className="events-hero-stats" aria-label={ar ? 'ملخص الفعاليات' : 'Events summary'}>
            <span><b>{upcomingCount}</b>{ar ? 'فعاليات قادمة' : 'Upcoming events'}</span>
            <span><b>{cityCount}</b>{ar ? 'مدن مصرية' : 'Egyptian cities'}</span>
          </div>
        </div>
      </div>
    </section>
    <div id="events-list" className="section container">
      {published.length === 0 ? (
        <div className="account-empty events-empty" role="status">
          <h3>{ar ? 'لا توجد فعاليات منشورة حاليًا' : 'No published events right now'}</h3>
          <p>{ar ? 'تابعنا قريبًا لاكتشاف أجندة الفعاليات القادمة في مصر.' : 'Check back soon for upcoming events across Egypt.'}</p>
          <Link href="/make-your-trip" className="primary-btn">{ar ? 'خطط رحلتك' : 'Make your trip'} <ArrowRight size={17} /></Link>
        </div>
      ) : (
        <>
          <div className="events-discovery" role="search" aria-label={ar ? 'البحث في الفعاليات' : 'Search events'}>
            <label className="events-discovery-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value.slice(0, 120))} placeholder={ar ? 'ابحث عن فعالية أو مدينة...' : 'Search events or cities...'} aria-label={ar ? 'بحث' : 'Search'} /></label>
            <div className="events-discovery-filters">
              <label>{ar ? 'التصنيف' : 'Category'}<select value={category} onChange={(e) => setCategory(e.target.value)}>{[<option key="all" value="all">{ar ? 'كل التصنيفات' : 'All categories'}</option>, ...categories.map((c) => <option key={c} value={c}>{c}</option>)]}</select></label>
              <label>{ar ? 'المدينة' : 'City'}<select value={city} onChange={(e) => setCity(e.target.value)}>{[<option key="all" value="all">{ar ? 'كل المدن' : 'All cities'}</option>, ...cities.map((c) => <option key={c} value={c}>{c}</option>)]}</select></label>
              <label>{ar ? 'الحالة' : 'Status'}<select value={state} onChange={(e) => setState(e.target.value as typeof state)}><option value="all">{ar ? 'الكل' : 'All'}</option><option value="upcoming">{ar ? 'القادمة' : 'Upcoming'}</option><option value="past">{ar ? 'السابقة' : 'Past'}</option></select></label>
              <label>{ar ? 'الترتيب' : 'Sort'}<select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="soonest">{ar ? 'الأقرب' : 'Soonest'}</option><option value="latest">{ar ? 'الأبعد' : 'Latest'}</option><option value="name">{ar ? 'الاسم' : 'Name'}</option></select></label>
            </div>
          </div>
          <p className="events-results-count" role="status">{ar ? `${filtered.length} فعالية` : `${filtered.length} event${filtered.length === 1 ? '' : 's'}`}</p>
          {pageRows.length ? <div className="event-grid">{pageRows.map((item) => <EventCard item={item} key={item.slug} />)}</div> : (
            <div className="account-empty events-empty" role="status">
              <h3>{ar ? 'لا توجد نتائج مطابقة' : 'No matching events'}</h3>
              <p>{ar ? 'جرب تغيير البحث أو الفلاتر.' : 'Try changing the search or filters.'}</p>
              <button type="button" className="primary-btn" onClick={() => { setQuery(''); setCategory('all'); setCity('all'); setState('all') }}>{ar ? 'إعادة التعيين' : 'Reset filters'}</button>
            </div>
          )}
          {pageCount > 1 && <nav className="pagination" aria-label={ar ? 'صفحات الفعاليات' : 'Events pages'}>{Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => <button key={n} type="button" disabled={n === safePage} onClick={() => setPage(n)} aria-current={n === safePage ? 'page' : undefined}>{n}</button>)}</nav>}
        </>
      )}
    </div>
  </main>
}

export function EventDetailPage({ slug }: { slug: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveEvents = useLiveEvents(events, { includeHidden: true })
  const item = liveEvents.find((e) => e.slug === slug)
  const [now, setNow] = useState<number | null>(null)
  const [shared, setShared] = useState(false)
  const range = resolveEventRange({ startDate: item?.startDate, endDate: item?.endDate, date: item?.date ?? '' })
  const rangeKey = range.start?.getTime() ?? 0
  useEffect(() => {
    if (!rangeKey) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [rangeKey])
  if (!item) return <DetailNotFound title={ar ? 'الفعالية غير موجودة' : 'Event not found'} copy={ar ? 'الفعالية التي تبحث عنها سلكت طريقًا آخر.' : 'The event you were looking for has taken a different route.'} backHref="/events" backLabel={ar ? 'شاهد كل الفعاليات' : 'See all events'}/>
  if (item.isPublished === false) return <SiteShell><main className="container section"><div className="account-empty" role="status"><h1>{ar ? 'هذه الفعالية مخفية حاليًا' : 'This event is currently hidden'}</h1><p>{ar ? 'تصفح الفعاليات المنشورة الأخرى.' : 'Browse the other published events.'}</p><Link href="/events" className="primary-btn">{ar ? 'شاهد كل الفعاليات' : 'See all events'}</Link></div></main></SiteShell>
  const title = ar && item.titleAr ? item.titleAr : item.title
  const copy = ar && item.copyAr ? item.copyAr : item.copy
  const intro = ar && item.introAr ? item.introAr : item.intro ?? copy
  const venue = ar && item.locationAr ? item.locationAr : item.location
  const category = ar && item.categoryAr ? item.categoryAr : item.category
  const included = ar && item.includedAr?.length ? item.includedAr : item.included
  const excluded = ar && item.excludedAr?.length ? item.excludedAr : item.excluded
  const status = getEventStatus(item, now ?? Date.now())
  const statusLabel = now === null ? null : eventStatusLabel(status, ar)
  const msLeft = range.start && now !== null ? Math.max(0, range.start.getTime() - now) : 0
  const cd = [Math.floor(msLeft / 86400000), Math.floor(msLeft / 3600000) % 24, Math.floor(msLeft / 60000) % 60, Math.floor(msLeft / 1000) % 60]
  const cdLabels = ar ? ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'] : ['Days', 'Hours', 'Mins', 'Secs']
  const related = getRelatedEvents(item, getPublishedEvents(liveEvents), 2)
  const hasProgram = Boolean(item.program?.length)
  const mapQ = eventMapQuery(item)
  const timeLine = [item.startTime, item.endTime].filter(Boolean).join(' - ')
  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `/events/${item.slug}`
    try {
      if (navigator.share) { await navigator.share({ title, url }) ; return }
      await navigator.clipboard.writeText(url)
    } catch { try { await navigator.clipboard.writeText(url) } catch { /* clipboard unavailable */ } }
    setShared(true)
    window.setTimeout(() => setShared(false), 2000)
  }
  return <SiteShell><main className="event-detail-page">
    <Breadcrumb items={[ar ? 'الفعاليات' : 'Events', title]} />
    <section className="event-detail-hero container">
      <img src={eventImageSrc(item.image)} alt={title} onError={onEventImageError} />
      <div className="event-detail-shade" />
      <div className="event-detail-content">
        <div className="event-detail-main">
          <span className="event-detail-kicker"><Ticket size={15}/>{category ?? (ar ? 'فعالية موسمية' : 'Seasonal event')}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="event-detail-pills"><span><CalendarDays size={15} />{item.date}</span><span><MapPin size={15} />{venue}</span>{timeLine && <span><Clock3 size={15} />{timeLine}</span>}<span className="event-price-pill">{eventPriceLabel(item, ar)}</span>{statusLabel && <span className="event-status">{statusLabel}</span>}</div>
          <div className="event-detail-actions"><a href="#event-book" className="primary-btn">{ar ? 'اطلب مكانك' : 'Request your place'} <ArrowRight size={17} /></a>{hasProgram && <a href="#event-program" className="event-detail-text-link">{ar ? 'شاهد البرنامج' : 'Explore the program'} <ArrowRight size={16}/></a>}<button type="button" className="event-detail-text-link event-share-btn" onClick={share} aria-live="polite"><Share2 size={16} />{shared ? (ar ? 'تم نسخ الرابط' : 'Link copied') : (ar ? 'مشاركة' : 'Share')}</button></div>
        </div>
        <aside className="event-hero-summary" aria-label={ar ? 'ملخص الفعالية' : 'Event at a glance'}>
          <span>{ar ? 'ملخص الفعالية' : 'Event at a glance'}</span>
          <dl>
            <div><dt><CalendarDays size={17}/>{ar ? 'الموعد' : 'When'}</dt><dd>{item.date}{timeLine ? ` · ${timeLine}` : ''}</dd></div>
            <div><dt><MapPin size={17}/>{ar ? 'الوجهة' : 'Where'}</dt><dd>{item.venueName ?? venue}{item.city ? ` · ${ar && item.cityAr ? item.cityAr : item.city}` : ''}</dd></div>
            <div><dt><Compass size={17}/>{ar ? 'شكل الرحلة' : 'Format'}</dt><dd>{item.program?.length ?? 0} {ar ? 'محطات في البرنامج' : 'program chapters'}</dd></div>
          </dl>
          <Link href="/events">{ar ? 'عرض كل الفعاليات' : 'View all events'} <ArrowRight size={15}/></Link>
        </aside>
      </div>
    </section>
    <div className="container event-layout">
      <div className="event-main">
        <section className="event-about">
          <span className="eyebrow">{ar ? 'عن الفعالية' : 'About this event'}</span>
          <h2>{copy}</h2>
          {intro !== copy && <p className="event-lede">{intro}</p>}
          {item.gallery && item.gallery.length > 0 && <div className="event-gallery" role="list" aria-label={ar ? 'صور الفعالية' : 'Event photos'}>{item.gallery.map((src) => <img key={src} role="listitem" src={eventImageSrc(src)} alt={title} loading="lazy" onError={onEventImageError} />)}</div>}
        </section>
        {item.highlights && item.highlights.length > 0 && <section className="event-experience">
          <span className="eyebrow">{ar ? 'ليه الرحلة دي مميزة' : 'Why this journey works'}</span>
          <div className="event-experience-grid">{item.highlights.map((highlight, index) => <article key={highlight.title}><span>{String(index + 1).padStart(2, '0')}</span><Sparkles size={20}/><h3>{ar && highlight.titleAr ? highlight.titleAr : highlight.title}</h3><p>{ar && highlight.descriptionAr ? highlight.descriptionAr : highlight.description}</p></article>)}</div>
        </section>}
        {range.start && now !== null && msLeft > 0 && (status === 'upcoming') && <section className="event-countdown-wrap" aria-label={ar ? 'العد التنازلي' : 'Countdown'}>
          <span className="eyebrow">{ar ? 'العد التنازلي لبداية الفعالية' : 'Countdown to the event'}</span>
          <div className="event-countdown" role="timer">{cd.map((v, i) => <span key={cdLabels[i]}><b>{String(v).padStart(2, '0')}</b><small>{cdLabels[i]}</small></span>)}</div>
        </section>}
        {hasProgram && <section id="event-program" className="event-program">
          <span className="eyebrow">{ar ? 'برنامج الفعالية' : 'Event program'}</span>
          <h2>{ar ? 'يوم بيوم' : 'Day by day'}</h2>
          <div className="event-program-list">{item.program!.map((d) => <article key={`${d.day}-${d.title}`}><span className="event-program-day">{d.day}</span><div><h3>{d.title}</h3><p>{d.description}</p></div></article>)}</div>
        </section>}
        {(included?.length || excluded?.length) && <section className="event-inclusions">
          <span className="eyebrow">{ar ? 'المشمول والمستبعد' : 'Included & excluded'}</span>
          <h2>{ar ? 'اعرف بالضبط إيه الموجود في الترتيب.' : 'Know exactly what the arrangement covers.'}</h2>
          <div className="event-inclusion-grid">
            {included && included.length > 0 && <article><h3>{ar ? 'مشمول' : "What's included"}</h3><ul className="check-list">{included.map((x) => <li key={x}><Check size={16} />{x}</li>)}</ul></article>}
            {excluded && excluded.length > 0 && <article><h3>{ar ? 'غير مشمول' : 'Not included'}</h3><ul className="excluded-list">{excluded.map((x) => <li key={x}><Minus size={16} />{x}</li>)}</ul></article>}
          </div>
        </section>}
        {item.addOns && item.addOns.length > 0 && <section className="event-addons-wrap">
          <span className="eyebrow">{ar ? 'إضافات اختيارية' : 'Optional add-ons'}</span>
          <h2>{ar ? 'زوّد تجربتك' : 'Enhance your experience'}</h2>
          <ul className="event-addons">{item.addOns.map((a) => <li key={a.title}><Plus size={15} />{a.title}{typeof a.price === 'number' ? ` · ${a.price}` : ''}</li>)}</ul>
        </section>}
        <section className="event-venue">
          <span className="eyebrow">{ar ? 'مكان الانعقاد' : 'Venue & area'}</span>
          <h2>{item.venueName ?? venue}</h2>
          {item.address && <p>{ar && item.addressAr ? item.addressAr : item.address}</p>}
          <iframe title={ar ? `خريطة ${venue}` : `${venue} map`} src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQ)}&t=&z=11&ie=UTF8&iwloc=&output=embed`} loading="lazy" className="location-map" />
          <p>{ar ? 'طلب الحضور مبدئي وقيد المراجعة. لا يوجد دفع أو تذكرة مؤكدة هنا.' : 'Attendance requests are preliminary and pending review. No payment or confirmed ticket here.'}</p>
        </section>
        {(item.organizerName || item.organizerPhone || item.organizerWhatsapp || item.organizerEmail) && <section className="event-organizer">
          <span className="eyebrow">{ar ? 'المنظم والتواصل' : 'Organizer & contact'}</span>
          <h2>{ar && item.organizerNameAr ? item.organizerNameAr : item.organizerName ?? (ar ? 'تواصل' : 'Contact')}</h2>
          <ul className="event-organizer-list">
            {item.organizerPhone && <li><Phone size={15} /><a href={`tel:${item.organizerPhone.replace(/\s/g, '')}`}>{item.organizerPhone}</a></li>}
            {item.organizerWhatsapp && <li><MessageCircle size={15} /><a href={`https://wa.me/${item.organizerWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></li>}
            {item.organizerEmail && <li><Mail size={15} /><a href={`mailto:${item.organizerEmail}`}>{item.organizerEmail}</a></li>}
          </ul>
        </section>}
        {related.length > 0 && <section className="event-related">
          <div className="section-title-row"><h2>{ar ? 'فعاليات أخرى' : 'More events'}</h2><Link href="/events" className="text-link">{ar ? 'شاهد الكل' : 'View all'} <ArrowRight size={15} /></Link></div>
          <div className="event-grid two">{related.map((e) => <EventCard item={e} key={e.slug} />)}</div>
        </section>}
      </div>
      <aside id="event-book" className="event-book" aria-label={ar ? 'طلب حضور الفعالية' : 'Event request'}>
        <EventRequestForm event={item} />
      </aside>
    </div>
  </main></SiteShell>
}

export function OffersPage() {
  return <SiteShell><OffersPageContent /></SiteShell>
}

function OffersPageContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveSeasonal = useLiveTours(seasonalTours)
  const customOffers = useLiveCollection('offers', offers).filter((offer) => isCustomSlug(offer.slug))
  const featured = liveSeasonal[0]
  const destinationsCount = new Set(liveSeasonal.flatMap((tour) => tour.location.split(',').map((place) => place.trim()).filter(Boolean))).size
  if (!featured) return null
  return <main className="offers-page">
      <PageShowcaseHero image={featured.image} eyebrow={ar ? 'توفير مختار بعناية في مصر' : 'Curated Egypt savings'} title={ar ? 'عروض سفر في مصر تستاهل تجهزلها شنطة.' : 'Egypt travel offers worth packing for.'} intro={ar ? 'ليالٍ أكثر وإضافات مدروسة وتركيبات لا تُنسى تمنح رحلتك لمصر قيمة أكبر.' : 'More nights, thoughtful extras, and memorable combinations designed to give your Egypt journey more value.'} primaryLabel={ar ? 'استكشف العروض الحالية' : 'Explore current offers'} primaryHref="#current-offers" secondaryLabel={ar ? 'شاهد الباقة المميزة' : 'View the featured package'} secondaryHref={`/egypt-tours/${featured.slug}`} railLabel={ar ? 'باقة مميزة' : 'Featured package'} railTitle={ar && featured.titleAr ? featured.titleAr : featured.title} railHref={`/egypt-tours/${featured.slug}`} railMeta={[{ Icon: Clock3, label: featured.duration }, { Icon: MapPin, label: featured.location }]} statsLabel={ar ? 'ملخص العروض' : 'Offers summary'} stats={[{ value: liveSeasonal.length + customOffers.length, label: ar ? 'باقات معروضة' : 'Packages listed' }, { value: destinationsCount, label: ar ? 'وجهات في العروض' : 'Offer destinations' }]}/>

      <section className="offers-trust" aria-label={ar ? 'مميزات الحجز' : 'Booking benefits'}>
        <div className="container">
          <div><CalendarCheck size={22}/><span><strong>{ar ? 'مصممة حول مواعيدك' : 'Built around your dates'}</strong><small>{ar ? 'نطابق كل عرض مع نافذة سفرك.' : 'We match each offer to your travel window.'}</small></span></div>
          <div><Gift size={22}/><span><strong>{ar ? 'إضافات ذات معنى' : 'Meaningful extras'}</strong><small>{ar ? 'قيمة مضافة تحسّن الرحلة فعلًا.' : 'Added value that improves the actual journey.'}</small></span></div>
          <div><Headphones size={22}/><span><strong>{ar ? 'دعم محلي' : 'Local support'}</strong><small>{ar ? 'فريق مصري حقيقي من الاستفسار للوصول.' : 'A real Egypt-based team from enquiry to arrival.'}</small></span></div>
        </div>
      </section>

      <section id="current-offers" className="offers-current container">
        <header className="offers-section-head">
          <div><span className="eyebrow">{ar ? 'فرص حالية' : 'Current opportunities'}</span><h2>{ar ? 'اختر القيمة المناسبة لرحلتك.' : 'Choose the value that fits your journey.'}</h2></div>
          <p>{ar ? 'كل عرض يمكن تشكيله حول مواعيدك ومجموعتك وإيقاعك المفضل. اسأل فريقنا عن المشمول الدقيق قبل الحجز.' : 'Every offer can be shaped around your dates, group, and preferred pace. Ask our team for the exact inclusions before you commit.'}</p>
        </header>

        <div className="offer-grid">
          {liveSeasonal.map((tour) => {const offer=getTourOffer(tour,seasonalOfferDeadline); return <PromotionCard key={tour.slug} href={`/egypt-tours/${tour.slug}`} title={tour.title} images={promotionGalleryForTour(tour, images)} badge={offer.badge} kicker={ar ? 'باقة مميزة' : 'Special package'} duration={tour.duration} rating={offer.rating} deadline={offer.deadline} countdownLabels={ar ? ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'] as const : undefined} price={tour.price} originalPrice={offer.originalPrice}/>}) }
          {customOffers.map((offer) => <PromotionCard key={offer.slug} href={`/special-offers/${offer.slug}`} title={offer.title} images={[offer.image, ...(offer.gallery ?? [])]} badge={offer.badge} kicker={ar ? 'عرض خاص' : 'Special offer'} duration={offer.duration} rating={offer.rating} deadline={offer.deadline} countdownLabels={ar ? ['أيام', 'ساعات', 'دقائق', 'ثوانٍ'] as const : undefined} price={offer.price} originalPrice={offer.originalPrice} description={offer.copy} highlights={offer.highlights} ctaLabel={ar ? 'احجز هذا العرض' : 'Claim this offer'}/>)}
        </div>
      </section>

      <section className="offers-process">
        <div className="container">
          <header><span className="eyebrow">{ar ? 'بسيط وشخصي' : 'Simple and personal'}</span><h2>{ar ? 'من العرض لرحلة مؤكدة.' : 'From offer to confirmed journey.'}</h2></header>
          <div className="offers-process-grid">
            <div><strong>01</strong><h3>{ar ? 'اختر عرضك' : 'Choose your offer'}</h3><p>{ar ? 'اختر القيمة أو نمط السفر المناسب لرحلتك.' : 'Pick the value or travel style that feels right for your trip.'}</p></div>
            <div><strong>02</strong><h3>{ar ? 'شاركنا مواعيدك' : 'Share your dates'}</h3><p>{ar ? 'أخبرنا بمن يسافر وبالتجربة التي تتصورها.' : 'Tell us who is traveling and the experience you have in mind.'}</p></div>
            <div><strong>03</strong><h3>{ar ? 'أكّد التفاصيل' : 'Confirm the details'}</h3><p>{ar ? 'نتحقق من التوافر وسنرسل البرنامج الدقيق والمشمول.' : 'We verify availability and send the exact itinerary and inclusions.'}</p></div>
          </div>
        </div>
      </section>

      <section className="offers-final">
        <img src={siteImages.nile} alt={ar ? 'رحلة نيلية في مصر' : 'A Nile journey through Egypt'} loading="lazy"/>
        <div className="offers-final-shade"/>
        <div className="container offers-final-content">
          <span className="eyebrow">{ar ? 'هل تحتاج إلى نوع مختلف من القيمة؟' : 'Need a different kind of value?'}</span>
          <h2>{ar ? 'دعنا نصمم عرضًا حول خططك لمصر.' : 'Let us shape an offer around your Egypt plans.'}</h2>
          <p>{ar ? 'أخبرنا بمواعيدك وحجم مجموعتك وقائمة أمنياتك. سيرشح لك مصممو رحلاتنا أفضل خط سير ومشمول متاح.' : 'Tell us your dates, group size, and wish list. Our travel designers will recommend the best available route and inclusions.'}</p>
          <Link href="/make-your-trip" className="primary-btn">{ar ? 'خطط رحلتك' : 'Make your trip'} <ArrowRight size={17}/></Link>
        </div>
      </section>
    </main>
}

export function OfferDetailPage({ slug }: { slug: string }) { const { locale } = useLocale(); const ar = locale === 'ar'; const item = useLiveFind('offers', offers, slug); if (!item) return <DetailNotFound title={ar ? 'العرض غير موجود' : 'Offer not found'} copy={ar ? 'العرض الذي تبحث عنه سلك طريقًا آخر.' : 'The offer you were looking for has taken a different route.'} backHref="/special-offers" backLabel={ar ? 'شاهد كل العروض' : 'See all offers'}/>; return <SiteShell><EditorialHero eyebrow={item.badge} title={item.title} copy={item.copy} image={item.image} href="/contact" action={ar ? 'احجز هذا العرض' : 'Claim this offer'}/><main className="section container detail-layout"><article><h2>{ar ? 'استفد أكثر من وقتك في مصر' : 'Make more of your time in Egypt'}</h2><p>{ar ? 'هذا العرض مصمم ليضيف سهولة وقيمة دون أن ينتقص من التجربة. شاركنا مواعيد سفرك وسنؤكد التوافر والمشمول الدقيق لرحلتك.' : 'This offer is designed to add ease and value without taking away from the experience. Share your travel dates and we will confirm availability and the exact inclusions for your journey.'}</p><div className="detail-highlights"><span><Check size={16}/> {ar ? 'تخطيط رحلة شخصي' : 'Personal trip planning'}</span><span><Check size={16}/> {ar ? 'دعم محلي طوال الرحلة' : 'Local support throughout'}</span><span><Check size={16}/> {ar ? 'شروط واضحة قبل الحجز' : 'Clear terms before booking'}</span></div></article><aside className="booking-card"><h3>{ar ? 'هل أنت مستعد لتخصيصه لك؟' : 'Ready to make it yours?'}</h3><Link href="/contact" className="primary-btn">{ar ? 'تواصل مع فريقنا' : 'Contact our team'}</Link></aside></main></SiteShell> }

export function GuidePage() { const { locale } = useLocale(); const ar = locale === 'ar'; const groups: [string, string, string[]][] = [['Ancient civilization', 'Temples, tombs, and five thousand years of stories.', ['Pharaohs', 'Mythology', 'Pyramids', 'Temples', 'Tombs']], ['Tourist attractions', 'Where to go, city by city.', ['Cairo', 'Luxor', 'Aswan', 'Alexandria', 'Sinai', 'Museums', 'Oases']], ['Travel tips', 'Practical know-how before you fly.', ['Before you travel', 'While you are in Egypt', 'Visas', 'Packing', 'Tipping']], ['Destinations', 'Coasts, deserts, cities, and the Nile.', ['Red Sea', 'White Desert', 'Siwa Oasis', 'Nile Valley']], ['Tour packages', 'How to choose the right format.', ['Classic tours', 'Small groups', 'Honeymoon', 'Adventure', 'Spiritual']], ['Sustainability', 'Travel kindly and leave a positive footprint.', ['Local communities', 'Accessible travel', 'Responsible choices']]]; return <SiteShell><EditorialHero eyebrow={ar ? 'تعلّم قبل أن تسافر' : 'Learn before you go'} title={ar ? 'دليل السفر إلى مصر' : 'Egypt travel guide'} copy={ar ? 'معالم ونصائح ووجهات ونصيحة صادقة لرحلة أسهل.' : 'Attractions, tips, destinations, and honest advice for planning a smoother journey.'} image={siteImages.desert} href="/make-your-trip" action={ar ? 'خطط رحلتي' : 'Plan my trip'} /><main className="section container"><div className="faq-list">{groups.map(([title, copy, topics]) => <details className="faq-item" key={title}><summary>{title}</summary><p>{copy}</p><div className="location-stops">{topics.map(t => <span key={t}>{t}</span>)}</div></details>)}</div></main><HelpCTA /></SiteShell> }

export function AccessiblePage() { const { locale } = useLocale(); const ar = locale === 'ar'; return <SiteShell><EditorialHero eyebrow={ar ? 'سفر للجميع' : 'Travel for everyone'} title={ar ? 'سفر ميسّر في مصر' : 'Accessible travel in Egypt'} copy={ar ? 'مساعدة إضافية وإيقاع مكيّف ونصيحة صادقة ليستمتع كل ضيف بمصر براحة.' : 'Extra assistance, adapted pacing, and honest advice so every guest can enjoy Egypt comfortably.'} image={siteImages.pyramids} href="/contact" action={ar ? 'اسأل عن المساعدة' : 'Ask about assistance'} /><main><section className="section container split-editorial"><div><span className="eyebrow">{ar ? 'خصم 5%' : '5% discount'}</span><h2>{ar ? 'عناية إضافية، علينا.' : 'Extra care, on us.'}</h2><p>{ar ? 'ضيوفنا من ذوي الاحتياجات الخاصة يحصلون على خصم 5% على كل البرامج. أخبرنا باحتياجاتك وسنكيّف السيارات والإيقاع والغرف والمزارات.' : 'Guests requiring accessibility assistance receive 5% off all our tour packages. Tell us what you need and we will adapt vehicles, pacing, hotel rooms, and sightseeing to match.'}</p><div className="detail-highlights">{(ar ? ['سيارات مجهزة', 'خيارات بدون سلالم', 'مرشدون صبورون ومدربون'] : ['Adapted vehicles', 'Step-free options', 'Patient, trained guides']).map(x => <span key={x}><Check size={16} />{x}</span>)}</div></div><img src={siteImages.temple} alt={ar ? 'سفر ميسّر في مصر' : 'Accessible travel in Egypt'} /></section><HelpCTA /></main></SiteShell> } export function FAQPage() { const [open,setOpen] = useState(0); const { locale } = useLocale(); const ar = locale === 'ar'; return <SiteShell><EditorialHero eyebrow={ar ? 'أسئلة وإجابات' : 'Questions, answered'} title={ar ? 'خطط لمصر براحة أكبر' : 'A smoother way to plan Egypt'} copy={ar ? 'اعثر على إجابات واضحة للأسئلة الشائعة، ثم كلمنا عندما تكون جاهزًا للتفاصيل.' : 'Find clear answers to common questions, then talk to our team when you are ready for the details.'} image={siteImages.temple} href="/contact" action={ar ? 'اسأل سؤالًا' : 'Ask a question'}/><main className="section container faq-page"><div className="faq-intro"><span className="eyebrow">{ar ? 'معلومات تهمك' : 'Good to know'}</span><h2>{ar ? 'قبل السفر' : 'Before you go'}</h2><p>{ar ? 'نؤمن أن التخطيط يجب أن يكون مرحبًا مثل الرحلة نفسها.' : 'We believe planning should feel as welcoming as the trip itself.'}</p></div><div className="faq-list">{faqs.map(([question,answer],i)=><div className={`faq-item ${open===i?'open':''}`} key={question}><button onClick={()=>setOpen(open===i?-1:i)}><span>{question}</span><b>{open===i?'−':'+'}</b></button>{open===i&&<p>{answer}</p>}</div>)}</div></main></SiteShell> }

export function SearchPage() { const params=useSearchParams(); const initial=parseSearchQuery(params).q; const [query,setQuery]=useState(initial); useEffect(()=>setQuery(initial),[initial]); const { locale } = useLocale(); const ar = locale === 'ar'; const liveEvents = useLiveEvents(events); const typeLabel = (t: string) => t === 'Blog' ? (ar ? 'مدونة' : t) : t === 'Event' ? (ar ? 'فعالية' : t) : t === 'Offer' ? (ar ? 'عرض' : t) : (ar ? 'وجهة' : t); const staticResults=allSearchItems.filter(item=>`${item.title} ${item.copy}`.toLowerCase().includes(query.toLowerCase())); const liveCustomEvents = liveEvents.filter((e) => !allSearchItems.some((s) => s.slug === e.slug && s.type === 'Event') && isEventPublished(e) && `${e.title} ${e.copy}`.toLowerCase().includes(query.toLowerCase())).map((e) => ({ title: e.title, slug: e.slug, image: e.image, copy: e.copy, type: 'Event' as const })); const results=[...staticResults, ...liveCustomEvents]; return <SiteShell><main className="search-page container"><div className="search-page-header"><span className="eyebrow">{ar ? 'استكشف الموقع' : 'Explore the site'}</span><h1>{ar ? 'اعثر على حكايتك القادمة في مصر' : 'Find your next Egypt story'}</h1><label><Search size={20}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value.slice(0,120))} placeholder={ar ? 'ابحث عن رحلات ووجهات وحكايات...' : 'Search tours, destinations, stories...'} aria-label={ar ? 'بحث' : 'Search'}/></label></div><div className="search-results"><p>{ar ? `${results.length} نتيجة` : `${results.length} result${results.length===1?'':'s'}`}{query ? (ar ? ` عن "${query}"` : ` for "${query}"`) : ''}</p><div className="content-grid">{results.map(item=><article className="content-card" key={`${item.type}-${item.slug}`}><img className="content-image" src={item.image} alt={item.title}/><div className="content-card-body"><small>{typeLabel(item.type)}</small><h3>{item.title}</h3><p>{item.copy}</p><Link href={item.type==='Blog'?`/blogs/${item.slug}`:item.type==='Event'?`/events/${item.slug}`:item.type==='Offer'?`/special-offers/${item.slug}`:`/destinations/${item.slug}`} className="text-link">{ar ? 'استكشف' : 'Explore'} <ArrowRight size={15}/></Link></div></article>)}</div></div></main></SiteShell> }

export function PolicyPage({ type }: { type: 'privacy' | 'terms' }) { const { locale } = useLocale(); const ar = locale === 'ar'; const title=type==='privacy'?(ar?'سياسة الخصوصية':'Privacy Policy'):(ar?'الشروط والأحكام':'Terms and Conditions'); return <SiteShell><Breadcrumb items={[title]}/><main className="policy-page container"><span className="eyebrow">STAR PYRAMIDS Tours</span><h1>{title}</h1><p className="policy-lede">{ar ? 'واضحة ومحترمة وسهلة الفهم. هذه الملاحظات تشرح طريقة تعاملنا معك.' : 'Clear, respectful, and easy to understand. These notes explain how we work with you.'}</p>{policies[type].map(item=><section key={item.h}><h2>{item.h}</h2><p>{item.p}</p></section>)}</main></SiteShell> }
export function ForgotPasswordPage() { const [sent,setSent]=useState(false); const { locale } = useLocale(); const ar = locale === 'ar'; return <SiteShell><main className="auth-page-centered"><div className="auth-card"><div className="auth-mobile-logo"><Link href="/"><span className="brand-copy"><strong>STAR PYRAMIDS</strong><small>SINCE 1970</small></span></Link></div>{sent?<div className="form-success"><Check size={34}/><h2>{ar?'معاينة الاستعادة':'Recovery preview'}</h2><p>{ar?'لم يتم إرسال أي بريد إلكتروني. استعادة الحساب غير مربوطة بالخلفية بعد — هذه معاينة فقط.':'No email has been sent. Account recovery is not connected to the backend yet — this is a preview only.'}</p><p className="auth-switch"><Link href="/login">{ar?'العودة إلى تسجيل الدخول':'Back to sign in'}</Link></p></div>:<><span className="eyebrow">{ar?'استعادة الحساب':'Account recovery'}</span><h1>{ar?'استعادة كلمة المرور':'Reset your password'}</h1><p>{ar?'أدخل بريدك لمعاينة خطوات الاستعادة.':'Enter your email to preview the recovery flow.'}</p><form className="contact-form" onSubmit={(e)=>{e.preventDefault();setSent(true)}}><label>{ar?'البريد الإلكتروني':'Email address'}<input required type="email" placeholder="you@example.com"/></label><button className="auth-submit" type="submit">{ar?'أرسل رابط الاستعادة':'Send reset link'}</button></form><p className="auth-switch">{ar?'هل تذكرت كلمة المرور؟':'Remembered your password?'} <Link href="/login">{ar?'سجّل دخولك':'Sign in'}</Link></p></>}</div></main></SiteShell> }

export function AccountPage({ section = 'overview' }: { section?: string }) { const { locale } = useLocale(); const ar = locale === 'ar'; const nav=[[ar?'نظرة عامة':'Overview','/account'],[ar?'حجوزاتي':'My bookings','/account/bookings'],[ar?'المفضلة':'Favorites','/account/favorites'],[ar?'إعدادات الحساب':'Profile settings','/account/profile']]; const activeKey=section==='overview'?(ar?'نظرة عامة':'Overview'):section==='bookings'?(ar?'حجوزاتي':'My bookings'):section==='favorites'?(ar?'المفضلة':'Favorites'):(ar?'إعدادات الحساب':'Profile settings'); const heading=section === 'overview' ? (ar?'افسح مكانًا لمغامرتك القادمة.':'Make space for your next adventure.') : section === 'bookings' ? (ar?'حجوزاتك':'Your bookings') : section === 'favorites' ? (ar?'الرحلات المحفوظة':'Saved journeys') : (ar?'إعدادات الحساب':'Profile settings'); return <SiteShell><main className="account-page container"><ImpersonationBanner /><aside className="account-nav"><span className="eyebrow">{ar?'حسابك':'Your account'}</span><h1>{ar?'مرحبًا بعودتك':'Welcome back'}</h1>{nav.map(([label,href])=><Link className={activeKey===label?'active':''} key={href} href={href}>{label}<ArrowRight size={15}/></Link>)}<Link href="/">{ar?'تسجيل الخروج':'Sign out'}</Link></aside><section className="account-content"><span className="eyebrow">{section === 'overview' ? (ar?'مكتب سفرك':'Your travel desk') : activeKey}</span><h2>{heading}</h2>{section==='overview'?<><div className="account-stats"><div><strong>0</strong><span>{ar?'رحلات قادمة':'Upcoming trips'}</span></div><div><strong>0</strong><span>{ar?'رحلات محفوظة':'Saved tours'}</span></div><div><strong>1</strong><span>{ar?'طلب مفتوح':'Open enquiry'}</span></div></div><div className="account-empty"><h3>{ar?'فصلك القادم يبدأ من هنا.':'Your next chapter starts here.'}</h3><p>{ar?'استكشف رحلاتنا واحفظ ما يثير فضولك.':'Explore our journeys and save the ones that make you curious.'}</p><Link href="/egypt-tours/one-day-tours" className="primary-btn">{ar?'تصفح الرحلات':'Browse tours'}</Link></div></>:<div className="account-empty"><h3>{ar?'لا يوجد شيء هنا بعد.':'Nothing here yet.'}</h3><p>{ar?'عندما تكون جاهزًا، ستظهر تفاصيل سفرك هنا.':'When you are ready, your STAR PYRAMIDS travel details will appear in this space.'}</p><Link href="/make-your-trip" className="primary-btn">{ar?'ابدأ التخطيط':'Start planning'}</Link></div>}</section></main></SiteShell> }
