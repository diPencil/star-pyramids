'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import type { ReviewPlatform, TourReview } from '@/data/types'

export type { ReviewPlatform }

export type SiteReview = {
  name: string
  date: string
  color: string
  platform: ReviewPlatform
  stars: number
  text: string
  tourSlugs?: readonly string[]
}

export type StoredReview = {
  name: string
  date: string
  stars: number
  text: string
  platform: ReviewPlatform
}

export type ReviewInput = {
  name: string
  stars: number
  text: string
  platform: ReviewPlatform
}

const NILE_CRUISES = ['luxury-nile-cruise', 'aswan-to-luxor-cruise', 'luxor-to-aswan-cruise', 'premium-dahabiya-experience', 'nile-discovery-cruise', 'classic-5-day-nile-journey'] as const

export const siteReviews: readonly SiteReview[] = [
  { name: 'Irene Lotti', date: '12 September 2026', color: '#1d4ed8', platform: 'google', stars: 5, text: 'We booked several excursions through Star Pyramids Tours, and I must say they were unforgettable experiences. Everything was perfectly organized from start to finish.' },
  { name: 'Todd D', date: '11 September 2026', color: '#f7951d', platform: 'tripadvisor', stars: 5, text: '5 days in Cairo. Ayman my host was incredibly knowledgeable and helpful. We had some wonderful in depth discussions about ancient Egypt.', tourSlugs: ['5-days-cairo-luxor'] },
  { name: 'Pita Tipene', date: '10 September 2026', color: '#0d2250', platform: 'google', stars: 5, text: 'Our guide Osama was exceptional throughout our journey today and went over and beyond to make sure we were comfortable and amazed.' },
  { name: 'Eusebio Mur', date: '9 September 2026', color: '#b8860b', platform: 'google', stars: 5, text: 'An incredible experience in southern Egypt with our guide Ahmed. Fluent in Spanish, knowledgeable about the area, and above all, honest and kind.' },
  { name: 'Megan R.', date: '28 August 2026', color: '#1d4ed8', platform: 'tripadvisor', stars: 5, text: 'Our guide made Cairo feel easy and exciting. Every detail was beautifully handled.', tourSlugs: ['cairo-highlights-day-tour'] },
  { name: 'Jonas P.', date: '28 August 2026', color: '#f7951d', platform: 'getyourguide', stars: 5, text: 'Perfect day at Giza. Skip-the-line access really saved us hours in the heat. Highly recommended.', tourSlugs: ['giza-pyramids-sphinx-tour'] },
  { name: 'Daniel K.', date: '22 August 2026', color: '#1d4ed8', platform: 'tripadvisor', stars: 5, text: 'The Nile cruise and Luxor days were unforgettable. We would book again.', tourSlugs: [...NILE_CRUISES] },
  { name: 'Karim H.', date: '20 August 2026', color: '#0d2250', platform: 'trustindex', stars: 3, text: 'Good guides and a lovely route, but the pickup was 40 minutes late. The tour itself was enjoyable.' },
  { name: 'Emily W.', date: '15 August 2026', color: '#b8860b', platform: 'getyourguide', stars: 4, text: 'Beautiful Nile dinner cruise with lovely food and show. Boarding took a while but the evening made up for it.' },
  { name: 'Sarah T.', date: '9 August 2026', color: '#f7951d', platform: 'tripadvisor', stars: 5, text: 'Friendly team, great communication, and the best local recommendations.' },
  { name: 'Lena F.', date: '5 August 2026', color: '#1d4ed8', platform: 'trustindex', stars: 2, text: 'The itinerary changed last minute and communication could be better. Still, Luxor itself was amazing.', tourSlugs: ['luxor-east-west-bank', 'valley-of-the-kings-day-tour'] },
  { name: 'Omar A.', date: '1 August 2026', color: '#0d2250', platform: 'tripadvisor', stars: 5, text: 'A smooth family trip from airport pickup to our final evening.' },
]

export const reviewPlatforms = [
  { id: 'all', label: 'All reviews', avg: '4.7' },
  { id: 'google', label: 'Google', avg: '4.6' },
  { id: 'tripadvisor', label: 'Tripadvisor', avg: '4.9' },
  { id: 'trustindex', label: 'Trustindex', avg: '2.6' },
  { id: 'getyourguide', label: 'Getyourguide', avg: '4.5' },
] as const

export const platformSummary: Record<string, { avg: string; count: string }> = {
  all: { avg: '4.7', count: '5,308 reviews' },
  google: { avg: '4.6', count: '2,140 reviews' },
  tripadvisor: { avg: '4.9', count: '1,820 reviews' },
  trustindex: { avg: '2.6', count: '98 reviews' },
  getyourguide: { avg: '4.5', count: '1,250 reviews' },
}

const AVATAR_COLORS = ['#1d4ed8', '#f7951d', '#0d2250', '#b8860b', '#00aa6c'] as const

export const avatarColor = (name: string) => {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export const toSiteReview = (r: StoredReview): SiteReview => ({ ...r, color: avatarColor(r.name) })

export function PlatformIcon({ id }: { id: string }) {
  if (id === 'google') return <span className="platform-ic" aria-label="Google"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.6z" /><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-3.7 2.9C3.5 21.3 7.5 24 12 24z" /><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.7-2.9C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.9l3.8 2.9c1-2.9 3.7-5.1 6.8-5.1z" /></svg></span>
  if (id === 'tripadvisor') return <span className="platform-ic" aria-label="Tripadvisor"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00aa6c" /><circle cx="8.4" cy="11" r="3" fill="#fff" /><circle cx="15.6" cy="11" r="3" fill="#fff" /><circle cx="8.4" cy="11" r="1.3" fill="#00aa6c" /><circle cx="15.6" cy="11" r="1.3" fill="#00aa6c" /><path d="M8 16.6c1.1 1 2.5 1.5 4 1.5s2.9-.5 4-1.5" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg></span>
  if (id === 'trustindex') return <span className="platform-ic" aria-label="Trustindex"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00b67a" /><path d="M8 12.5l2.7 2.7L16 9.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
  if (id === 'getyourguide') return <span className="platform-ic" aria-label="Getyourguide"><svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#ff5533" /><text x="12" y="17.5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="Arial,sans-serif">G</text></svg></span>
  return null
}

export function StarsRow({ stars, size = 16 }: { stars: number; size?: number }) {
  return <span className="rev-stars">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={size} fill={s < stars ? '#ffc531' : 'none'} color="#ffc531" />)}</span>
}

// Backend integration point: user reviews will POST to /api/reviews
// ({ tourSlug | null, name, stars, text, platform }). Until then reviews
// persist in this browser only.
const SITE_KEY = 'sp-site-reviews'
const tourKey = (slug: string) => `sp-tour-reviews:${slug}`

function readList(key: string): StoredReview[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredReview[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((r) => r && typeof r.name === 'string' && typeof r.text === 'string' && Number.isFinite(r.stars))
      .slice(0, 50)
      .map((r) => ({ name: r.name.slice(0, 60), date: typeof r.date === 'string' ? r.date : 'Just now', stars: Math.min(5, Math.max(1, Math.round(r.stars))), text: r.text.slice(0, 1000), platform: r.platform ?? 'direct' }))
  } catch { return [] }
}

function writeList(key: string, list: StoredReview[]) {
  try { localStorage.setItem(key, JSON.stringify(list.slice(0, 50))) } catch { /* private mode */ }
}

export const loadUserReviews = (): StoredReview[] => (typeof window === 'undefined' ? [] : readList(SITE_KEY))
export const saveUserReview = (review: StoredReview) => writeList(SITE_KEY, [review, ...readList(SITE_KEY)])
export const loadTourReviews = (slug: string): StoredReview[] => (typeof window === 'undefined' ? [] : readList(tourKey(slug)))
export const saveTourReview = (slug: string, review: StoredReview) => writeList(tourKey(slug), [review, ...readList(tourKey(slug))])

export const getReviewsForTour = (slug: string): SiteReview[] => {
  const tagged = siteReviews.filter((r) => r.tourSlugs?.includes(slug))
  return tagged.length ? [...tagged] : siteReviews.slice(0, 4).map((r) => ({ ...r }))
}

export const averageStars = (stars: readonly number[]): number | null =>
  stars.length ? stars.reduce((sum, s) => sum + s, 0) / stars.length : null

export type ReviewModalCopy = {
  heading: string
  forTour?: string
  context?: string
  name: string
  namePh: string
  platform: string
  rating: string
  review: string
  reviewPh: string
  cancel: string
  submit: string
}

export function ReviewWriteModal({ copy, defaultPlatform = 'google', onSubmit, onClose }: {
  copy: ReviewModalCopy
  defaultPlatform?: ReviewPlatform
  onSubmit: (input: ReviewInput) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [stars, setStars] = useState(5)
  const [platform, setPlatform] = useState<ReviewPlatform>(defaultPlatform)
  const submit = () => {
    if (!name.trim() || !text.trim()) return
    onSubmit({ name: name.trim().slice(0, 60), stars, text: text.trim().slice(0, 1000), platform })
  }
  return <div className="rev-modal" onClick={onClose}>
    <div className="rev-modal-card" role="dialog" aria-modal="true" aria-label={copy.heading} onClick={(e) => e.stopPropagation()}>
      <h3>{copy.heading}</h3>
      {copy.context && <p className="rev-modal-context">{copy.context}</p>}
      <div className="rev-form">
        <label>{copy.name}<input value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.namePh} maxLength={60} /></label>
        <label>{copy.platform}<select value={platform} onChange={(e) => setPlatform(e.target.value as ReviewPlatform)}><option value="google">Google</option><option value="tripadvisor">Tripadvisor</option><option value="trustindex">Trustindex</option><option value="getyourguide">Getyourguide</option></select></label>
        <label>{copy.rating}<span className="rev-star-pick">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} stars`} aria-pressed={stars === n}><Star size={24} fill={n <= stars ? '#ffc531' : 'none'} color="#ffc531" /></button>)}</span></label>
        <label>{copy.review}<textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={copy.reviewPh} maxLength={1000} /></label>
        <div className="rev-form-actions"><button type="button" className="outline-btn" onClick={onClose}>{copy.cancel}</button><button type="button" className="primary-btn" onClick={submit}>{copy.submit}</button></div>
      </div>
    </div>
  </div>
}

export function TourReviewsSection({ tourSlug, tourTitle, detailReviews, locale, copy }: {
  tourSlug: string
  tourTitle: string
  detailReviews?: readonly TourReview[]
  locale: 'en' | 'ar'
  copy: ReviewModalCopy & { title: string; summaryReviews: string; beFirst: string; justNow: string; more: string; less: string }
}) {
  const [platform, setPlatform] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [userReviews, setUserReviews] = useState<StoredReview[]>(() => loadTourReviews(tourSlug))
  const [expanded, setExpanded] = useState<string | null>(null)
  const detailMapped: SiteReview[] = (detailReviews ?? []).map((r) => ({
    name: r.name, date: r.date, color: '#1d4ed8', platform: r.platform ?? 'direct', stars: r.stars, text: r.text,
  }))
  const base = getReviewsForTour(tourSlug)
  const combined: SiteReview[] = [...userReviews.map(toSiteReview), ...detailMapped, ...base]
  const visible = platform === 'all' ? combined : combined.filter((r) => r.platform === platform)
  const avg = averageStars(combined.map((r) => r.stars))
  const submit = (input: ReviewInput) => {
    const stored: StoredReview = { ...input, date: copy.justNow }
    saveTourReview(tourSlug, stored)
    setUserReviews((prev) => [stored, ...prev])
    setShowForm(false)
    setPlatform('all')
  }
  return <>
    <div className="rev-tabs" role="tablist" aria-label={copy.title}>
      {reviewPlatforms.map((p) => <button key={p.id} type="button" role="tab" aria-selected={platform === p.id} className={platform === p.id ? 'active' : ''} onClick={() => setPlatform(p.id)}>{p.id !== 'all' && <PlatformIcon id={p.id} />}<span>{p.id === 'all' ? copy.title : p.label}</span><b>{p.avg}</b></button>)}
    </div>
    <div className="rev-summary">
      {avg !== null ? <><StarsRow stars={Math.round(avg)} size={18} /><b>{avg.toFixed(1)}</b><span className="rev-sep">|</span><span className="rev-count">{combined.length} {copy.summaryReviews}</span></> : <span className="rev-count">{copy.beFirst}</span>}
      <button type="button" className="rev-write" onClick={() => setShowForm(true)}>{copy.heading}</button>
    </div>
    <div className="tour-reviews-grid">
      {visible.map((r, i) => {
        const key = `${r.name}-${i}`
        const open = expanded === key
        return <article key={key} className="rev-card">
          <div className="rev-head"><span className="rev-avatar" style={{ background: r.color }}>{r.name.charAt(0)}</span><div><b>{r.name}</b><small>{r.date}</small></div>{r.platform !== 'direct' && <PlatformIcon id={r.platform} />}</div>
          <div className="rev-card-stars"><StarsRow stars={r.stars} size={15} /></div>
          <p className={open ? '' : r.text.length > 140 ? 'clamped' : ''}>{r.text}</p>
          {r.text.length > 140 && <button type="button" className="rev-more" onClick={() => setExpanded(open ? null : key)}>{open ? copy.less : copy.more}</button>}
        </article>
      })}
    </div>
    {showForm && <ReviewWriteModal copy={{ ...copy, context: copy.forTour ? `${copy.forTour}: ${tourTitle}` : tourTitle }} onSubmit={submit} onClose={() => setShowForm(false)} />}
  </>

}