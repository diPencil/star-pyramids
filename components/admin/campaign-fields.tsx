'use client'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { marketingPlacements, type CampaignContent, type CampaignPlacement } from '@/lib/marketing-campaigns'
import { offerHref } from '@/lib/special-offers'
import { TranslatedInput, TranslatedTextarea } from './content-language-tabs'
import { TourCtaPicker } from './tour-cta-picker'

const arLabels: Record<CampaignPlacement, string> = { offers: 'صفحة العروض الخاصة', home: 'عروض الرئيسية', 'top-bar': 'الشريط الترويجي العلوي', 'footer-promo': 'الشريط الترويجي للفوتر', 'trips-sidebar': 'سايدبار فلاتر الرحلات', 'blog-sidebar': 'سايدبار دليل المدونة' }
const labels: Record<CampaignPlacement, string> = { offers: 'Special Offers page', home: 'Homepage offers', 'top-bar': 'Top promotional bar', 'footer-promo': 'Footer promotional bar', 'trips-sidebar': 'Trips — Filters sidebar', 'blog-sidebar': 'Blog — In this guide sidebar' }
export function CampaignFields({ value, onChange, placements = marketingPlacements }: { value: CampaignContent; onChange(value: CampaignContent): void; placements?: readonly CampaignPlacement[] }) {
  const ar = useAdminLocale() === 'ar'
  const set = (key: keyof CampaignContent, text: string) => onChange({ ...value, [key]: text })
  const pickTour = (slug: string) => {
    if (!slug) {
      onChange({ ...value, ctaTourSlug: '' })
      return
    }
    // Store the slug only — the public URL is resolved live at render time,
    // while the saved URL below stays as a visible, editable reference.
    onChange({ ...value, ctaTourSlug: slug, ctaHref: offerHref({ slug, tourSlug: slug }) })
  }
  return <fieldset className="campaign-admin-fields"><legend><AdminText en="Campaign page and promotion" ar="صفحة الحملة وأماكن ظهورها"/></legend>
    <label><AdminText en="Full description" ar="الوصف الكامل"/><TranslatedTextarea field="campaign.body" rows={6} value={value.body} onChange={e => set('body', e.target.value)}/><small><AdminText en="Separate paragraphs with an empty line." ar="افصل بين الفقرات بسطر فارغ."/></small></label>
    <label><AdminText en="Terms and conditions" ar="الشروط والأحكام"/><TranslatedTextarea field="campaign.terms" rows={4} value={value.terms} onChange={e => set('terms', e.target.value)}/></label>
    <div className="sp-form-2"><label><AdminText en="Button text" ar="نص الزر"/><TranslatedInput field="campaign.ctaLabel" value={value.ctaLabel} onChange={e => set('ctaLabel', e.target.value)} placeholder="Plan my trip"/></label><label><AdminText en="Button destination" ar="رابط الزر"/><input dir="ltr" value={value.ctaHref} onChange={e => set('ctaHref', e.target.value)} placeholder="/make-your-trip"/><small><AdminText en="Website path or HTTPS URL. Leave blank to contact the team about this campaign." ar="مسار داخل الموقع أو رابط HTTPS. اتركه فارغًا للتواصل بشأن الحملة."/></small></label></div>
    <TourCtaPicker value={value.ctaTourSlug} onChange={pickTour} />
    <label><AdminText en="Price label (optional)" ar="وصف السعر (اختياري)"/><TranslatedInput field="campaign.priceLabel" value={value.priceLabel} onChange={e => set('priceLabel', e.target.value)} placeholder="Starting from"/></label>
    <fieldset><legend><AdminText en="Show this campaign in" ar="إظهار الحملة في"/></legend>{placements.map(p => <label className="sp-check" key={p}><input type="checkbox" checked={value.placements.includes(p)} onChange={e => onChange({ ...value, placements: e.target.checked ? [...value.placements, p] : value.placements.filter(x => x !== p) })}/>{ar ? arLabels[p] : labels[p]}</label>)}<small><AdminText en="Published campaigns follow their start/end dates. Each sidebar shows the first matching campaign by display order; the top bar rotates through every matching campaign." ar="تظهر الحملات المنشورة حسب مواعيد البداية والنهاية. يعرض كل سايدبار أول حملة مناسبة حسب ترتيب العرض؛ بينما يتناوب الشريط العلوي على كل الحملات المطابقة."/></small></fieldset>
  </fieldset>
}
