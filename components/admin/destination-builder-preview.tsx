'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from '@base-ui/react/dialog'
import { Eye, X } from 'lucide-react'
import type { Destination, Tour } from '@/data/types'
import { destinationPreview } from '@/lib/destination-builder'
import { ENABLED_LOCALES, LOCALE_LABELS, type EnabledLocale } from '@/lib/locale-config'
import { InitialLocaleProvider, LocaleProvider } from '@/components/locale'
import { usePublishedAppearance } from '@/components/public-appearance'
import { appearanceCss } from '@/lib/website-appearance'
import { DestinationDetailView } from '@/components/extended-pages'
import './destination-builder.css'

/** No SiteShell, catalogue hooks, chat, booking, or favorites providers are mounted here. */
export function DestinationPreviewContent({ item, tours, locale }: { item: Destination; tours: readonly Tour[]; locale: EnabledLocale }) {
  const appearance = usePublishedAppearance()
  const projection = destinationPreview(item, tours, locale)
  return <InitialLocaleProvider locale={locale} preview><LocaleProvider initialLocale={locale} key={locale}>
    <div inert className="public-appearance sp-destination-preview-readonly">{appearance && <style>{appearanceCss(appearance)}</style>}<DestinationDetailView item={projection.item} relatedTours={projection.tours} preview/></div>
  </LocaleProvider></InitialLocaleProvider>
}

const frameDocument = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fff}*{box-sizing:border-box}</style></head><body></body></html>'

export function DestinationBuilderPreview({ item, tours }: { item: Destination; tours: readonly Tour[] }) {
  const [open, setOpen] = useState(false)
  const [locale, setLocale] = useState<EnabledLocale>('en')
  const [mobile, setMobile] = useState(false)
  const [mount, setMount] = useState<HTMLElement | null>(null)
  return <div className="sp-destination-preview-control">
    <Dialog.Root open={open} onOpenChange={value => { setOpen(value); if (!value) setMount(null) }} modal>
      <Dialog.Trigger type="button" className="sp-btn"><Eye size={16}/>Preview unsaved destination</Dialog.Trigger>
      <Dialog.Portal><Dialog.Backdrop className="sp-destination-preview-backdrop"/><Dialog.Popup className="sp-destination-preview-dialog" initialFocus finalFocus>
        <header className="sp-destination-preview-toolbar">
          <Dialog.Title>Unsaved destination preview</Dialog.Title>
          <label>Preview language<select value={locale} onChange={event => { const value = ENABLED_LOCALES.find(entry => entry === event.target.value); if (value) setLocale(value) }}>{ENABLED_LOCALES.map(value => <option key={value} value={value}>{LOCALE_LABELS[value]}</option>)}</select></label>
          <button type="button" className="sp-btn" aria-pressed={mobile} onClick={() => setMobile(value => !value)}>{mobile ? 'Desktop width' : 'Mobile width'}</button>
          <Dialog.Close type="button" className="sp-btn" aria-label="Close preview"><X size={18}/></Dialog.Close>
        </header>
        <Dialog.Description>Read-only current form. Nothing is saved or published. Shared template text, section visibility and order use the current published CMS configuration.</Dialog.Description>
        <div className="sp-destination-preview-canvas"><iframe className={mobile ? 'sp-destination-preview-frame is-mobile' : 'sp-destination-preview-frame'} title="Read-only unsaved destination" sandbox="allow-same-origin" srcDoc={frameDocument} onLoad={event => {
          const frame = event.currentTarget
          const doc = frame.contentDocument
          if (!doc) return
          // Reuse the actual loaded project CSS inside an actual mobile/desktop viewport.
          // User data is rendered by React through a portal, never interpolated into HTML.
          frame.ownerDocument.querySelectorAll('link[rel="stylesheet"], style').forEach(node => doc.head.appendChild(node.cloneNode(true)))
          doc.body.className = frame.ownerDocument.body.className
          setMount(doc.body)
        }}/></div>
        {mount && createPortal(<DestinationPreviewContent item={item} tours={tours} locale={locale}/>, mount)}
      </Dialog.Popup></Dialog.Portal>
    </Dialog.Root>
  </div>
}
