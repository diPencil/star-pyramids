'use client'
import { useState } from 'react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { SharedSelect } from '../shared-select'
import { useDbToursStatus } from '@/lib/tours-client'

/**
 * Shared tour picker for campaign CTA destinations (Marketing Campaign and
 * Promotional Bars workflows). Selecting a tour stores its slug — the public
 * URL is always resolved live at render time.
 */
export function TourCtaPicker({ value, onChange }: { value: string; onChange: (slug: string) => void }) {
  const ar = useAdminLocale() === 'ar'
  const [tourCategory, setTourCategory] = useState('all')
  const tourStatus = useDbToursStatus([], { includeNew: true })
  const liveTours = tourStatus.data ?? []
  return <>
    <div className="sp-form-2">
      <label><AdminText en="Tour type" ar="نوع الرحلة" /><SharedSelect value={tourCategory} onChange={next => { setTourCategory(next); onChange('') }} locale={ar ? 'ar' : 'en'} options={[{ value: 'all', label: ar ? 'كل الأنواع' : 'All tour types' }, { value: 'one-day-tours', label: 'One-day tours' }, { value: 'multi-days-tours', label: 'Multi-day packages' }, { value: 'nile-cruises', label: 'Nile cruises' }, { value: 'shore-excursions', label: 'Shore excursions' }]} /></label>
      <label><AdminText en="Link to an existing tour (optional)" ar="اربط برحلة موجودة (اختياري)" /><SharedSelect value={value} onChange={onChange} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={[{ value: '', label: ar ? 'بدون ربط — رابط مخصص' : 'No linked tour — custom URL' }, ...liveTours.filter(t => tourCategory === 'all' || t.category === tourCategory).map((t) => ({ value: t.slug, label: `${t.title} - $${t.price}`, text: t.title }))]} /></label>
    </div>
    {tourStatus.loading && <p role="status"><AdminText en="Loading tours…" ar="جارٍ تحميل الرحلات…" /></p>}
    {tourStatus.error && <p role="alert">{tourStatus.error} <button type="button" className="sp-btn" onClick={tourStatus.retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></p>}
    <small><AdminText en="A linked tour takes precedence over the custom URL above and is checked live: if the tour is unpublished or removed, visitors fall back to a safe page instead of a broken link. Clear the tour to use the custom URL." ar="الرحلة المرتبطة لها الأولوية على الرابط المخصص أعلاه ويتم التحقق منها لحظيًا: إذا أُلغي نشر الرحلة أو أُزيلت ينتقل الزوار لصفحة آمنة بدل رابط معطل. امسح الرحلة لاستخدام الرابط المخصص."/></small>
  </>
}
