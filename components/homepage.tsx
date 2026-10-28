'use client'
import { HomepageHero, type PublicHomeHero } from './homepage-hero'
import type { Locale } from './locale'
import { GalleryLightbox } from './gallery-lightbox'
import { ProviderReviewsSection } from './provider-reviews'
import { SustainabilityBadge } from './sustainability-badge'

import Image from 'next/image'
import Link from 'next/link'
import { OfferCards } from './offer-campaigns'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Heart, Star, CalendarCheck, Sparkles, Users, Landmark, Leaf, MapPin, Award, BadgeCheck, MousePointerClick, CalendarDays, ThumbsUp, Play } from 'lucide-react'
import { useHomepageGallery } from '@/lib/journey-gallery-client'
import { galleryPlatformLabel, resolveGalleryVideoSource, type GalleryItem } from '@/lib/journey-gallery'
import { SiteShell, TripSearchEngine, TourCard } from '@/components/site'
import { useDbBlogs } from '@/lib/offers-blogs-client'
import { useDbDestinations } from '@/lib/catalogue-client'
import { useDbTours } from '@/lib/tours-client'
import { useLocale, tx } from './locale'
import { blogs as allBlogs, destinations as allDestinations } from '@/data/content'
import { catalogTours, getDealPrice, popularTours, seasonalTours } from '@/data/tours'
import { InternationalPhoneInput } from './international-phone-input'
import { SharedSelect } from '@/components/shared-select'
import { DateInput } from '@/components/date-input'
import { homeStrings } from '@/lib/homepage-copy'
import { CmsPublicLink } from './cms-public-link'
import './page-sections.css'
import { CmsPageSection, OrderedPageSections, PageContentProvider, useHomeCopy, usePageSection, useSectionContent } from './page-sections-context'
import { CmsIcon, cmsIcons } from './cms-icons'
import { selectPageRecords, type PublicPageContent } from '@/lib/page-sections'
import type { Blog, Destination, Tour } from '@/data/types'
const emptyTours: readonly Tour[] = []
const emptyBlogs: readonly Blog[] = []
const emptyDestinations: readonly Destination[] = []

const seasonal = seasonalTours
const popular = popularTours
const faqs = ['What is included in an Egypt tour package?','Do you offer private tours and custom itineraries?','When is the best time to visit Egypt?','Can I book airport transfers and hotels?','What payment options are available?','Is Egypt safe for travelers?']
const trustedLogos = [
  { name: 'Tripadvisor', src: '/trusted/tripadvisor.png' },
  { name: 'Booking.com', src: '/trusted/booking.png' },
  { name: 'Viator', src: '/trusted/Viator.png' },
  { name: 'Google Reviews', src: '/trusted/Google-Review.png' },
  { name: 'GetYourGuide', src: '/trusted/Get-your-guide.png' },
  { name: 'Trustindex', src: '/trusted/TrustIndex.webp' },
] as const

function SectionHeading({eyebrow,title,subtitle}:{eyebrow?:string;title:string;subtitle?:string}){return <div className="home-heading">{eyebrow&&<span>{eyebrow}</span>}<h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>}

// Reviews data, platform icons, and the write-a-review modal live in ./reviews (shared with tour pages).
function ViewAll({href='/trips'}:{href?:string}){const {locale:vl}=useLocale(); const section=useSectionContent(); const target=section?.href??href; const label=vl==='ar'?homeStrings[vl].viewAll:section?.text[vl].viewAll??homeStrings[vl].viewAll; return <CmsPublicLink className="small-orange-btn" href={target}>{label} <ArrowRight size={15}/></CmsPublicLink>}


const helpFormStrings = {
  en: {
    sending: 'Sending...',
    nameError: 'Enter your name.',
    emailError: 'Enter a valid email address.',
    phoneError: 'Enter a valid phone number.',
    failure: 'We could not send your request. Please try again.',
  },
  es: {
    sending: 'Enviando...',
    nameError: 'Introduce tu nombre.',
    emailError: 'Introduce un correo electrónico válido.',
    phoneError: 'Introduce un número de teléfono válido.',
    failure: 'No pudimos enviar tu solicitud. Inténtalo de nuevo.',
  },
  it: {
    sending: 'Invio in corso...',
    nameError: 'Inserisci il tuo nome.',
    emailError: 'Inserisci un indirizzo email valido.',
    phoneError: 'Inserisci un numero di telefono valido.',
    failure: 'Non siamo riusciti a inviare la richiesta. Riprova.',
  },
  ar: {
    sending: 'جارٍ الإرسال...',
    nameError: 'اكتب اسمك.',
    emailError: 'اكتب بريداً إلكترونياً صحيحاً.',
    phoneError: 'اكتب رقم هاتف صحيحاً.',
    failure: 'تعذر إرسال طلبك. حاول مرة أخرى.',
  },
} as const

export function ReviewsSection(){const section=usePageSection('reviews'); const {locale}=useLocale(); return <ProviderReviewsSection heading={locale==='ar'?undefined:section?.text[locale].heading} description={locale==='ar'?undefined:section?.text[locale].description}/>}

const statItems=[{prefix:'+',target:100,suffix:'K',decimals:0,Icon:Users},{prefix:'+',target:50,suffix:'',decimals:0,Icon:Award},{prefix:'+',target:60,suffix:'',decimals:0,Icon:MapPin},{prefix:'',target:5,suffix:'',decimals:1,Icon:Star}];

function useCountUp(target:number,decimals:number,started:boolean,duration=1600){const [val,setVal]=useState(0);useEffect(()=>{if(!started)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setVal(target);return;}let raf=0;const t0=performance.now();const tick=(t:number)=>{const p=Math.min(1,(t-t0)/duration);const e=1-Math.pow(1-p,3);setVal(parseFloat((target*e).toFixed(decimals)));if(p<1)raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf);},[started,target,decimals,duration]);return val;}

function StatItem({prefix,target,suffix,decimals,label,Icon,started}:{prefix:string;target:number;suffix:string;decimals:number;label:string;Icon:typeof Users;started:boolean}){const v=useCountUp(target,decimals,started);return <div><span className="stat-ic" aria-hidden="true"><Icon size={22}/></span><b>{prefix}{v.toFixed(decimals)}{suffix}</b><span>{label}</span></div>;}

function StatsStrip(){const {locale:sl}=useLocale(); const section=usePageSection('stats'); const ref=useRef<HTMLElement|null>(null);const [started,setStarted]=useState(false);useEffect(()=>{const el=ref.current;if(!el)return;const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setStarted(true);io.disconnect();}},{threshold:.4});io.observe(el);return ()=>io.disconnect();},[]);return <section ref={ref} className="home-stats container">{(section?.items??[]).filter(item=>item.visible).map((item)=><StatItem key={item.id} prefix={item.prefix??''} target={item.value??0} suffix={item.suffix??''} decimals={item.decimals??0} Icon={cmsIcons[item.icon??'Users']} label={item.text[sl==='ar'?'en':sl].label} started={started}/>)}</section>;}

function createEnquiryRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function HomepageHelpForm() {
  const { locale } = useLocale()
  const copy = useHomeCopy()
  const formCopy = helpFormStrings[locale]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const pendingRequest = useRef<{ payload: string; id: string } | null>(null)

  const clearStatus = () => {
    if (status !== 'idle') setStatus('idle')
    if (error) setError('')
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()
    const phoneDigits = trimmedPhone.replace(/\D/g, '')
    if (!trimmedName || trimmedName.length > 120) {
      setStatus('error'); setError(formCopy.nameError); document.getElementById('home-help-name')?.focus(); return
    }
    if (!/^[^\s@]{1,120}@[^\s@]{1,120}\.[^\s@]{2,24}$/.test(trimmedEmail)) {
      setStatus('error'); setError(formCopy.emailError); document.getElementById('home-help-email')?.focus(); return
    }
    if (!/^\+?[0-9 ()-]{6,24}$/.test(trimmedPhone) || phoneDigits.length < 6 || phoneDigits.length > 15) {
      setStatus('error'); setError(formCopy.phoneError); document.getElementById('home-help-phone')?.focus(); return
    }

    const enquiry = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      subject: 'Homepage trip help request',
      message: 'Please contact me to help plan an Egypt trip.',
      sourcePage: '/',
    }
    const payload = JSON.stringify(enquiry)
    if (pendingRequest.current?.payload !== payload) {
      pendingRequest.current = { payload, id: createEnquiryRequestId() }
    }

    submitting.current = true
    setStatus('submitting')
    setError('')
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...enquiry, requestId: pendingRequest.current.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || typeof data?.enquiry?.publicId !== 'string' || typeof data?.enquiry?.createdAt !== 'string') {
        throw new Error(formCopy.failure)
      }
      pendingRequest.current = null
      setName('')
      setEmail('')
      setPhone('')
      setStatus('success')
    } catch {
      setStatus('error')
      setError(formCopy.failure)
    } finally {
      submitting.current = false
    }
  }

  const disabled = status === 'submitting'
  return <section className="help-home container"><div className="help-layout"><div className="help-text"><h2>{copy.helpT}</h2><p>{copy.helpS}</p></div><form className="help-form" onSubmit={submit} noValidate><input id="home-help-name" placeholder={copy.helpN} required maxLength={120} disabled={disabled} value={name} onChange={(event)=>{setName(event.target.value);clearStatus()}} aria-label={copy.helpN} aria-invalid={status==='error'&&!name.trim()} aria-describedby="home-help-status"/><input id="home-help-email" placeholder={copy.helpE} required type="email" maxLength={190} disabled={disabled} value={email} onChange={(event)=>{setEmail(event.target.value);clearStatus()}} aria-label={copy.helpE} aria-describedby="home-help-status"/><InternationalPhoneInput id="home-help-phone" required disabled={disabled} value={phone} onChange={(value)=>{setPhone(value);clearStatus()}} locale={locale} placeholder={copy.helpP} describedBy="home-help-status"/><button className="primary-btn" type="submit" disabled={disabled}>{disabled?formCopy.sending:copy.contactNow}</button><p id="home-help-status" className={`help-form-status ${status}`} role={status==='error'?'alert':'status'} aria-live="polite">{status==='success'?`${copy.thanks1}${name?` ${name}`:''}${copy.thanks2}`:error}</p></form></div></section>
}

const galleryBlurPlaceholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

function GalleryPhotoImg({src,alt}:{src:string;alt:string}){
  const sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
  // next/image only serves local paths + allowlisted remotes; anything
  // else falls back to a plain image so admin URLs never break the row.
  if(src.startsWith('/')) return <Image src={src} alt={alt} fill sizes={sizes} loading="lazy" placeholder="blur" blurDataURL={galleryBlurPlaceholder}/>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy"/>
}

function JourneyGallerySection({title,subtitle}:{title:string;subtitle:string}){
  const {locale}=useLocale();
  const t=(en:string,es:string,it:string)=>tx(locale,{en,es,it});
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const {photos:dbPhotos,videos:dbVideos,loading,error,retry}=useHomepageGallery();
  const videoItems=dbVideos.filter(item=>Boolean(resolveGalleryVideoSource(item.mediaUrl,item.platform)));
  const items=[...dbPhotos,...videoItems];
  const open=(item:GalleryItem,event:React.SyntheticEvent<HTMLElement>)=>{event.currentTarget.focus();setSelectedId(item.id)};
  if(loading||error) return <section className="home-section gal-section"><div className="container"><SectionHeading title={title} subtitle={subtitle}/>{error?<div role="alert"><p>{t('Unable to load the gallery.','No se pudo cargar la galería.','Impossibile caricare la galleria.')}</p><button className="outline-btn" onClick={retry}>{t('Retry','Reintentar','Riprova')}</button></div>:<p role="status">{t('Loading gallery…','Cargando galería…','Caricamento galleria…')}</p>}</div></section>;
  if(!items.length) return null;
  const row=(rows:GalleryItem[],video:boolean)=><div className={`gal-track${video?' rev':''}${selectedId?' is-paused':''}`}>{[0,1].map(half=><div className="gal-group" key={half} aria-hidden={half===1}>{rows.map(item=><div key={item.id} className="gal-card" role="button" tabIndex={half===1?-1:0} aria-label={video?t('Play video: ','Reproducir vídeo: ','Riproduci video: ')+item.title:t('Enlarge photo: ','Ampliar foto: ','Ingrandisci foto: ')+item.title} onClick={event=>open(item,event)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(item,event)}}}>{video?(item.thumbnail?<GalleryPhotoImg src={item.thumbnail} alt=""/>:<span className="gal-video-fallback" aria-hidden="true"/>):<GalleryPhotoImg src={item.mediaUrl} alt={item.title}/>}<b>{item.title}</b>{video&&<><span className="gal-play"><Play size={16} fill="currentColor"/></span><span className="gal-video-platform">{galleryPlatformLabel(resolveGalleryVideoSource(item.mediaUrl,item.platform)!.platform)}</span></>}</div>)}</div>)}</div>;
  return <section className="home-section gal-section"><div className="container"><SectionHeading title={title} subtitle={subtitle}/></div><div className="gal-marquee" dir="ltr">{dbPhotos.length>0&&row(dbPhotos,false)}{videoItems.length>0&&row(videoItems,true)}</div>{selectedId&&<GalleryLightbox items={items} selectedId={selectedId} onSelect={setSelectedId} onClose={()=>setSelectedId(null)} locale={locale}/>}</section>
}

export function RebuiltHomePage({hero,initialLocale,pageContent}:{hero?:PublicHomeHero;initialLocale?:Locale;pageContent?:PublicPageContent}){return <PageContentProvider state={pageContent}><SiteShell initialLocale={initialLocale}><RebuiltHomePageInner hero={hero}/></SiteShell></PageContentProvider>}
function RebuiltHomePageInner({hero}:{hero?:PublicHomeHero}){const [category,setCategory]=useState('All'); const [msDest,setMsDest]=useState(''); const [msFrom,setMsFrom]=useState(''); const [msTo,setMsTo]=useState(''); const [msGuests,setMsGuests]=useState(''); const {locale:hl}=useLocale(); const hx=useHomeCopy(); const featuredSection=usePageSection('featured'); const popularSection=usePageSection('popular'); const offersSection=usePageSection('offers'); const highlightsSection=usePageSection('highlights'); const blogsSection=usePageSection('blogs'); const howSection=usePageSection('how'); const sustainabilitySection=usePageSection('sustainability'); const faqSection=usePageSection('faq'); const selectedTours=useDbTours(emptyTours,{includeNew:true}); const selectedBlogs=useDbBlogs(emptyBlogs).filter(b=>b.isPublished!==false); const selectedDestinations=useDbDestinations(emptyDestinations).filter(d=>d.isPublished!==false&&d.showInDestinations!==false); const liveBlogs=useDbBlogs(allBlogs).filter((b)=>b.isPublished!==false); const liveDestinations=useDbDestinations(allDestinations).filter((d)=>d.showInDestinations!==false&&d.isPublished!==false); const liveSeasonal=useDbTours(seasonal); const livePopular=useDbTours(popular); const liveCatalog=useDbTours(catalogTours); const goPlan=()=>{const q=new URLSearchParams(); if(msDest)q.set('destination',msDest); if(msFrom)q.set('from',msFrom); if(msTo)q.set('to',msTo); if(msGuests)q.set('guests',msGuests); if(msFrom&&msTo)q.set('step','2'); const s=q.toString(); router.push('/make-your-trip'+(s?`?${s}`:'')); }; const router=useRouter(); const automaticPopular=category==='All'?livePopular:liveCatalog.filter((t)=>t.category===category).slice(0,8); const visiblePopular=popularSection?.selectionMode==='selected'?selectPageRecords(popularSection,selectedTours).filter(t=>category==='All'||t.category===category):selectPageRecords(popularSection,automaticPopular); const featuredTours=selectPageRecords(featuredSection,selectedTours,liveSeasonal); const highlightedDestinations=selectPageRecords(highlightsSection,selectedDestinations,liveDestinations); const blogItems=selectPageRecords(blogsSection,selectedBlogs,liveBlogs); const language=hl==='ar'?'en':hl; return <main className="rebuilt-home">
  <OrderedPageSections>
  <CmsPageSection id="hero"><HomepageHero state={hero} heading={hx.heroTitle} eyebrow={hx.heroSpan}><TripSearchEngine/></HomepageHero></CmsPageSection>
  <CmsPageSection id="stats"><StatsStrip/></CmsPageSection>
  <CmsPageSection id="featured"><section className="home-section container"><SectionHeading title={hx.xmasT} subtitle={hx.xmasS}/><div className="compact-tour-grid">{featuredTours.map(t=><TourCard key={t.title} tour={t}/>)}</div><div className="center-cta"><ViewAll href="/egypt-tours/multi-days-tours"/></div></section></CmsPageSection>
  <CmsPageSection id="popular"><section className="home-section home-soft"><div className="container"><SectionHeading title={hx.popT} subtitle={hx.popS}/><div className="category-pills" role="tablist" aria-label="Filter destinations">{[['All',hx.all],['one-day-tours',hx.oneDay],['multi-days-tours',hx.multiDays],['nile-cruises',hx.nileCruises],['shore-excursions',hx.shoreExcursion]].map(([v,l])=><button key={v} type="button" role="tab" aria-selected={category===v} className={category===v?'active':''} onClick={()=>setCategory(v)}>{l}</button>)}</div>{visiblePopular.length?<div className="compact-tour-grid popular-grid">{visiblePopular.map(t=><TourCard key={t.slug} tour={t}/>)}</div>:<div className="account-empty"><h3>{hx.noTours} {category} {hx.noToursEnd}</h3><p>{hx.tryOther}</p><button type="button" className="primary-btn" onClick={()=>setCategory('All')}>{hx.showAll}</button></div>}<div className="center-cta"><ViewAll/></div></div></section></CmsPageSection>
  <CmsPageSection id="planner"><section className="home-section container trip-promo"><SectionHeading title={hx.tripT} subtitle={hx.tripS}/><div className="mini-search"><label><small>{hx.msDest}</small><SharedSelect value={msDest} onChange={setMsDest} locale={hl} label={hx.msDest} placeholder="" guidance={hx.msDestPh} modal={false} options={[...liveDestinations.map((d) => ({ value: d.slug, label: d.title }))]} /></label><div className="ms-dates"><label><small>{hx.msFrom}</small><DateInput aria-label={hx.msFrom} value={msFrom} onChange={(e)=>{const next=e.target.value; setMsFrom(next); if(next&&msTo&&msTo<next)setMsTo('')}}/></label><label><small>{hx.msTo}</small><DateInput aria-label={hx.msTo} value={msTo} min={msFrom||undefined} onChange={(e)=>setMsTo(e.target.value)}/></label></div><label><small>{hx.msTrav}</small><SharedSelect value={msGuests} onChange={setMsGuests} locale={hl} label={hx.msTrav} placeholder="" guidance={hx.msTravPh} modal={false} options={[...[1,2,3,4,5,6,7,8].map((n) => ({ value: String(n), label: `${n} ${n===1?hx.person:hx.people}` })), { value: '9', label: hx.ninePlus }]} /></label><button type="button" className="primary-btn" onClick={goPlan}>{hx.startPlan} <ArrowRight size={17}/></button></div></section></CmsPageSection>
  <CmsPageSection id="offers"><section className="home-section home-soft"><div className="container"><SectionHeading eyebrow={hx.offE} title={hx.offT} subtitle={hx.offS}/><OfferCards placement="home" limit={offersSection?.limit||4} slugs={offersSection?.selectionMode==='selected'?offersSection.selection:undefined}/><div className="center-cta"><ViewAll href="/special-offers"/></div></div></section></CmsPageSection>
  <CmsPageSection id="how"><section className="home-section container how-home"><SectionHeading title={hx.howT} subtitle={hx.howS}/><div className="how-path-wrap" dir="ltr"><svg className="how-path-svg" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path id="howFlightPath" d="M-20,110 C60,110 140,50 240,55 C340,60 360,112 470,116 C540,119 560,119 600,117 C660,114 700,60 800,55 C880,51 900,60 960,57 C1050,53 1100,85 1220,70" fill="none" stroke="#c3d2e8" strokeWidth="2.5" strokeDasharray="9 9" strokeLinecap="round" className="how-dashes"/><g transform="translate(14,110)" fill="#9aa7bd"><path d="M0,0 C-5,-7 -8,-10.5 -8,-15 a8,8 0 0,1 16,0 C8,-10.5 5,-7 0,0 Z"/><circle cx="0" cy="-15" r="3" fill="#fff"/></g><g fill="#9aa7bd"><animateMotion dur="16s" repeatCount="indefinite" rotate="auto"><mpath href="#howFlightPath"/></animateMotion><path d="M15,0 L-7,-7.5 L-2.5,0 L-7,7.5 Z"/></g></svg><div className="how-steps">{(howSection?.items??[]).map((item,index)=>item.visible&&<CmsPublicLink key={item.id} href={item.href??''} className="how-node" style={{left:['20%','50%','80%'][index],top:index===1?'59px':'0px'}}><span className="how-disc"><CmsIcon id={item.icon} size={34}/></span><span className="how-pill">{item.text[language].step}</span><h3>{item.text[language].heading}</h3><p>{item.text[language].description}</p></CmsPublicLink>)}</div></div></section></CmsPageSection>
  <CmsPageSection id="highlights"><section className="home-section home-soft hl-section"><div className="container"><SectionHeading title={hx.hlT} subtitle={hx.hlS}/></div><div className="hl-marquee" dir="ltr"><div className="hl-track">{[0,1].map(half=><div className="hl-group" key={half} aria-hidden={half===1}>{highlightedDestinations.map(d=><Link href={`/destinations/${d.slug}`} key={d.slug+'-'+half} className="hl-card" tabIndex={half===1?-1:0}><Image src={d.image} alt={d.title} fill sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="/><span>{d.title}</span></Link>)}</div>)}</div></div></section></CmsPageSection>
  <CmsPageSection id="blogs"><section className="home-section container"><SectionHeading title={hx.blogT} subtitle={hx.blogS}/><div className="blog-home-grid">{blogItems.map(b=><article key={b.slug}><Image src={b.image} alt={b.title} width={600} height={360} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" loading="lazy" placeholder="blur" blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="/><div><small>{b.category}</small><h3><Link href={`/blogs/${b.slug}`}>{b.title}</Link></h3><Link href={`/blogs/${b.slug}`} style={{display:'inline-flex',alignItems:'center',gap:6,color:'var(--blue)',fontSize:12,fontWeight:700}}>{hx.readMore} <ArrowRight size={14}/></Link></div></article>)}</div><div className="center-cta"><ViewAll href="/blogs"/></div></section></CmsPageSection>
  <CmsPageSection id="sustainability"><section className="sustainability container"><div className="sus-main"><span className="sus-eyebrow">{hx.susE}</span><h2>{hx.susT1} <em>{hx.susT2}</em></h2><p>{hx.susP}</p><div className="sus-stats">{(sustainabilitySection?.items??[]).filter(item=>item.visible).map(item=><div key={item.id}><CmsIcon id={item.icon} size={17}/><span>{item.text[language].line1}<small>{item.text[language].line2}</small></span></div>)}</div><CmsPublicLink className="sus-cta" href={sustainabilitySection?.href??"/about"}>{hx.susCta} <ArrowRight size={16}/></CmsPublicLink></div><SustainabilityBadge image={sustainabilitySection?.media?.badgeImage} first={hx.susB1} second={hx.susB2} caption={hx.susB3} /></section></CmsPageSection>
  <CmsPageSection id="gallery"><JourneyGallerySection title={hx.galT} subtitle={hx.galS}/></CmsPageSection>
  <CmsPageSection id="reviews"><ReviewsSection/></CmsPageSection>
  <CmsPageSection id="faq"><section className="home-section container faq-home"><div><SectionHeading title={hx.faqT} subtitle={hx.faqS}/><CmsPublicLink className="small-orange-btn" href={faqSection?.href??"/faq"}>{hx.faqAll} <ArrowRight size={15}/></CmsPublicLink></div><div className="faq-home-list">{(faqSection?.items??[]).filter(item=>item.visible).map((item,i)=><details key={item.id} open={i===0}><summary>{item.text[language].question}<span>+</span></summary><p>{item.text[language].answer}</p></details>)}</div></section></CmsPageSection>
  <CmsPageSection id="help"><HomepageHelpForm/></CmsPageSection>
  </OrderedPageSections>
</main>}
