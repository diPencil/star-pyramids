'use client'
import Link from 'next/link'
import type { ReviewScope } from '@/lib/review-scope'
import { useEffect, useState } from 'react'
import { useLocale, tx } from './locale'
import { PlatformIcon, StarsRow, type CustomerReview, type ReviewSummary } from './reviews'
import { ReviewMarquee } from './review-marquee'

export function WebsiteReviews({ scope = 'website', showEmpty = true, onSummary }: { scope?: ReviewScope; showEmpty?: boolean; onSummary: (summary: ReviewSummary | null) => void }) {
  const { locale } = useLocale()
  const t = (en: string, es: string, it: string, ar: string) => tx(locale, { en, es, it, ar })
  const [data, setData] = useState<{ reviews: CustomerReview[]; summary: ReviewSummary; pagination: { totalPages: number } } | null>(null)
  const [page, setPage] = useState(1), [error, setError] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(false); onSummary(null)
    void fetch(`/api/reviews?scope=${scope}&page=${page}&locale=${locale}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error()
      const result = await response.json()
      if (!controller.signal.aborted) { setData(result); onSummary(result.summary) }
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [scope, locale, page, retry, onSummary])
  return <div className="provider-review-group">
    {error ? <div className="provider-review-empty"><p role="alert">{t('Unable to load reviews.', 'No se pudieron cargar las reseñas.', 'Impossibile caricare le recensioni.', 'تعذر تحميل تقييمات الموقع.')}</p><button className="outline-btn" onClick={() => setRetry(v => v + 1)}>{t('Retry', 'Reintentar', 'Riprova', 'إعادة المحاولة')}</button></div> : !data ? <p role="status">{t('Loading reviews…', 'Cargando reseñas…', 'Caricamento recensioni…', 'جارٍ تحميل التقييمات…')}</p> : data.reviews.length === 0 ? (showEmpty && <p className="provider-review-empty">{t('No reviews yet.', 'Aún no hay reseñas.', 'Nessuna recensione.', 'لا توجد تقييمات للموقع حتى الآن.')}</p>) : <ReviewMarquee ariaLabel={t('Customer reviews carousel', 'Carrusel de reseñas', 'Carosello delle recensioni', 'عارض تقييمات الموقع')} items={data.reviews} getKey={r => r.publicId} renderItem={(r, isClone) => <article className="rev-card" dir={locale === 'ar' ? 'rtl' : 'ltr'}><div className="rev-head"><div><b>{r.reviewerName}</b><small>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString(locale) : ''}</small></div><PlatformIcon id="website"/></div><StarsRow stars={r.rating}/>{r.title && <strong>{r.title}</strong>}<p>{r.text}</p>{r.scope === 'trips' && <small>{r.trip ? <Link href={r.trip.href} tabIndex={isClone ? -1 : undefined}>{r.trip.title}</Link> : t('Trip unavailable', 'Viaje no disponible', 'Viaggio non disponibile', 'الرحلة غير متاحة')}</small>}</article>}/>
    }
    {data && data.pagination.totalPages > 1 && <nav className="website-review-pagination" aria-label={t('Review pages', 'Páginas de reseñas', 'Pagine recensioni', 'صفحات تقييمات الموقع')}><button className="outline-btn" disabled={page === 1} onClick={() => setPage(v => v - 1)}>{t('Previous', 'Anterior', 'Precedente', 'السابق')}</button><span>{page} / {data.pagination.totalPages}</span><button className="outline-btn" disabled={page >= data.pagination.totalPages} onClick={() => setPage(v => v + 1)}>{t('Next', 'Siguiente', 'Successivo', 'التالي')}</button></nav>}
  </div>
}
