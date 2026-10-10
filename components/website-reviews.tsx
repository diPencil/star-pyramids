'use client'
import { useEffect, useState } from 'react'
import { useLocale, tx } from './locale'
import { PlatformIcon, StarsRow, type CustomerReview, type ReviewSummary } from './reviews'

export function WebsiteReviews({ showEmpty = true, onSummary }: { showEmpty?: boolean; onSummary: (summary: ReviewSummary | null) => void }) {
  const { locale } = useLocale()
  const t = (en: string, es: string, it: string, ar: string) => tx(locale, { en, es, it, ar })
  const [data, setData] = useState<{ reviews: CustomerReview[]; summary: ReviewSummary; pagination: { totalPages: number } } | null>(null)
  const [page, setPage] = useState(1), [error, setError] = useState(false), [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(false); onSummary(null)
    void fetch(`/api/reviews?scope=website&page=${page}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error()
      const result = await response.json()
      if (!controller.signal.aborted) { setData(result); onSummary(result.summary) }
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [page, retry, onSummary])
  return <div className="provider-review-group">
    {error ? <div className="provider-review-empty"><p role="alert">{t('Unable to load website reviews.', 'No se pudieron cargar las reseñas.', 'Impossibile caricare le recensioni.', 'تعذر تحميل تقييمات الموقع.')}</p><button className="outline-btn" onClick={() => setRetry(v => v + 1)}>{t('Retry', 'Reintentar', 'Riprova', 'إعادة المحاولة')}</button></div> : !data ? <p role="status">{t('Loading reviews…', 'Cargando reseñas…', 'Caricamento recensioni…', 'جارٍ تحميل التقييمات…')}</p> : data.reviews.length === 0 ? (showEmpty && <p className="provider-review-empty">{t('No website reviews yet.', 'Aún no hay reseñas del sitio.', 'Nessuna recensione del sito.', 'لا توجد تقييمات للموقع حتى الآن.')}</p>) : <div className="rev-grid">{data.reviews.map(r => <article key={r.publicId} className="rev-card"><div className="rev-head"><div><b>{r.reviewerName}</b><small>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString(locale) : ''}</small></div><PlatformIcon id="website"/></div><StarsRow stars={r.rating}/>{r.title && <strong>{r.title}</strong>}<p>{r.text}</p></article>)}</div>}
    {data && data.pagination.totalPages > 1 && <nav className="website-review-pagination" aria-label={t('Website review pages', 'Páginas de reseñas', 'Pagine recensioni', 'صفحات تقييمات الموقع')}><button className="outline-btn" disabled={page === 1} onClick={() => setPage(v => v - 1)}>{t('Previous', 'Anterior', 'Precedente', 'السابق')}</button><span>{page} / {data.pagination.totalPages}</span><button className="outline-btn" disabled={page >= data.pagination.totalPages} onClick={() => setPage(v => v + 1)}>{t('Next', 'Siguiente', 'Successivo', 'التالي')}</button></nav>}
  </div>
}
