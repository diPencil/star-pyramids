'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Star, CheckCircle2 } from 'lucide-react'
import type { TourReview } from '@/data/types'
import { useLocale, tx } from '@/components/locale'
import { cn } from '@/lib/utils'

export type ReviewPlatform = 'google' | 'tripadvisor' | 'trustindex' | 'getyourguide' | 'direct'

/** Legacy editorial reviews shown as "site reviews" (not customer submissions). */
export type SiteReview = {
  name: string
  date: string
  color: string
  platform: ReviewPlatform
  stars: number
  text: string
  tourSlugs?: readonly string[]
}

/** Customer review from the database (public API shape). */
export type CustomerReview = {
  publicId: string
  rating: number
  title: string | null
  text: string
  publishedAt: string
  reviewerName: string
}

/** Summary stats for a tour. */
export type ReviewSummary = {
  average: number | null
  count: number
}

/** Input for submitting a new review (API version). */
export type ReviewInput = {
  rating: number
  title: string
  text: string
  platform?: ReviewPlatform
}

/** Legacy review input for localStorage (homepage use only). */
export type LegacyReviewInput = {
  name: string
  stars: number
  text: string
  platform: ReviewPlatform
}

const NILE_CRUISES = [
  'luxury-nile-cruise',
  'aswan-to-luxor-cruise',
  'luxor-to-aswan-cruise',
  'premium-dahabiya-experience',
  'nile-discovery-cruise',
  'classic-5-day-nile-journey',
] as const

/** Hardcoded editorial reviews — clearly labeled as "Editorial reviews" in the UI. */
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

const AVATAR_COLORS = ['#1d4ed8', '#f7951d', '#0d2250', '#b8860b', '#00aa6c'] as const

export const avatarColor = (name: string) => {
  if (!name || typeof name !== 'string' || name.length === 0) {
    return AVATAR_COLORS[0]
  }
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function StarsRow({ stars, size = 16 }: { stars: number; size?: number }) {
  return (
    <span className="rev-stars" aria-label={`${stars} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((s) => (
        <Star key={s} size={size} fill={s < stars ? '#ffc531' : 'none'} color="#ffc531" />
      ))}
    </span>
  )
}

/** Fetch published reviews + summary for a tour from the API. */
async function fetchTourReviews(tourSlug: string): Promise<{ reviews: CustomerReview[]; summary: ReviewSummary }> {
  try {
    const res = await fetch(`/api/reviews?tourSlug=${encodeURIComponent(tourSlug)}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error('Failed to fetch reviews')
    const data = await res.json()
    return { reviews: data.reviews || [], summary: data.summary || { average: null, count: 0 } }
  } catch {
    return { reviews: [], summary: { average: null, count: 0 } }
  }
}

/** Submit a new review via API. */
async function submitReview(tourSlug: string, input: ReviewInput): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ tourSlug, ...input }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Could not submit review.' }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
}

/** Get editorial (site) reviews for a tour. */
export function getSiteReviewsForTour(slug: string): SiteReview[] {
  const tagged = siteReviews.filter((r) => r.tourSlugs?.includes(slug))
  return tagged.length ? [...tagged] : siteReviews.slice(0, 4).map((r) => ({ ...r }))
}

export type ReviewModalCopy = {
  heading: string
  forTour?: string
  context?: string
  reviewTitle: string
  reviewTitlePh: string
  rating: string
  review: string
  reviewPh: string
  cancel: string
  submit: string
  platform?: string
}

export function ReviewWriteModal({
  copy,
  tourSlug,
  tourTitle,
  onSubmit,
  onClose,
}: {
  copy: ReviewModalCopy
  tourSlug?: string
  tourTitle?: string
  onSubmit: (input: ReviewInput) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [stars, setStars] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async () => {
    if (!text.trim() || stars < 1 || stars > 5) return
    setSubmitting(true)
    setError('')
    // If tourSlug provided, submit to API; otherwise just call onSubmit locally
    if (tourSlug) {
      const result = await submitReview(tourSlug, { rating: stars, title: title.trim(), text: text.trim() })
      if (result.success) {
        onSubmit({ rating: stars, title: title.trim(), text: text.trim() })
      } else {
        setError(result.error || 'Could not submit review.')
      }
    } else {
      // Legacy localStorage path for homepage
      onSubmit({ rating: stars, title: title.trim(), text: text.trim(), platform: 'direct' })
    }
    setSubmitting(false)
  }

  if (!mounted) return null

  const modal = (
    <div className="rev-modal" onClick={onClose}>
      <div className="rev-modal-card" role="dialog" aria-modal="true" aria-label={copy.heading} onClick={(e) => e.stopPropagation()}>
        <h3>{copy.heading}</h3>
        {copy.context && <p className="rev-modal-context">{copy.context}</p>}
        <div className="rev-form">
          <label>
            {copy.rating}
            <span className="rev-star-pick" role="radiogroup" aria-label="Select rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  aria-label={`${n} stars`}
                  aria-pressed={stars === n}
                  className={stars === n ? 'active' : ''}
                >
                  <Star size={24} fill={n <= stars ? '#ffc531' : 'none'} color="#ffc531" />
                </button>
              ))}
            </span>
          </label>
          <label>
            {copy.review}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.reviewPh}
              maxLength={5000}
              minLength={10}
              rows={5}
              required
            />
          </label>
          <label>
            {copy.reviewTitle} (optional)
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.reviewTitlePh}
              maxLength={160}
            />
          </label>
          {error && <p className="rev-error" role="alert">{error}</p>}
          <div className="rev-form-actions">
            <button type="button" className="outline-btn" onClick={onClose} disabled={submitting}>
              {copy.cancel}
            </button>
            <button type="button" className="primary-btn" onClick={handleSubmit} disabled={submitting || !text.trim()}>
              {submitting ? 'Submitting...' : copy.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export function TourReviewsSection({
  tourSlug,
  tourTitle,
  detailReviews,
  locale,
  copy,
}: {
  tourSlug: string
  tourTitle: string
  detailReviews?: readonly TourReview[]
  locale: import('@/lib/locale-config').Locale
  copy: ReviewModalCopy & { title: string; summaryReviews: string; beFirst: string; justNow: string; more: string; less: string }
}) {
  const [reviews, setReviews] = useState<CustomerReview[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({ average: null, count: 0 })
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Load reviews on mount
  useEffect(() => {
    let cancelled = false
    fetchTourReviews(tourSlug).then((data) => {
      if (!cancelled) {
        setReviews(data.reviews)
        setSummary(data.summary)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [tourSlug])

  const handleReviewSubmit = (input: ReviewInput) => {
    // Optimistic update
    const newReview: CustomerReview = {
      publicId: `temp-${Date.now()}`,
      rating: input.rating,
      title: input.title || null,
      text: input.text,
      publishedAt: new Date().toISOString(),
      reviewerName: 'You', // Will be replaced by real name after refresh
    }
    setReviews((prev) => [newReview, ...prev])
    setSummary((prev) => {
      const newCount = prev.count + 1
      const newAvg = prev.average === null ? input.rating : (prev.average * prev.count + input.rating) / newCount
      return { average: Math.round(newAvg * 10) / 10, count: newCount }
    })
    setSubmitted(true)
    // Refresh from server after a moment to get real data
    setTimeout(() => {
      fetchTourReviews(tourSlug).then((data) => {
        setReviews(data.reviews)
        setSummary(data.summary)
      })
    }, 1500)
  }

  if (loading) {
    return <p className="rev-loading">{tx(locale, { en: 'Loading reviews…', es: 'Cargando reseñas…', it: 'Caricamento recensioni…', ar: 'جارٍ تحميل التقييمات…' })}</p>
  }

  return (
    <>
      <div className="rev-summary">
        {summary.average !== null ? (
          <>
            <StarsRow stars={Math.round(summary.average)} size={18} />
            <b>{summary.average.toFixed(1)}</b>
            <span className="rev-sep">|</span>
            <span className="rev-count">
              {summary.count} {copy.summaryReviews}
            </span>
          </>
        ) : (
          <span className="rev-count">{tx(locale, { en: 'No reviews yet', es: 'Sin reseñas aún', it: 'Nessuna recensione', ar: 'لا توجد تقييمات بعد' })}</span>
        )}
        <button type="button" className="rev-write" onClick={() => setShowForm(true)}>
          {copy.heading}
        </button>
      </div>

      <div className="tour-reviews-grid">
        {reviews.length === 0 ? (
          <p className="rev-empty">{copy.beFirst}</p>
        ) : (
          reviews.map((r, i) => {
            const key = `${r.publicId}-${i}`
            const open = expanded === key
            const displayName = r.reviewerName || 'Traveler'
            return (
              <article key={key} className="rev-card">
                <div className="rev-head">
                  <span className="rev-avatar" style={{ background: avatarColor(displayName) }}>
                    {displayName.charAt(0)}
                  </span>
                  <div>
                    <b>{displayName}</b>
                    <small>
                      {new Date(r.publishedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </small>
                  </div>
                </div>
                <div className="rev-card-stars">
                  <StarsRow stars={r.rating} size={15} />
                </div>
                {r.title && <h4 className="rev-card-title">{r.title}</h4>}
                <p className={open ? '' : r.text.length > 140 ? 'clamped' : ''}>{r.text}</p>
                {r.text.length > 140 && (
                  <button type="button" className="rev-more" onClick={() => setExpanded(open ? null : key)}>
                    {open ? copy.less : copy.more}
                  </button>
                )}
              </article>
            )
          })
        )}
      </div>

      {showForm && (
        <ReviewWriteModal
          copy={{ ...copy, context: copy.forTour ? `${copy.forTour}: ${tourTitle}` : tourTitle }}
          tourSlug={tourSlug}
          tourTitle={tourTitle}
          onSubmit={handleReviewSubmit}
          onClose={() => setShowForm(false)}
        />
      )}

      {submitted && (
        <div className="rev-success" role="status">
          <CheckCircle2 size={24} /> {tx(locale, { en: 'Review submitted for moderation.', es: 'Reseña enviada para moderación.', it: 'Recensione inviata per moderazione.', ar: 'تم إرسال التقييم للمراجعة.' })}
        </div>
      )}
    </>
  )
}

// ============================================================================
// LEGACY EXPORTS (for homepage.tsx - uses localStorage, not the new API)
// ============================================================================

/** Legacy stored review in localStorage (homepage use only). */
export type StoredReview = {
  name: string
  date: string
  stars: number
  text: string
  platform: ReviewPlatform
}

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

export function PlatformIcon({ id }: { id: string }) {
  if (id === 'google') return <span className="platform-ic" aria-label="Google"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.6z" /><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-3.7 2.9C3.5 21.3 7.5 24 12 24z" /><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.7-2.9C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.9l3.8 2.9c1-2.9 3.7-5.1 6.8-5.1z" /></svg></span>
  if (id === 'tripadvisor') return <span className="platform-ic" aria-label="Tripadvisor"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00aa6c" /><circle cx="8.4" cy="11" r="3" fill="#fff" /><circle cx="15.6" cy="11" r="3" fill="#fff" /><circle cx="8.4" cy="11" r="1.3" fill="#00aa6c" /><circle cx="15.6" cy="11" r="1.3" fill="#00aa6c" /><path d="M8 16.6c1.1 1 2.5 1.5 4 1.5s2.9-.5 4-1.5" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg></span>
  if (id === 'trustindex') return <span className="platform-ic" aria-label="Trustindex"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#00b67a" /><path d="M8 12.5l2.7 2.7L16 9.5" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
  if (id === 'getyourguide') return <span className="platform-ic" aria-label="Getyourguide"><svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#ff5533" /><text x="12" y="17.5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="Arial,sans-serif">G</text></svg></span>
  return null
}

export const toSiteReview = (r: StoredReview): SiteReview => ({ ...r, color: avatarColor(r.name) })