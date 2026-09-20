"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowRight, CalendarDays, Check, ChevronDown, Clock3, Heart, MapPin, Minus, Plus, Share2, ShieldCheck, Star, Users } from "lucide-react"
import { getToursByCategory } from "@/data/tours"
import type { Tour } from "@/data/types"
import { useLocale, formatPrice } from "./locale"

function Accordion({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) { return <details className="tour-accordion" open={open}><summary>{title}<ChevronDown size={17}/></summary><div>{children}</div></details> }

export function TourDetailPage({ tour }: { tour: Tour }) {
  const detail = tour.detail
  const gallery = tour.gallery ?? [tour.image]
  const relatedTours = getToursByCategory(tour.category).filter((item) => item.slug !== tour.slug).slice(0, 4)
  const tabs = detail ? ["Overview","Highlights","Itinerary","Inclusions","Add-ons","Location","Reviews"] : ["Overview"]
  const reviewAverage = detail?.reviews.length ? detail.reviews.reduce((sum, review) => sum + review.stars, 0) / detail.reviews.length : null
  const [selectedImage, setSelectedImage] = useState(0)
  const [guests, setGuests] = useState(2)
  const [favorite, setFavorite] = useState(false)
  const [activeTab, setActiveTab] = useState("Overview")
  const [travelDate, setTravelDate] = useState("")
  const { currency, locale } = useLocale()
  const [selectedAddons, setSelectedAddons] = useState<number[]>([])
  const toggleAddon = (index: number) => setSelectedAddons((prev) => (prev.includes(index) ? prev.filter((x) => x !== index) : [...prev, index]))
  const [expandAll, setExpandAll] = useState<boolean | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(detail?.itinerary[0]?.day ?? null)
  const shareTour = async () => { const url = window.location.href; try { if (navigator.share) { await navigator.share({ title: tour.title, url }) } else { await navigator.clipboard.writeText(url) } } catch { /* dismissed */ } }
  const price = tour.price
  const addonsTotal = selectedAddons.reduce((sum, index) => sum + (detail?.addOns[index]?.price ?? 0), 0)
  const total = price * guests + addonsTotal
  const downloadItinerary = () => {
    if (!detail) return
    const text = [`${tour.title}`, `Duration: ${tour.duration}`, `Price: ${formatPrice(price, currency, locale)} per person`, "", "ITINERARY", ...detail.itinerary.map((item) => `${item.day}: ${item.title}\n${item.description}`), "", "INCLUDED", ...detail.included, "", "BOOK", "https://starpyramids.com/make-your-trip"].join("\n\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `itinerary-${tour.slug}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return <>
    <div className="tour-breadcrumb container"><Link href="/">Home</Link><span>/</span><Link href={`/egypt-tours/${tour.category}`}>Egypt Tours</Link><span>/</span><span>{tour.title}</span></div>
    <main className="tour-detail-page container">
      <header className="tour-detail-header"><div><span className="eyebrow">Egypt travel experience</span><h1>{tour.title}</h1>{reviewAverage!==null&&<div className="tour-rating"><Star size={16} fill="currentColor"/> {reviewAverage.toFixed(1)} <span>Guest reviews</span></div>}</div><button className={`tour-favorite ${favorite ? "active" : ""}`} onClick={()=>setFavorite(!favorite)} aria-label="Save tour"><Heart size={20} fill={favorite ? "currentColor" : "none"}/></button></header>
      <div className="tour-detail-layout">
        <section className="tour-detail-main">
          <div className="tour-gallery"><div className="tour-gallery-main"><Image src={gallery[selectedImage]} alt={tour.title} fill priority sizes="(max-width: 900px) 100vw, 65vw"/>{gallery.length>1&&<><button aria-label="Previous image" className="gallery-arrow left" onClick={()=>setSelectedImage((selectedImage + gallery.length - 1) % gallery.length)}>‹</button><button aria-label="Next image" className="gallery-arrow right" onClick={()=>setSelectedImage((selectedImage + 1) % gallery.length)}>›</button></>}</div>{gallery.length>1&&<div className="tour-thumbs">{gallery.map((image,index)=><button key={image} className={selectedImage===index ? "active" : ""} onClick={()=>setSelectedImage(index)}><Image src={image} alt={`${tour.title} image ${index+1}`} fill sizes="90px"/></button>)}</div>}</div>
          <div className="tour-facts"><span><Clock3 size={18}/><b>Duration</b> {tour.duration}</span><span><MapPin size={18}/><b>Destinations</b> {tour.location}</span><span><Users size={18}/><b>Group size</b> {tour.groupSize??'On request'}</span><span><ShieldCheck size={18}/><b>Travel style</b> {tour.travelStyle??'Tailored'}</span></div>
          {tabs.length>1&&<nav className="tour-tabs" aria-label="Tour sections">{tabs.map(tab=><button key={tab} className={activeTab===tab ? "active" : ""} onClick={()=>{setActiveTab(tab); document.getElementById(tab.toLowerCase())?.scrollIntoView({behavior:"smooth"})}}>{tab}</button>)}</nav>}
          <section id="overview" className="tour-content-section"><h2>Overview</h2><div className="overview-grid"><div><small>Duration</small><b>{tour.duration}</b></div><div><small>Tour type</small><b>{tour.travelStyle??'Tailored experience'}</b></div></div>{detail?detail.overview.map(paragraph=><p key={paragraph}>{paragraph}</p>):<><p>{tour.summary}</p><p><strong>The full day-by-day itinerary and exact inclusions are available on request.</strong></p></>}</section>
          {detail&&<>
          <section id="highlights" className="tour-content-section"><div className="section-title-row"><h2>Highlights</h2><span className="section-actions"><Link href="/destinations" className="text-link">View Destinations</Link><button type="button" className="link-btn" onClick={() => setExpandAll((v) => (v === true ? false : true))}>{expandAll === true ? 'Collapse all' : 'Expand all'}</button></span></div><div className="highlight-card"><Image src={gallery[Math.min(2,gallery.length-1)]} alt="Egyptian temple" fill sizes="(max-width: 700px) 100vw, 260px"/><div><h3>See Egypt&apos;s timeless icons</h3><p>Walk beneath ancient columns, stand before the Sphinx, and watch the sun set over the Nile.</p></div></div><div key={'hl' + String(expandAll)}>{detail.highlights.map((group,gi) => <Accordion key={group.title} title={group.title} open={expandAll === null ? gi === 0 : expandAll}><ul>{group.items.map(item => <li key={item}><Check size={15}/>{item}</li>)}</ul></Accordion>)}</div></section>
          <section id="itinerary" className="tour-content-section"><div className="section-title-row"><h2>Itinerary</h2><button type="button" className="outline-btn" onClick={downloadItinerary}>Download itinerary</button></div><div className="itinerary-list">{detail.itinerary.map((item,index)=>{const open=openDay===item.day; return <article key={item.day} className={open?'open':'closed'}><span className="day-dot"/><div className="day-board"><button type="button" className="day-toggle" onClick={()=>setOpenDay(open?null:item.day)} aria-expanded={open}><span className="day-pill">{item.day}</span><span className="day-title">{item.title}</span><ChevronDown size={17}/></button><div className="day-body"><Image src={gallery[index%gallery.length]} alt={item.title} width={300} height={240} className="day-thumb"/><div><p>{item.description}</p></div></div></div></article>;})}</div></section>
          <section id="inclusions" className="tour-content-section"><h2>What&apos;s Included?</h2><ul className="check-list">{detail.included.map(item=><li key={item}><Check size={16}/>{item}</li>)}</ul><h2 className="excluded-heading">What&apos;s Excluded?</h2><ul className="excluded-list">{detail.excluded.map(item=><li key={item}><Minus size={16}/>{item}</li>)}</ul></section>
          <section id="add-ons" className="tour-content-section"><div className="section-title-row"><h2>Add-ons</h2><span className="muted">Make your journey your own</span></div><div className="addon-list">{detail.addOns.map((item,index)=><label key={item.title}><input type="checkbox" checked={selectedAddons.includes(index)} onChange={()=>toggleAddon(index)}/> <span>{item.title}</span><b>{formatPrice(item.price, currency, locale)}</b></label>)}</div></section>
          <section id="location" className="tour-content-section"><h2>Location</h2><iframe title="Tour locations map" src={`https://maps.google.com/maps?q=${encodeURIComponent(detail.locations.join(' '))}%20Egypt&t=&z=6&ie=UTF8&iwloc=&output=embed`} loading="lazy" className="location-map"/><div className="location-stops">{detail.locations.map(stop => <span key={stop}><MapPin size={15}/>{stop}</span>)}</div></section>
          <section id="reviews" className="tour-content-section"><div className="section-title-row"><h2>Reviews</h2>{reviewAverage!==null&&<span className="tour-rating"><Star size={16} fill="currentColor"/> {reviewAverage.toFixed(1)} <span>{detail.reviews.length} reviews</span></span>}</div><div className="tour-reviews-grid">{detail.reviews.map(review => <article key={review.name} className="rev-card"><div className="rev-head"><span className="rev-avatar" style={{ background: '#1d4ed8' }}>{review.name[0]}</span><div><b>{review.name}</b><small>{review.date}</small></div></div><div className="rev-card-stars">{[0, 1, 2, 3, 4].map(star => <Star key={star} size={15} fill={star < review.stars ? '#ffc531' : 'none'} color="#ffc531"/>)}{review.stars === 5 && <Check size={15} className="verified"/>}</div><p>{review.text}</p></article>)}</div></section>
          <section className="tour-price-breakdown"><h2>Tour Prices</h2><table className="price-table"><thead><tr><th>Category</th><th>Price</th><th>Note</th></tr></thead><tbody>{detail.priceRows.map(row=><tr key={row.category}><td>{row.category}</td><td>{row.prefix}{formatPrice(row.price,currency,locale)}</td><td>{row.note}</td></tr>)}</tbody></table></section>
          </>}
          {gallery.length>1&&<section className="tour-content-section"><h2>Gallery of Exciting Journeys</h2><div className="journey-gallery">{gallery.slice(1,6).map((image,index)=><div key={image}><Image src={image} alt={`${tour.title} gallery image ${index+2}`} fill sizes="220px"/><span>{index%2===0 ? "▶" : "f"}</span></div>)}</div></section>}
          <section className="tour-content-section"><div className="section-title-row"><h2>Related Tours</h2><Link href={`/egypt-tours/${tour.category}`} className="text-link">View all <ArrowRight size={16}/></Link></div><div className="related-tours">{relatedTours.map(item=><Link key={item.slug} href={`/egypt-tours/${item.slug}`}><Image src={item.image} alt={item.title} width={260} height={150}/><b>{item.title}</b><span>From {formatPrice(item.price, currency, locale)}</span></Link>)}</div></section>
        </section>
        <aside className="tour-booking-card"><div className="booking-top"><div><small>From</small><strong>{formatPrice(price, currency, locale)}</strong><span>per person</span></div>{reviewAverage!==null&&<span className="booking-rating"><Star size={14} fill="currentColor"/> {reviewAverage.toFixed(1)}</span>}</div><div className="booking-divider"/><label><CalendarDays size={17}/>Choose your date<input type="date" value={travelDate} onChange={(e)=>setTravelDate(e.target.value)}/></label><div className="guest-picker"><span><Users size={17}/> Travelers</span><div><button onClick={()=>setGuests(Math.max(1,guests-1))}><Minus size={14}/></button><b>{guests}</b><button onClick={()=>setGuests(guests+1)}><Plus size={14}/></button></div></div><div className="booking-total"><span>Total{selectedAddons.length?` (incl. ${selectedAddons.length} add-on${selectedAddons.length===1?'':'s'})`:''}</span><strong>{formatPrice(total, currency, locale)}</strong></div><Link href={`/make-your-trip?tour=${encodeURIComponent(tour.slug)}&guests=${guests}${travelDate?`&date=${encodeURIComponent(travelDate)}`:''}`} className="primary-btn booking-cta">Book now <ArrowRight size={17}/></Link><div className="booking-side-row"><button type="button" className="outline-btn booking-half" onClick={shareTour} aria-label="Share this tour"><Share2 size={16}/> Share</button><button type="button" className="outline-btn booking-half" onClick={() => setFavorite(!favorite)} aria-pressed={favorite} aria-label="Save to favorites"><Heart size={16} fill={favorite ? "#f7951d" : "none"} color={favorite ? "#f7951d" : "currentColor"}/> {favorite ? 'Saved' : 'Favorites'}</button></div><Link href="/contact" className="outline-btn booking-question">Ask a question</Link><small className="booking-note"><ShieldCheck size={14}/> Free cancellation up to 24 hours before departure</small></aside>
      </div>
    </main>
  </>
}
