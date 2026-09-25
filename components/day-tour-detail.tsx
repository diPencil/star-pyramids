"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Heart, MapPin, Minus, Plus, Share2, ShieldCheck, Users } from "lucide-react"
import { dayTourRegions, dayTourTerms, getBookingTotal, getToursByCategory, normalizeTourPricePeriods } from "@/data/tours"
import { findDestination, siteImages } from "@/data/content"
import type { Tour, TourAddOn } from "@/data/types"
import { formatPrice, useLocale } from "./locale"
import { addToCart } from "@/lib/cart"
import { formatTourDateRange, localizeTourDuration, localizeTourLocation } from "@/lib/tour-format"
import { TourReviewsSection } from "./reviews"
import { TourVideoGallery } from "./tour-video-gallery"
import { AskQuestionButton } from "./ask-question"
import { HorizontalSlider } from "./horizontal-slider"
import { TourLocationMap } from "./tour-detail"
import { useTourOverride } from "@/lib/admin-store"

type GalleryImage = { src: string; alt: string }

const cairoStreet = "https://images.unsplash.com/photo-1707172889437-dc6f210ea44a?auto=format&fit=crop&w=1400&q=86"
const redSeaReef = "https://images.unsplash.com/photo-1581088053806-9ea7682a41e8?auto=format&fit=crop&w=1400&q=86"

const regionGalleries: Record<string, readonly GalleryImage[]> = {
  Cairo: [
    { src: cairoStreet, alt: "Historic street in Cairo" },
    { src: siteImages.pyramids, alt: "Pyramids and Sphinx in nearby Giza" },
  ],
  Giza: [
    { src: siteImages.pyramids, alt: "Great Sphinx and pyramids in Giza" },
    { src: "https://images.unsplash.com/photo-1636020833630-89d4a5a75807?auto=format&fit=crop&w=1400&q=86", alt: "Sphinx and Pyramid of Khafre" },
  ],
  Luxor: [
    { src: findDestination("luxor")!.detail.heroImage, alt: "Karnak Temple in Luxor" },
    { src: "/egypt-hero.png", alt: "Temple columns in Luxor" },
  ],
  Aswan: [
    { src: findDestination("aswan")!.detail.heroImage, alt: "Nubian village beside the Nile in Aswan" },
    { src: "https://images.unsplash.com/photo-1655163394179-8b30a553dd6c?auto=format&fit=crop&w=1400&q=86", alt: "Nubian houses beside the Nile" },
  ],
  Hurghada: [
    { src: siteImages.redSea, alt: "Red Sea diving scene" },
    { src: redSeaReef, alt: "Coral and fish in the Red Sea" },
  ],
  "Sharm El Sheikh": [
    { src: siteImages.redSea, alt: "Red Sea diving scene" },
    { src: redSeaReef, alt: "Coral and fish in the Red Sea" },
  ],
}

export function DayTourDetailPage({ tour: initialTour }: { tour: Tour }) {
  const sourceTour = useTourOverride(initialTour.slug, initialTour)
  const { currency, locale } = useLocale()
  const ar = locale === 'ar'
  const tour = ar && sourceTour.titleAr ? { ...sourceTour, title: sourceTour.titleAr } : sourceTour
  const detail = tour.dayDetail
  const included = detail?.included ?? dayTourTerms.included
  const excluded = detail?.excluded ?? dayTourTerms.excluded
  const addOns: readonly TourAddOn[] = detail?.addOns ?? dayTourTerms.addOns
  const gallery = detail?.gallery?.length ? detail.gallery : regionGalleries[tour.location] ?? [{ src: tour.image, alt: `${tour.location} travel scene` }]
  const region = dayTourRegions.find((item) => item.name === tour.location)
  const regionName = region ? (ar ? region.nameAr : region.name) : tour.location
  const locationName = ar ? localizeTourLocation(tour.location) : tour.location
  const durationName = ar ? localizeTourDuration(tour.duration) : tour.duration
  const regionHref = region ? `/egypt-tours/one-day-tours/${region.slug}` : "/egypt-tours/one-day-tours"
  const related = getToursByCategory("one-day-tours").filter((item) => item.slug !== tour.slug && item.location === tour.location).slice(0, 4)
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState("overview")
  const [openStop, setOpenStop] = useState(0)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [travelDate, setTravelDate] = useState("")
  const router = useRouter()
  const [favorite, setFavorite] = useState(false)
  const [selectedAddOns, setSelectedAddOns] = useState<number[]>([])
  const selectedAddOnTotal = selectedAddOns.reduce((sum, index) => sum + (addOns[index]?.price ?? 0), 0)
  const hasUnpricedAddOns = selectedAddOns.some((index) => addOns[index]?.price === undefined)
  const heads = Math.max(1, adults + children + infants)
  const pricing = getBookingTotal(tour, adults, children, infants)
  const locations = detail?.locations?.length ? detail.locations : [tour.location]
  const pricePeriods = normalizeTourPricePeriods(detail?.priceRows, ar ? 'مواعيد السفر المتاحة' : 'Available travel dates')
  const planHref = `/make-your-trip?tour=${encodeURIComponent(tour.slug)}&adults=${adults}&children=${children}&infants=${infants}&guests=${heads}${travelDate ? `&date=${encodeURIComponent(travelDate)}` : ""}${selectedAddOns.length ? `&addons=${selectedAddOns.join(",")}` : ""}`
  const tabs = [{ id: "overview", label: ar ? "نظرة عامة" : "Overview" }, { id: "highlights", label: ar ? "أبرز المعالم" : "Highlights" }, { id: "itinerary", label: ar ? "برنامج الزيارة" : "Itinerary" }, { id: "inclusions", label: ar ? "المشمول" : "Inclusions" }, { id: "add-ons", label: ar ? "إضافات" : "Add-ons" }, { id: "location", label: ar ? "الموقع" : "Location" }, ...(pricePeriods.length ? [{ id: "prices", label: ar ? "الأسعار" : "Prices" }] : []), { id: "reviews", label: ar ? "التقييمات" : "Reviews" }]
  const shareTour = async () => {
    try {
      if (navigator.share) await navigator.share({ title: tour.title, url: window.location.href })
      else await navigator.clipboard.writeText(window.location.href)
    } catch { /* Share can be dismissed without changing the page. */ }
  }

  return <>
    <div className="tour-breadcrumb day-tour-breadcrumb container"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link><span>/</span><Link href="/egypt-tours/one-day-tours">{ar ? 'رحلات اليوم الواحد' : 'One Day Tours'}</Link>{region && <><span>/</span><Link href={regionHref}>{regionName}</Link></>}<span>/</span><span>{tour.title}</span></div>
    <main className="tour-detail-page day-tour-detail container">
      <header className="tour-detail-header"><div><span className="eyebrow">{ar ? 'تجربة مصرية في يوم واحد' : 'One day Egypt experience'}</span><h1>{tour.title}</h1></div><button type="button" className={`tour-favorite ${favorite ? "active" : ""}`} onClick={() => setFavorite(!favorite)} aria-label={ar ? 'احفظ الرحلة' : 'Save tour'} aria-pressed={favorite}><Heart size={20} fill={favorite ? "currentColor" : "none"} /></button></header>
      <div className="tour-detail-layout">
        <div className="tour-detail-main">
          <div className="tour-gallery">
            <div className="tour-gallery-main"><Image src={gallery[selectedImage].src} alt={gallery[selectedImage].alt} fill priority sizes="(max-width: 900px) 100vw, 65vw" />{gallery.length > 1 && <><button type="button" className="gallery-arrow left" aria-label={ar ? 'الصورة السابقة' : 'Previous image'} onClick={() => setSelectedImage((selectedImage + gallery.length - 1) % gallery.length)}>‹</button><button type="button" className="gallery-arrow right" aria-label={ar ? 'الصورة التالية' : 'Next image'} onClick={() => setSelectedImage((selectedImage + 1) % gallery.length)}>›</button></>}</div>
            {gallery.length > 1 && <div className="tour-thumbs">{gallery.map((image, index) => <button type="button" key={image.src} className={selectedImage === index ? "active" : ""} aria-label={ar ? `عرض الصورة ${index + 1}` : `Show image ${index + 1}: ${image.alt}`} aria-pressed={selectedImage === index} onClick={() => setSelectedImage(index)}><Image src={image.src} alt="" fill sizes="80px" /></button>)}</div>}
            <p className="day-tour-gallery-note">{ar ? 'صور توضيحية للوجهة؛ تُحدد محطات الزيارة المؤكدة قبل الحجز.' : 'Destination imagery; the confirmed visit stops are agreed before booking.'}</p>
          </div>
          <div className="tour-facts"><span><Clock3 size={18} /><b>{ar ? 'المدة' : 'Duration'}</b>{durationName}</span><span><MapPin size={18} /><b>{ar ? 'المنطقة' : 'Area'}</b>{locationName}</span><span><Users size={18} /><b>{ar ? 'حجم المجموعة' : 'Group size'}</b>{tour.groupSize ?? (ar ? 'حسب الطلب' : 'On request')}</span><span><ShieldCheck size={18} /><b>{ar ? 'نمط الرحلة' : 'Travel style'}</b>{tour.travelStyle ?? (ar ? 'مخصص' : 'Tailored')}</span></div>
          <nav className="tour-tabs" aria-label={ar ? "أقسام الرحلة" : "Tour sections"}>{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => { setActiveTab(tab.id); document.getElementById(tab.id)?.scrollIntoView({ behavior: "smooth" }) }}>{tab.label}</button>)}</nav>

          <section id="overview" className="tour-content-section"><h2>{ar ? 'نظرة عامة' : 'Overview'}</h2><div className="overview-grid"><div><small>{ar ? 'المدة' : 'Duration'}</small><b>{durationName}</b></div><div><small>{ar ? 'نوع الرحلة' : 'Tour type'}</small><b>{ar ? 'رحلة يومية خاصة' : 'Private day tour'}</b></div></div>{(detail?.overview ?? [tour.summary, ar ? 'خط سير الزيارة ونقطة المقابلة والمواعيد والمشمول تُؤكد مع فريقنا قبل الحجز.' : 'The visit route, meeting point, timings, and inclusions are confirmed with our team before booking.']).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>

          <section id="highlights" className="tour-content-section"><h2>{ar ? 'أبرز المعالم' : 'Highlights'}</h2><div className="highlight-card"><Image src={detail?.highlightImage ?? gallery[0].src} alt={gallery[0].alt} fill sizes="(max-width: 700px) 100vw, 260px" /><div><h3>{ar ? `${locationName} بوتيرتك الخاصة` : `${tour.location}, at your pace`}</h3><p>{tour.summary}</p></div></div>{detail?.highlights?.length ? <ul className="day-tour-highlight-list">{detail.highlights.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul> : <p>{ar ? 'استفسر من فريقنا عن المحطات والتجارب الممكنة في مدة هذه الرحلة. سنؤكدها مع برنامجك المقترح.' : 'Ask our team which stops and experiences can fit the duration of this tour. We will confirm them with your proposed itinerary.'}</p>}</section>

          <section id="itinerary" className="tour-content-section"><h2>{ar ? 'برنامج الزيارة' : 'Visit itinerary'}</h2><p className="tour-itinerary-note"><ShieldCheck size={17} />{detail?.itineraryNote ?? (ar ? 'خط سير مقترح فقط. المحطات والترتيب والتوقيت تُؤكد مع عرض السعر.' : 'Suggested flow only. Exact stops, sequence, and timing are confirmed with your quote.')}</p>{detail?.stops?.length ? <div className="itinerary-list">{detail.stops.map((stop, index) => { const open = openStop === index; return <article key={`${stop.title}-${index}`} className={open ? "open" : "closed"}><span className="day-dot" /><div className="day-board"><button type="button" className="day-toggle" aria-expanded={open} onClick={() => setOpenStop(open ? -1 : index)}><span className="day-pill">{ar ? `محطة ${index + 1}` : `Stop ${index + 1}`}</span><span className="day-title">{stop.title}</span><ChevronDown size={17} /></button>{open && <div className="day-body">{stop.image&&<Image src={stop.image} alt={stop.title} width={300} height={240} className="day-thumb"/>}<div><p>{stop.description}</p>{stop.meals&&<p className="tour-day-meals"><b>{ar ? 'الوجبات:' : 'Meals:'}</b> {stop.meals}</p>}</div></div>}</div></article> })}</div> : <div className="day-tour-route-request"><p>{ar ? 'لا يوجد برنامج مفصل منشور لهذه الرحلة بعد. سنرسل خط السير المقترح لتاريخك المفضل قبل الحجز.' : 'No fixed stop-by-stop itinerary has been published for this tour yet. We will send the proposed route for your preferred date before you commit.'}</p><Link href={planHref} className="text-link">{ar ? 'اطلب برنامج الزيارة' : 'Request the visit plan'} <ArrowRight size={16} /></Link></div>}</section>

          <section id="inclusions" className="tour-content-section"><h2>{ar ? 'ما الذي يشمله السعر؟' : "What's Included?"}</h2><ul className="check-list">{included.map((item) => <li key={item}><Check size={16} />{item}</li>)}</ul><h2 className="excluded-heading">{ar ? 'ما الذي لا يشمله السعر؟' : "What's Excluded?"}</h2><ul className="excluded-list">{excluded.map((item) => <li key={item}><Minus size={16} />{item}</li>)}</ul><p className="day-tour-terms-note">{ar ? 'الخدمات والاستثناءات الدقيقة لتاريخك المختار تُذكر في عرض السعر قبل الحجز.' : 'Exact services and exclusions for your chosen date are itemized in the quote before booking.'}</p></section>

          <section id="add-ons" className="tour-content-section"><div className="section-title-row"><h2>{ar ? 'إضافات' : 'Add-ons'}</h2><span className="muted">{ar ? 'صمم اليوم وفق ذوقك' : 'Shape the day around you'}</span></div><div className="addon-list">{addOns.map((item, index) => <label key={item.title}><input type="checkbox" checked={selectedAddOns.includes(index)} onChange={() => setSelectedAddOns((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index])} /><span>{item.title}</span><b>{item.price === undefined ? (ar ? 'السعر حسب الطلب' : 'Price on request') : formatPrice(item.price, currency, locale)}</b></label>)}</div><p className="day-tour-terms-note">{ar ? 'التجارب الاختيارية وأسعارها تُؤكد مع التوافر في عرض السعر.' : 'Optional experiences and their prices are confirmed with availability in your quote.'}</p></section>

          <section id="location" className="tour-content-section"><h2>{ar ? 'الموقع' : 'Location'}</h2><TourLocationMap locations={locations} locale={locale} /></section>

          {pricePeriods.length>0&&<section id="prices" className="tour-price-breakdown"><h2><span className="price-breakdown-icon">✦</span>{ar ? 'أسعار الرحلة' : 'Tour Prices'}</h2><div className="price-cards-grid">{pricePeriods.map((row,index)=><div key={`${row.category}-${index}`} className="price-season-card"><div className="price-season-header"><CalendarDays size={16}/><div><b>{row.category}</b>{(row.startDate||row.endDate)&&<small>{formatTourDateRange(row.startDate,row.endDate,locale)}</small>}</div></div><div className="price-season-body">{row.tiers?.length ? row.tiers.map((tier)=><div key={tier.label} className="price-tier"><span>{tier.label}</span><strong>{row.prefix}{formatPrice(tier.price,currency,locale)} {tier.suffix&&<small>{tier.suffix}</small>}</strong></div>) : <div className="price-tier"><span>{row.note || (ar ? 'للفرد' : 'Per person')}</span><strong>{row.prefix}{formatPrice(row.price,currency,locale)}</strong></div>}</div></div>)}</div></section>}

          <section id="reviews" className="tour-content-section tour-reviews-section"><h2>{ar ? 'التقييمات' : 'Reviews'}</h2><TourReviewsSection tourSlug={tour.slug} tourTitle={tour.title} locale={locale} copy={ar ? { heading: 'اكتب تقييمك', forTour: 'تقييم رحلة', title: 'التقييمات', summaryReviews: 'تقييمات', beFirst: 'كن أول من يقيّم هذه الرحلة', justNow: 'الآن', more: 'اقرأ المزيد', less: 'عرض أقل', name: 'اسمك', namePh: 'مثال: أحمد م.', platform: 'المنصة', rating: 'التقييم', review: 'تقييمك', reviewPh: 'حدثنا عن رحلتك...', cancel: 'إلغاء', submit: 'إرسال التقييم' } : { heading: 'Write a review', forTour: 'Reviewing', title: 'Reviews', summaryReviews: 'reviews', beFirst: 'Be the first to review this trip', justNow: 'Just now', more: 'Read more', less: 'Show less', name: 'Your name', namePh: 'e.g. Alex M.', platform: 'Platform', rating: 'Rating', review: 'Your review', reviewPh: 'Tell us about your trip...', cancel: 'Cancel', submit: 'Submit review' }} /></section>

          <TourVideoGallery videos={tour.journeyVideos} posters={gallery.map((item) => item.src)} locale={locale} tourTitle={tour.title} />

          {related.length > 0 && <section className="tour-content-section"><div className="section-title-row"><h2>{ar ? 'رحلات ذات صلة' : 'Related Tours'}</h2><Link href={regionHref} className="text-link">{ar ? 'شاهد الكل' : 'View all'} <ArrowRight size={16} /></Link></div><HorizontalSlider className="related-tours" ariaLabel={ar ? 'رحلات ذات صلة' : 'Related Tours'} previousLabel={ar ? 'الرحلات السابقة' : 'Previous tours'} nextLabel={ar ? 'الرحلات التالية' : 'Next tours'} autoAdvanceMs={5000}>{related.map((item) => <Link key={item.slug} href={`/egypt-tours/${item.slug}`}><Image src={regionGalleries[item.location]?.[0]?.src ?? item.image} alt={`${item.location} travel scene`} width={260} height={150} /><b>{item.title}</b><span>{ar ? 'يبدأ من' : 'From'} {formatPrice(item.price, currency, locale)}</span></Link>)}</HorizontalSlider></section>}
        </div>

        <aside className="tour-booking-card" aria-label={ar ? 'خطط لرحلة اليوم' : 'Plan this day tour'}><div className="booking-top"><div><small>{ar ? 'يبدأ من' : 'From'}</small><strong>{formatPrice(tour.price, currency, locale)}</strong><span>{ar ? 'للشخص' : 'per person'}</span></div></div><div className="booking-divider" /><label><CalendarDays size={17} />{ar ? 'اختر التاريخ' : 'Choose your date'}<input type="date" value={travelDate} onChange={(event) => setTravelDate(event.target.value)} /></label><div className="guest-rows">{([['adults', adults, setAdults, ar ? 'بالغون' : 'Adults', ar ? '12 سنة فأكثر' : 'Ages 12+', 1], ['children', children, setChildren, ar ? 'أطفال' : 'Children', ar ? '3 - 11 سنة' : 'Ages 3-11', 0], ['infants', infants, setInfants, ar ? 'رضّع' : 'Infants', ar ? 'أقل من 3 سنوات' : 'Under 3', 0]] as const).map(([key, value, set, label, ages, min]) => <div key={key} className="guest-row"><span><Users size={15}/><b>{label}</b><small>{ages}</small></span><div><button type="button" aria-label={label} disabled={value <= min} onClick={() => set(Math.max(min, value - 1))}><Minus size={14}/></button><b aria-live="polite">{value}</b><button type="button" aria-label={label} disabled={value >= 50} onClick={() => set(Math.min(50, value + 1))}><Plus size={14}/></button></div></div>)}</div><div className="booking-total"><span>{ar ? 'الإجمالي التقديري' : 'Estimated total'}{hasUnpricedAddOns ? (ar ? ' + إضافات حسب الطلب' : ' + add-ons on request') : ''}</span><strong>{formatPrice(pricing.total + selectedAddOnTotal, currency, locale)}</strong></div><button type="button" className="primary-btn booking-cta" onClick={() => { addToCart({ tourSlug: tour.slug, title: tour.title, image: gallery[0].src, date: travelDate, adults, children, infants, addons: selectedAddOns.map((i) => addOns[i]?.title ?? ''), addonTotal: selectedAddOnTotal, adultUnit: pricing.adult, childUnit: pricing.child, infantUnit: pricing.infant, total: pricing.total + selectedAddOnTotal }); router.push('/cart') }}>{ar ? 'احجز الآن' : 'Book now'} <ArrowRight size={17} /></button><div className="booking-side-row"><button type="button" className="outline-btn booking-half" onClick={shareTour}><Share2 size={16} /> {ar ? 'مشاركة' : 'Share'}</button><button type="button" className="outline-btn booking-half" onClick={() => setFavorite(!favorite)} aria-pressed={favorite}><Heart size={16} fill={favorite ? "#f7951d" : "none"} /> {favorite ? (ar ? 'محفوظ' : 'Saved') : (ar ? 'المفضلة' : 'Favorites')}</button></div><AskQuestionButton tourSlug={tour.slug} tourTitle={tour.title} label={ar ? 'اسألنا' : 'Ask a question'} /><small className="booking-note"><ShieldCheck size={14} /> {ar ? 'السعر النهائي وخط السير والشروط تُؤكد قبل الحجز.' : 'Final price, route, and terms are confirmed before booking.'}</small></aside>
      </div>
    </main>
  </>
}
