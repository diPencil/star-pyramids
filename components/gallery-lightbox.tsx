'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { resolveGalleryVideoSource, type GalleryItem } from '@/lib/journey-gallery'
import { bindGalleryDialog, galleryNextIndex, stopGalleryVideo } from '@/lib/gallery-lightbox'
import { sanitizeLocale, pickLocaleText, type Locale } from '@/lib/locale-config'
import { PublicAppearancePortal } from './public-appearance'
import './gallery-lightbox.css'

export function GalleryLightboxMedia({ item, locale }: { item: GalleryItem; locale: Locale }) {
  const [error, setError] = useState(false), [loading, setLoading] = useState(true)
  const video = useRef<HTMLVideoElement>(null)
  const safeLocale = sanitizeLocale(locale)
  const t = (en: string, es: string, it: string) => pickLocaleText(safeLocale, { en, es, it })
  const source = item.mediaType === 'VIDEO' ? resolveGalleryVideoSource(item.mediaUrl, item.platform) : null
  useEffect(() => { const player = video.current; return () => stopGalleryVideo(player) }, [])
  if (error || (item.mediaType === 'VIDEO' && !source)) return <p role="alert">{t('This media could not be loaded.', 'No se pudo cargar este archivo.', 'Impossibile caricare questo contenuto.')}</p>
  return <>
    {loading && source?.kind !== 'external' && <span className="gallery-lightbox-loading" role="status">{t('Loading media…', 'Cargando archivo…', 'Caricamento contenuto…')}</span>}
    {item.mediaType === 'IMAGE' ? <img className="gallery-lightbox-image" src={item.mediaUrl} alt={item.title} onLoad={() => setLoading(false)} onError={() => setError(true)}/> : source?.kind === 'direct' ? <video ref={video} className="gallery-lightbox-video" controls playsInline preload="metadata" poster={item.thumbnail ?? undefined} src={source.src} onLoadedData={() => setLoading(false)} onError={() => setError(true)}/> : source?.kind === 'embed' ? <iframe className="gallery-lightbox-embed" title={item.title} src={source.src} onLoad={() => setLoading(false)} onError={() => setError(true)} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : source && <a href={source.src} target="_blank" rel="noopener noreferrer">{t('Watch on the original platform', 'Ver en la plataforma original', 'Guarda sulla piattaforma originale')}</a>}
  </>
}

export function GalleryLightbox({ items, selectedId, onSelect, onClose, locale }: { items: GalleryItem[]; selectedId: string; onSelect: (id: string) => void; onClose: () => void; locale: Locale }) {
  const [mounted, setMounted] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const handlers = useRef({ items, selectedId, onSelect, onClose })
  handlers.current = { items, selectedId, onSelect, onClose }
  const index = items.findIndex(item => item.id === selectedId), item = items[index]
  const t = (en: string, es: string, it: string) => pickLocaleText(sanitizeLocale(locale), { en, es, it })
  const navigate = (delta: number) => {
    const current = handlers.current, position = current.items.findIndex(row => row.id === current.selectedId)
    const next = galleryNextIndex(position, delta, current.items.length)
    if (next >= 0) current.onSelect(current.items[next].id)
  }
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted || !dialog.current) return
    return bindGalleryDialog(document, dialog.current, () => handlers.current.onClose(), navigate)
  }, [mounted])
  useEffect(() => { if (!item) onClose() }, [item, onClose])
  if (!mounted || !item) return null
  return createPortal(<PublicAppearancePortal><div className="gallery-lightbox-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="gallery-lightbox" ref={dialog} role="dialog" aria-modal="true" aria-label={t('Journey gallery', 'Galería de viajes', 'Galleria dei viaggi')} tabIndex={-1}>
      <header className="gallery-lightbox-toolbar"><span aria-live="polite">{index + 1} / {items.length}</span><button type="button" aria-label={t('Close preview', 'Cerrar vista previa', 'Chiudi anteprima')} onClick={onClose}><X aria-hidden="true"/></button></header>
      <div className="gallery-lightbox-stage" onClick={event => { if (event.target === event.currentTarget) onClose() }}><GalleryLightboxMedia key={item.id + item.mediaUrl} item={item} locale={locale}/></div>
      <footer className="gallery-lightbox-caption"><strong>{item.title}</strong>{item.caption && <p>{item.caption}</p>}{item.mediaType === 'VIDEO' && resolveGalleryVideoSource(item.mediaUrl, item.platform)?.kind === 'embed' && <p><a href={item.mediaUrl} target="_blank" rel="noopener noreferrer">{t('Watch on the original platform', 'Ver en la plataforma original', 'Guarda sulla piattaforma originale')}</a></p>}</footer>
      {items.length > 1 && <nav className="gallery-lightbox-navigation" aria-label={t('Gallery navigation', 'Navegación de la galería', 'Navigazione galleria')}><button type="button" aria-label={t('Previous media', 'Archivo anterior', 'Contenuto precedente')} onClick={() => navigate(-1)}><ChevronLeft aria-hidden="true"/></button><button type="button" aria-label={t('Next media', 'Archivo siguiente', 'Contenuto successivo')} onClick={() => navigate(1)}><ChevronRight aria-hidden="true"/></button></nav>}
    </div>
  </div></PublicAppearancePortal>, document.body)
}
