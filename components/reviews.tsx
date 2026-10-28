'use client'
import { BrandMark } from '@/components/brand-mark'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PublicAppearancePortal } from './public-appearance'
import { Star, CheckCircle2 } from 'lucide-react'
import { useLocale, tx } from '@/components/locale'
import { cn } from '@/lib/utils'
import { WEBSITE_REVIEW_SCOPE } from '@/lib/review-scope'
import './reviews-phase6.css'

/** Customer review from the database (public API shape). */
export type CustomerReview = {
  publicId: string
  rating: number
  title: string | null
  text: string
  publishedAt: string
  reviewerName: string
  scope?: 'website' | 'trips'
  trip?: { slug: string; title: string; href: string } | null
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
  platform?: string
}

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
  const { locale } = useLocale()
  return (
    <span className="rev-stars" role="img" aria-label={tx(locale, { en: `${stars} out of 5 stars`, es: `${stars} de 5 estrellas`, it: `${stars} su 5 stelle` })}>
      {[0, 1, 2, 3, 4].map((s) => (
        <Star key={s} size={size} fill={s < stars ? '#ffc531' : 'none'} color="#ffc531" />
      ))}
    </span>
  )
}

/** Fetch published reviews + summary for a tour from the API. */
async function fetchTourReviews(tourSlug: string, page = 1): Promise<{ reviews: CustomerReview[]; summary: ReviewSummary; totalPages: number }> {
    const res = await fetch(`/api/reviews?tourSlug=${encodeURIComponent(tourSlug)}&page=${page}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error('Failed to fetch reviews')
    const data = await res.json()
    return { reviews: data.reviews || [], summary: data.summary || { average: null, count: 0 }, totalPages: data.pagination?.totalPages ?? 0 }

}

/** Submit a new review via API. */
async function submitReview(tourSlug: string, input: ReviewInput): Promise<{ success: boolean; error?: string; status?: number }> {
  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...(tourSlug === WEBSITE_REVIEW_SCOPE ? { scope: 'website' } : { tourSlug }), ...input }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Could not submit review.', status: res.status }
    return { success: true }
  } catch {
    return { success: false, error: 'Network error. Please try again.' }
  }
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
  const { locale } = useLocale()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [stars, setStars] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const pending = useRef(false)
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const textHintId = useId()
  const [needsSignIn, setNeedsSignIn] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLElement>('textarea')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) close.current()
      if (event.key !== 'Tab') return
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), a[href]') ?? []).filter(node => node.tabIndex >= 0)
      if (!nodes.length) { event.preventDefault(); dialog.current?.focus(); return }
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [mounted])

  const handleSubmit = async () => {
    if (pending.current) return
    if (text.trim().length < 10 || text.trim().length > 5000 || stars < 1 || stars > 5) {
      setError(tx(locale, { en: 'Write between 10 and 5000 characters and choose a rating from 1 to 5.', es: 'Escribe entre 10 y 5000 caracteres y elige una valoración de 1 a 5.', it: 'Scrivi da 10 a 5000 caratteri e scegli una valutazione da 1 a 5.' }))
      dialog.current?.querySelector<HTMLElement>('textarea')?.focus()
      return
    }
    pending.current = true
    setSubmitting(true)
    setError('')
    // Every public submission uses the moderated API, including the homepage.
    const result = await submitReview(tourSlug || WEBSITE_REVIEW_SCOPE, { rating: stars, title: title.trim(), text: text.trim() })
    if (result.success) {
      onSubmit({ rating: stars, title: title.trim(), text: text.trim() })
    } else {
      setNeedsSignIn(result.status === 401)
      setError(result.status === 401
        ? tx(locale, { en: 'Sign in to submit your review. Your text is still here.', es: 'Inicia sesión para enviar tu reseña. Tu texto sigue aquí.', it: 'Accedi per inviare la recensione. Il tuo testo è ancora qui.' })
        : result.error || 'Could not submit review.')
    }
    setSubmitting(false)
    pending.current = false
  }

  if (!mounted) return null

  const modal = (
    <div className="rev-modal" onClick={() => { if (!pending.current) onClose() }}>
      <div ref={dialog} className="rev-modal-card" tabIndex={-1} role="dialog" aria-modal="true" aria-label={copy.heading} onClick={(e) => e.stopPropagation()}>
        <h3>{copy.heading}</h3>
        {copy.context && <p className="rev-modal-context">{copy.context}</p>}
        <form className="rev-form" onSubmit={event => { event.preventDefault(); void handleSubmit() }}>
          <label>
            {copy.rating}
            <span className="rev-star-pick" role="radiogroup" aria-label={copy.rating}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={submitting}
                  onClick={() => setStars(n)}
                  role="radio"
                  tabIndex={stars === n ? 0 : -1}
                  aria-label={tx(locale, { en: `${n} stars`, es: `${n} estrellas`, it: `${n} stelle` })}
                  aria-checked={stars === n}
                  onKeyDown={event => {
                    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const next = event.key === 'Home' ? 1 : event.key === 'End' ? 5 : (stars + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1) + 4) % 5 + 1
                    setStars(next)
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next - 1]?.focus()
                  }}
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
              aria-describedby={textHintId}
              disabled={submitting}
            />
            <small id={textHintId} className="rev-text-hint">{tx(locale, { en: 'Minimum 10 characters. Reviews appear after approval.', es: 'Mínimo 10 caracteres. Las reseñas aparecen tras su aprobación.', it: 'Minimo 10 caratteri. Le recensioni appaiono dopo l’approvazione.' })} ({text.trim().length.toLocaleString(locale)} / 5000)</small>
          </label>
          <label>
            {copy.reviewTitle} ({tx(locale, { en: 'optional', es: 'opcional', it: 'facoltativo' })})
            <input
              value={title}
              disabled={submitting}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.reviewTitlePh}
              maxLength={160}
            />
          </label>
          {error && <p className="rev-error" role="alert">{error}</p>}
          {needsSignIn && <a href={`/login?next=${encodeURIComponent(tourSlug && tourSlug !== WEBSITE_REVIEW_SCOPE ? `/egypt-tours/${encodeURIComponent(tourSlug)}#reviews` : '/#reviews')}`}>{tx(locale, { en: 'Sign in to your account', es: 'Inicia sesión en tu cuenta', it: 'Accedi al tuo account', ar: 'سجّل الدخول إلى حسابك' })}</a>}
          <div className="rev-form-actions">
            <button type="button" className="outline-btn" onClick={onClose} disabled={submitting}>
              {copy.cancel}
            </button>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? tx(locale, { en: 'Submitting…', es: 'Enviando…', it: 'Invio…' }) : copy.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(<PublicAppearancePortal>{modal}</PublicAppearancePortal>, document.body)
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
  detailReviews?: readonly StoredReview[]
  locale: import('@/lib/locale-config').Locale
  copy: ReviewModalCopy & { title: string; summaryReviews: string; beFirst: string; justNow: string; more: string; less: string }
}) {
  const [reviews, setReviews] = useState<CustomerReview[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({ average: null, count: 0 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Load reviews on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(false); setReviews([]); setSummary({ average: null, count: 0 }); setSubmitted(false)
    fetchTourReviews(tourSlug, page).then((data) => {
      if (!cancelled) {
        setTotalPages(data.totalPages)
        setReviews(data.reviews)
        setSummary(data.summary)
        setLoading(false)
      }
    }).catch(() => { if (!cancelled) { setLoadError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [tourSlug, page, retry])

  const handleReviewSubmit = () => {
    // New reviews are PENDING: never alter published counts or ratings.
    setShowForm(false)
    setSubmitted(true)
  }
  if (loadError) return <div role="alert"><p>{tx(locale, { en: 'Unable to load reviews.', es: 'No se pudieron cargar las reseñas.', it: 'Impossibile caricare le recensioni.' })}</p><button type="button" className="outline-btn" onClick={() => setRetry(value => value + 1)}>{tx(locale, { en: 'Retry', es: 'Reintentar', it: 'Riprova' })}</button></div>

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
                      {new Date(r.publishedAt).toLocaleDateString(locale, {
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

      {totalPages > 1 && <nav className="website-review-pagination" aria-label={copy.title}><button className="outline-btn" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{tx(locale, { en: 'Previous', es: 'Anterior', it: 'Precedente' })}</button><span>{page} / {totalPages}</span><button className="outline-btn" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>{tx(locale, { en: 'Next', es: 'Siguiente', it: 'Successivo' })}</button></nav>}
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
      .map((r) => ({ name: r.name.slice(0, 60), date: typeof r.date === 'string' ? r.date : 'Just now', stars: Math.min(5, Math.max(1, Math.round(r.stars))), text: r.text.slice(0, 1000) }))
  } catch { return [] }
}

function writeList(key: string, list: StoredReview[]) {
  try { localStorage.setItem(key, JSON.stringify(list.slice(0, 50))) } catch { /* private mode */ }
}

export const loadUserReviews = (): StoredReview[] => (typeof window === 'undefined' ? [] : readList(SITE_KEY))
export const saveUserReview = (review: StoredReview) => writeList(SITE_KEY, [review, ...readList(SITE_KEY)])
export const loadTourReviews = (slug: string): StoredReview[] => (typeof window === 'undefined' ? [] : readList(tourKey(slug)))
export const saveTourReview = (slug: string, review: StoredReview) => writeList(tourKey(slug), [review, ...readList(tourKey(slug))])

/** Platform badges are no longer shown on the homepage; trust signals
  are handled server-side only. These arrays are preserved for potential
  future integration with verified review providers. */
export const reviewPlatforms = [] as const

export const platformSummary: Record<string, { avg: string; count: string }> = {}

export function PlatformIcon({ id }: { id: string }) {
  if (id === 'trips') return <span className="platform-ic" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" fill="none" stroke="#F7951D" strokeWidth="2"/><rect x="3" y="6" width="18" height="15" rx="3" fill="#163A96"/><path d="M7 21v1m10-1v1" stroke="#163A96" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="13.5" r="4.5" fill="#F7951D"/><ellipse cx="12" cy="13.5" rx="2" ry="4.5" fill="none" stroke="#fff" strokeWidth="1"/><path d="M7.5 13.5h9" stroke="#fff" strokeWidth="1"/><path d="m17 7 5 2-2 4-4-2z" fill="#00AA6C"/><circle cx="18.3" cy="9.3" r=".7" fill="#fff"/></svg></span>
  if (id === 'website') return <span className="platform-ic" aria-hidden="true"><BrandMark width={24} height={24} style={{ width: 24, height: 24, objectFit: 'contain' }} /></span>
  const icons: Record<string, string> = { tripadvisor: '/review-platforms/tripadvisor.ico', trustindex: '/review-platforms/trustindex.png', getyourguide: '/review-platforms/getyourguide.ico' }
  if (icons[id]) return <span className="platform-ic" aria-hidden="true"><img src={icons[id]} alt="" width={24} height={24} style={{ width: 24, height: 24, objectFit: 'contain' }}/></span>
  if (id === 'google') return <span className="platform-ic" aria-label="Google"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.6z" /><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-3.7 2.9C3.5 21.3 7.5 24 12 24z" /><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.7-2.9C.5 8.6 0 10.2 0 12s.5 3.4 1.4 4.9l3.8-2.5z" /><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.9l3.8 2.9c1-2.9 3.7-5.1 6.8-5.1z" /></svg></span>
  return null
}

export type SiteReview = {
  name: string
  date: string
  stars: number
  text: string
  platform?: string
  color: string
}

export const toSiteReview = (r: StoredReview): SiteReview => ({ ...r, color: avatarColor(r.name) })
