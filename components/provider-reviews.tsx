'use client'
import { useEffect, useState } from 'react'
import { useLocale, tx } from './locale'
import { PlatformIcon, StarsRow, ReviewWriteModal, type ReviewSummary } from './reviews'
import { WebsiteReviews } from './website-reviews'
import { WEBSITE_REVIEW_SCOPE } from '@/lib/review-scope'
import { REVIEW_LABELS, REVIEW_PROVIDERS, type ReviewFeed, type ReviewProvider } from '@/lib/review-integrations'
function TrustindexWidget({ id }: { id: string }) {
  if (!/^[a-zA-Z0-9]{8,100}$/.test(id)) return null
  const doc = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src https://cdn.trustindex.io https://www.trustindex.io; style-src 'unsafe-inline' https:; img-src https: data:; font-src https:; connect-src https://cdn.trustindex.io https://www.trustindex.io https://admin.trustindex.io; frame-src https://www.trustindex.io"><style>body{margin:0;font-family:Arial,sans-serif}</style></head><body><script defer async src="https://cdn.trustindex.io/loader.js?${id}"></script></body></html>`
  return <iframe title="Trustindex reviews" srcDoc={doc} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="provider-review-widget"/>
}
export function ProviderReviewsSection() {
  const { locale } = useLocale(), [selected, setSelected] = useState<ReviewProvider | 'all' | 'website'>('all'), [feeds, setFeeds] = useState<ReviewFeed[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0), [writing, setWriting] = useState(false), [submitted, setSubmitted] = useState(false)
  const text = (en: string, es: string, it: string, ar: string) => tx(locale, { en, es, it, ar })
  const [websiteSummary, setWebsiteSummary] = useState<ReviewSummary | null>(null)
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false); setFeeds([])
    const providers = REVIEW_PROVIDERS
    void Promise.all(providers.map(async provider => {
      try {
        const response = await fetch(`/api/review-integrations?provider=${provider}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw Error()
        return await response.json() as ReviewFeed
      } catch { if (!controller.signal.aborted) setError(true); return null }
    })).then(rows => { if (!controller.signal.aborted) { setFeeds(rows.filter((r): r is ReviewFeed => r !== null)); setLoading(false) } })
    return () => controller.abort()
  }, [retry])
  const enabled = feeds.filter(f => f.enabled === true)
  const visible = enabled.filter(f => selected === 'all' || f.provider === selected)
  const connected = visible.filter(f => f.state === 'connected' || f.state === 'widget_configured')
  const reviewLinks = enabled.filter(f => f.profileUrl)
  const selectedFeed = visible.find(f => f.provider === selected)
  const writeLabel = text('Write a review', 'Escribir una reseña', 'Scrivi una recensione', 'اكتب تقييمًا')
  useEffect(() => { if (!loading && selected !== 'all' && selected !== 'website' && !feeds.some(f => f.provider === selected && f.enabled)) setSelected('all') }, [feeds, loading, selected])
  const all = text('All reviews', 'Todas las reseñas', 'Tutte le recensioni', 'كل التقييمات')
  const website = text('Website reviews', 'Reseñas del sitio', 'Recensioni del sito', 'تقييمات الموقع')
  return <section className="home-section reviews-section"><div className="container">
    <div className="home-heading"><h2>{text('Loved by travelers', 'Amado por los viajeros', 'Amato dai viaggiatori', 'محبوب من المسافرين')}</h2><p>{text('Experiences shared by our travelers.', 'Experiencias de nuestros viajeros.', 'Esperienze dei nostri viaggiatori.', 'تجارب يشاركها مسافرونا.')}</p></div>
    <div className="rev-tabs provider-review-tabs" role="group" aria-label={text('Review platforms', 'Plataformas de reseñas', 'Piattaforme di recensioni', 'منصات التقييمات')}>
      {(['all', 'website', ...enabled.map(f => f.provider)] as const).map(p => <button type="button" key={p} aria-label={p === 'all' ? all : p === 'website' ? website : REVIEW_LABELS[p]} aria-pressed={selected === p} className={selected === p ? 'active' : ''} onClick={() => setSelected(p)}>{p !== 'all' && <PlatformIcon id={p}/>}<span>{p === 'all' ? all : p === 'website' ? website : REVIEW_LABELS[p]}</span></button>)}
    </div>
    <div className="rev-summary">
      {selected !== 'all' && <PlatformIcon id={selected}/>}
      <strong>{selected === 'all' ? all : selected === 'website' ? website : REVIEW_LABELS[selected]}</strong>
      {selected === 'website' && websiteSummary && <>{websiteSummary.average !== null && <b>{websiteSummary.average.toFixed(1)} / 5</b>}<span className="rev-count">{websiteSummary.count.toLocaleString(locale)} {text('reviews', 'reseñas', 'recensioni', 'تقييم')}</span></>}
      {selectedFeed?.average != null && <b>{selectedFeed.average.toFixed(1)} / 5</b>}
      {selectedFeed?.count != null && <span className="rev-count">{selectedFeed.count.toLocaleString(locale)} {text('reviews', 'reseñas', 'recensioni', 'تقييم')}</span>}
      <div className="website-review-actions">
        {selected === 'all' || selected === 'website' ? <button type="button" className="rev-write" onClick={() => { setSubmitted(false); setWriting(true) }}><PlatformIcon id="website"/>{writeLabel}</button> : selectedFeed?.profileUrl ? <a className="rev-write" href={selectedFeed.profileUrl} target="_blank" rel="noopener noreferrer"><PlatformIcon id={selected}/>{writeLabel}</a> : <button type="button" className="rev-write" disabled title={text('Review link has not been configured yet.', 'El enlace aún no está configurado.', 'Il link non è ancora configurato.', 'لم يتم إعداد رابط التقييم بعد.')}><PlatformIcon id={selected}/>{writeLabel}</button>}
        {selected === 'all' && reviewLinks.length > 0 && <details className="external-review-dropdown"><summary className="rev-write">{text('Review us on', 'Valóranos en', 'Recensiscici su', 'قيّمنا على')} ▾</summary><div>{reviewLinks.map(f => <a key={f.provider} href={f.profileUrl} target="_blank" rel="noopener noreferrer"><PlatformIcon id={f.provider}/>{REVIEW_LABELS[f.provider]}</a>)}</div></details>}
      </div>
    </div>
    {submitted && <p role="status" className="provider-review-empty">{text('Thank you! Your review is awaiting approval.', '¡Gracias! Tu reseña está pendiente de aprobación.', 'Grazie! La tua recensione è in attesa di approvazione.', 'شكرًا! تقييمك في انتظار موافقة الإدارة.')}</p>}
    {(selected === 'all' || selected === 'website') && <WebsiteReviews showEmpty={selected === 'website'} onSummary={setWebsiteSummary}/>}
    {writing && <ReviewWriteModal tourSlug={WEBSITE_REVIEW_SCOPE} copy={{ heading: text('Write a review', 'Escribir una reseña', 'Scrivi una recensione', 'اكتب تقييمًا'), context: text('Review STAR PYRAMIDS. Sign in to submit; reviews are published after approval.', 'Valora STAR PYRAMIDS. Inicia sesión; las reseñas requieren aprobación.', 'Recensisci STAR PYRAMIDS. Accedi; le recensioni richiedono approvazione.', 'قيّم STAR PYRAMIDS. يلزم تسجيل الدخول، ويُنشر التقييم بعد موافقة الإدارة.'), rating: text('Rating', 'Valoración', 'Valutazione', 'التقييم'), review: text('Your review', 'Tu reseña', 'La tua recensione', 'تقييمك'), reviewPh: text('Tell us about your experience…', 'Cuéntanos tu experiencia…', 'Raccontaci la tua esperienza…', 'احكِ لنا عن تجربتك…'), reviewTitle: text('Review title', 'Título', 'Titolo', 'عنوان التقييم'), reviewTitlePh: text('A title for your review', 'Título de tu reseña', 'Titolo della recensione', 'عنوان تقييمك'), cancel: text('Cancel', 'Cancelar', 'Annulla', 'إلغاء'), submit: text('Submit review', 'Enviar reseña', 'Invia recensione', 'إرسال التقييم') }} onClose={() => setWriting(false)} onSubmit={() => { setWriting(false); setSubmitted(true) }}/ >}
    {loading && <p role="status">{text('Loading reviews…', 'Cargando reseñas…', 'Caricamento recensioni…', 'جارٍ تحميل التقييمات…')}</p>}
    {!loading && error && <div className="provider-review-empty"><p role="alert">{text('Some reviews are temporarily unavailable.', 'Algunas reseñas no están disponibles temporalmente.', 'Alcune recensioni sono temporaneamente non disponibili.', 'بعض التقييمات غير متاحة مؤقتًا.')}</p><button type="button" className="outline-btn" onClick={() => setRetry(v => v + 1)}>{text('Retry', 'Reintentar', 'Riprova', 'إعادة المحاولة')}</button></div>}
    {!loading && !error && selected !== 'website' && !connected.some(f => f.widgetId || f.reviews.length > 0) && (selected !== 'all' || websiteSummary?.count === 0) && <p className="provider-review-empty">{text('Reviews will appear here when available.', 'Las reseñas aparecerán aquí cuando estén disponibles.', 'Le recensioni appariranno qui quando disponibili.', 'ستظهر التقييمات هنا عند توفرها.')}</p>}
    {!loading && connected.map(feed => <div key={feed.provider} className="provider-review-group">
      {feed.provider === 'google' && <p className="provider-review-attribution">Google Maps · {text('A selection of reviews provided by Google.', 'Una selección de reseñas proporcionada por Google.', 'Una selezione di recensioni fornita da Google.', 'عينة من التقييمات المقدمة من جوجل.')} <a href="https://support.google.com/contributionpolicy/answer/7400114" target="_blank" rel="noopener noreferrer">{text('Review policy', 'Política de reseñas', 'Norme sulle recensioni', 'سياسة التقييمات')}</a></p>}
      {feed.widgetId ? <TrustindexWidget id={feed.widgetId}/> : <div className="rev-grid">{feed.reviews.map(r => <article key={r.id} className="rev-card"><div className="rev-head"><div>{r.authorUrl ? <a href={r.authorUrl} target="_blank" rel="noopener noreferrer">{r.author}</a> : <b>{r.author}</b>}<small>{Number.isFinite(Date.parse(r.date)) ? new Date(r.date).toLocaleDateString(locale) : ''}</small></div><PlatformIcon id={feed.provider}/></div><div className="rev-card-stars">{r.ratingImageUrl ? <img src={r.ratingImageUrl} alt={`${r.rating} / 5`} width={100} height={20}/> : <StarsRow stars={r.rating}/>}</div><p>{r.text}</p>{r.url && <a href={r.url} target="_blank" rel="noopener noreferrer">{text('Read original review', 'Leer reseña original', 'Leggi recensione originale', 'قراءة التقييم الأصلي')}</a>}</article>)}</div>}
    </div>)}
    {!loading && visible.filter(f => f.state !== 'connected' && f.state !== 'widget_configured' && f.profileUrl).map(f => <p key={f.provider}><a href={f.profileUrl} target="_blank" rel="noopener noreferrer">{text('View on', 'Ver en', 'Vedi su', 'عرض على')} {REVIEW_LABELS[f.provider]}</a></p>)}
  </div></section>
}
