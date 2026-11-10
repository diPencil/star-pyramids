import type { ReactNode } from 'react'
import { sanitizeTourHtml } from '@/lib/tours/tour-rich-text'
import './tour-rich-text.css'

/** Only this component can turn narrative HTML into DOM. Plain markup-looking strings stay text. */
export function TourRichText({ value, format, className, prefix }: { value: string; format?: string; className?: string; prefix?: ReactNode }) {
  if (format !== 'html-v1') return <p className={className}>{prefix}{value}</p>
  let html: string
  try { html = sanitizeTourHtml(value) }
  catch { return <p className={className}>{prefix}{value}</p> }
  return <div className={className}>{prefix}<div className="tour-rich-text" dangerouslySetInnerHTML={{ __html: html }}/></div>
}
