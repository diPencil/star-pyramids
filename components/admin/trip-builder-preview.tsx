'use client'

import { useId, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Eye, X, Clock3, MapPin, Users, ShieldCheck } from 'lucide-react'
import type { Tour } from '@/data/types'
import { ENABLED_LOCALES, LOCALE_LABELS, pickLocaleText, type EnabledLocale } from '@/lib/locale-config'
import { buildTripPreview, previewCount, quoteTripPreview, type TripBuilderDraft, type TripPreview, type PreviewTravelers } from '@/lib/trip-builder-preview'
import { formatPrice } from '@/components/locale'
import { formatTourDateRange } from '@/lib/tour-format'
import { appearanceCss, type AppearanceTokens } from '@/lib/website-appearance'
import './trip-builder-preview.css'

export function safePreviewMedia(value: string | undefined) {
  if (!value) return ''
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !/[\\\s<>"\u0000-\u001f]/.test(decoded) && !decoded.split('/').includes('..')) return value
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}
const copy = (locale: EnabledLocale) => (en: string, es: string, it: string) => pickLocaleText(locale, { en, es, it })
export function PreviewDatePrices({ preview }: { preview: TripPreview }) {
  const rows = (preview.tour.detail ?? preview.tour.dayDetail)?.priceRows ?? [], t = copy(preview.locale)
  const money = (amount: number) => Number.isFinite(amount) && amount >= 0 ? formatPrice(amount, 'USD', preview.locale) : '—'
  if (!rows.length) return null
  return <section className="tour-price-breakdown"><h2>{t('Tour Prices', 'Precios del viaje', 'Prezzi del viaggio')}</h2><p>{t('USD travel-date information; separate from booking traveler rates.', 'Precios de fechas en USD, separados de las tarifas de reserva.', 'Prezzi per le date in USD, separati dalle tariffe di prenotazione.')}</p><div className="price-cards-grid">{rows.map((row,index) => <div className="price-season-card" key={index}><header className="price-season-header"><div><b>{row.category}</b>{(row.startDate || row.endDate) && <small>{formatTourDateRange(row.startDate,row.endDate,preview.locale)}</small>}</div></header><div className="price-season-body">{row.tiers?.length ? row.tiers.map((tier,i) => <div className="price-tier" key={i}><span>{tier.label}</span><strong>{row.prefix}{money(tier.price)} {tier.suffix}</strong></div>) : <div className="price-tier"><span>{row.note}</span><strong>{row.prefix}{money(row.price)}</strong></div>}</div>{row.note && <p>{row.note}</p>}</div>)}</div></section>
}
export function PreviewPricing({ preview, counts, onCount }: { preview: TripPreview; counts: PreviewTravelers; onCount?: (type: keyof PreviewTravelers, count: number) => void }) {
  const id = useId(), t = copy(preview.locale), quote = quoteTripPreview(preview, counts)
  const money = (amount: number) => Number.isFinite(amount) && amount >= 0 ? formatPrice(amount, 'USD', preview.locale) : '—'
  return <section className="sp-trip-preview-pricing" aria-label={t('Booking pricing preview', 'Vista previa del precio', 'Anteprima prezzo prenotazione')}>
    <h3>{t('Booking pricing', 'Precio de la reserva', 'Prezzo prenotazione')}</h3>
    <p>{t('Stored pricing currency: USD. No display conversion applied.', 'Moneda del precio: USD. Sin conversión de moneda.', 'Valuta del prezzo: USD. Nessuna conversione applicata.')}</p>
    <p>{t('Base price per adult', 'Precio base por adulto', 'Prezzo base per adulto')}: <strong>{money(preview.tour.price)}</strong></p>
    <div className="sp-preview-guests">{(['adult','child','infant'] as const).map(type => <label key={type} htmlFor={`${id}-${type}`}>{type === 'adult' ? t('Adults', 'Adultos', 'Adulti') : type === 'child' ? t('Children', 'Niños', 'Bambini') : t('Infants', 'Bebés', 'Neonati')}<input id={`${id}-${type}`} type="number" min={type === 'adult' ? 1 : 0} max={50} step={1} value={counts[type]} onChange={event => onCount?.(type, previewCount(event.target.value, type === 'adult' ? 1 : 0))} readOnly={!onCount}/></label>)}</div>
    {quote.kind === 'quote' ? <div aria-live="polite"><dl>{(['adult','child','infant'] as const).map(type => <div key={type}><dt>{type === 'adult' ? t('Per adult', 'Por adulto', 'Per adulto') : type === 'child' ? t('Per child', 'Por niño', 'Per bambino') : t('Per infant', 'Por bebé', 'Per neonato')}</dt><dd>{money(quote[type])}</dd></div>)}</dl><p>{t('Travelers', 'Viajeros', 'Viaggiatori')}: {quote.headcount}</p><strong>{t('Traveler group total', 'Total del grupo', 'Totale gruppo')}: {money(quote.total)} USD</strong></div> : <p role="status">{quote.kind === 'invalid-count' ? t('Use 1–50 adults, 0–50 children/infants and at most 60 travelers.', 'Usa 1–50 adultos, 0–50 niños/bebés y un máximo de 60 viajeros.', 'Usa 1–50 adulti, 0–50 bambini/neonati e al massimo 60 viaggiatori.') : t('Complete the pricing fields to calculate a total.', 'Completa los precios para calcular el total.', 'Completa i prezzi per calcolare il totale.')}</p>}
    {preview.linkedOffer && <p>{t('An active linked offer takes precedence over the manual discount.', 'Una oferta vinculada activa tiene prioridad sobre el descuento manual.', 'Un’offerta collegata attiva ha precedenza sullo sconto manuale.')}</p>}
    <small>{t('Estimate only. Optional add-ons are excluded. The server recalculates all real bookings.', 'Solo estimación. Extras opcionales excluidos. El servidor recalcula cada reserva.', 'Solo stima. Extra opzionali esclusi. Il server ricalcola ogni prenotazione.')}</small>
  </section>
}

export function TripPreviewContent({ preview, counts, onCount, appearance }: { preview: TripPreview; counts: PreviewTravelers; onCount?: (type: keyof PreviewTravelers, count: number) => void; appearance?: AppearanceTokens }) {
  const { tour, locale } = preview, t = copy(locale)
  const detail = tour.detail ?? tour.dayDetail
  const itinerary = tour.detail?.itinerary ?? tour.dayDetail?.stops ?? []
  const highlights = tour.detail?.highlights ?? tour.dayDetail?.highlightGroups ?? []
  const money = (amount: number | undefined) => amount !== undefined && Number.isFinite(amount) && amount >= 0 ? formatPrice(amount, 'USD', locale) : '—'
  const photos = (tour.gallery ?? []).map((src,index) => ({ src: safePreviewMedia(src), alt: tour.galleryCaptions?.[index]?.en ?? '' })).filter(row => row.src)
  const [selected, setSelected] = useState(0)
  const selectedIndex = Math.min(selected, Math.max(0, photos.length-1))
  const image = photos[selectedIndex]
  return <article className="sp-trip-preview-public public-appearance" lang={locale}>
    {appearance && <style>{appearanceCss(appearance)}</style>}
    <header className="tour-detail-head"><span>{tour.category} · {tour.status ?? 'draft'}</span><small dir="ltr">{tour.slug ? `/egypt-tours/${tour.slug}` : t('Route not set', 'Ruta sin definir', 'Percorso non impostato')}</small><h1>{tour.title || <em>{t('Untitled trip', 'Viaje sin título', 'Viaggio senza titolo')}</em>}</h1><p>{tour.summary}</p></header>
    <div className="tour-detail-layout"><div className="tour-detail-main">
      <section className="tour-gallery">{image ? <div className="tour-gallery-main"><img src={image.src} alt={image.alt}/></div> : <p className="sp-trip-preview-empty">{t('No image selected', 'Sin imagen seleccionada', 'Nessuna immagine selezionata')}</p>}{photos.length > 1 && <div className="tour-thumbs">{photos.map((photo,index) => <button key={photo.src+index} type="button" aria-pressed={selectedIndex === index} aria-label={t(`Show image ${index+1}`, `Mostrar imagen ${index+1}`, `Mostra immagine ${index+1}`)} onClick={() => setSelected(index)}><img src={photo.src} alt=""/></button>)}</div>}</section>
      <div className="tour-facts"><span><Clock3 size={17}/>{tour.duration}</span><span><MapPin size={17}/>{tour.location}</span><span><Users size={17}/>{tour.groupSize}</span><span><ShieldCheck size={17}/>{tour.travelStyle}</span></div>
      <section className="tour-content-section"><h2>{t('Overview', 'Descripción', 'Panoramica')}</h2>{detail?.overview.map((paragraph,index) => <p key={index}>{paragraph}</p>)}</section>
      {highlights.length > 0 && <section className="tour-content-section"><h2>{t('Highlights', 'Lo más destacado', 'Punti salienti')}</h2>{safePreviewMedia(detail?.highlightImage) && <img className="sp-trip-preview-section-image" src={safePreviewMedia(detail?.highlightImage)} alt=""/>}{highlights.map((group,index) => <details className="tour-accordion" key={index} open><summary>{group.title}</summary><ul>{group.items.map((value,i) => <li key={i}>{value}</li>)}</ul></details>)}</section>}
      {(itinerary.length > 0 || detail?.itineraryNote) && <section className="tour-content-section"><h2>{t('Itinerary', 'Itinerario', 'Itinerario')}</h2>{detail?.itineraryNote && <p>{detail.itineraryNote}</p>}{itinerary.map((day,index) => <details className="tour-accordion" key={index} open><summary>{day.day} · {day.title}</summary><p>{day.description}</p>{day.meals && <p>{day.meals}</p>}{safePreviewMedia(day.image) && <img className="sp-trip-preview-section-image" src={safePreviewMedia(day.image)} alt={day.title}/>}</details>)}</section>}
      {Boolean(detail?.included?.length || detail?.excluded?.length) && <section className="tour-content-section"><h2>{t('Inclusions', 'Servicios incluidos', 'Servizi inclusi')}</h2><div className="inclusion-grid">{[detail?.included ?? [],detail?.excluded ?? []].map((values,index) => <div key={index}><h3>{index === 0 ? t('Included', 'Incluido', 'Incluso') : t('Excluded', 'No incluido', 'Escluso')}</h3><ul>{values.map((value,i) => <li key={i}>{value}</li>)}</ul></div>)}</div></section>}
      {!!detail?.addOns?.length && <section className="tour-content-section"><h2>{t('Add-ons', 'Extras', 'Extra')}</h2>{detail.addOns.map((addon,index) => <p key={index}>{addon.title} · {money(addon.price)} USD</p>)}</section>}
      {!!detail?.locations?.length && <section className="tour-content-section"><h2>{t('Location', 'Ubicación', 'Posizione')}</h2>{detail.locations.map((location,index) => <p key={index}>{typeof location === 'string' ? location : `${location.name} (${location.latitude}, ${location.longitude})`}</p>)}</section>}
      <PreviewDatePrices preview={preview}/>
      {!!tour.journeyVideos?.length && <section className="tour-content-section"><h2>{t('Journey videos', 'Vídeos del viaje', 'Video del viaggio')}</h2>{tour.journeyVideos.map(video => <figure key={video.id}>{safePreviewMedia(video.thumbnail) && <img className="sp-trip-preview-section-image" src={safePreviewMedia(video.thumbnail)} alt=""/>}<figcaption>{video.title} · {video.platform}<br/><span dir="ltr">{video.url}</span></figcaption></figure>)}</section>}
      {!!tour.photoCredits?.length && <p className="tour-photo-credits">{tour.photoCredits.map((credit,index) => <span key={index}>{credit.label} · {credit.url} </span>)}</p>}
    </div><aside><PreviewPricing preview={preview} counts={counts} onCount={onCount}/></aside></div>
  </article>
}

export function TripBuilderPreview({ source, draft, clearedTranslations, counts, onCount, showDatePricing = false, appearance }: { source: Tour; draft: TripBuilderDraft; clearedTranslations: ReadonlySet<string>; counts: PreviewTravelers; onCount: (type: keyof PreviewTravelers, count: number) => void; showDatePricing?: boolean; appearance?: AppearanceTokens }) {
  const [locale, setLocale] = useState<EnabledLocale>('en'), [open, setOpen] = useState(false), [mobile, setMobile] = useState(false)
  const preview = buildTripPreview(source, draft, locale, clearedTranslations), t = copy(locale)
  const languageControl = <label>{t('Preview language', 'Idioma de vista previa', 'Lingua anteprima')}<select value={locale} onChange={event => { if (ENABLED_LOCALES.includes(event.target.value as EnabledLocale)) setLocale(event.target.value as EnabledLocale) }}>{ENABLED_LOCALES.map(value => <option key={value} value={value}>{LOCALE_LABELS[value]}</option>)}</select></label>
  return <aside className="sp-preview sp-trip-preview-panel"><h3>{t('Live preview', 'Vista previa en directo', 'Anteprima dal vivo')}</h3>{languageControl}
    <Dialog.Root open={open} onOpenChange={setOpen} modal><Dialog.Trigger type="button" className="sp-btn"><Eye size={16}/>{t('Open full page preview', 'Abrir vista previa completa', 'Apri anteprima completa')}</Dialog.Trigger><Dialog.Portal><Dialog.Backdrop className="sp-trip-preview-backdrop"/><Dialog.Popup className="sp-trip-preview-dialog" initialFocus finalFocus><header className="sp-trip-preview-toolbar"><Dialog.Title>{t('Unsaved trip preview', 'Vista previa del viaje sin guardar', 'Anteprima viaggio non salvato')}</Dialog.Title>{languageControl}<button type="button" className="sp-btn" aria-pressed={mobile} onClick={() => setMobile(value => !value)}>{mobile ? t('Desktop width', 'Ancho de escritorio', 'Larghezza desktop') : t('Mobile width', 'Ancho móvil', 'Larghezza mobile')}</button><Dialog.Close type="button" className="sp-btn" aria-label={t('Close preview', 'Cerrar vista previa', 'Chiudi anteprima')}><X size={18}/></Dialog.Close></header><Dialog.Description>{t('Current form only. Nothing is saved or booked from this preview.', 'Solo el formulario actual. Esta vista no guarda ni reserva.', 'Solo il modulo attuale. L’anteprima non salva né prenota.')}</Dialog.Description><div className={mobile ? 'sp-trip-preview-viewport is-mobile' : 'sp-trip-preview-viewport'}><TripPreviewContent preview={preview} counts={counts} onCount={onCount} appearance={appearance}/></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
    {showDatePricing && <PreviewDatePrices preview={preview}/>}<h4>{preview.tour.title}</h4><p>{preview.tour.summary}</p><PreviewPricing preview={preview} counts={counts} onCount={onCount}/>
  </aside>
}
