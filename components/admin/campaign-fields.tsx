'use client'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { campaignPlacements, type CampaignContent } from '@/lib/marketing-campaigns'
import { TranslatedInput, TranslatedTextarea } from './content-language-tabs'

const arLabels = { offers: 'صفحة العروض الخاصة', home: 'عروض الرئيسية', 'trips-sidebar': 'سايدبار فلاتر الرحلات', 'blog-sidebar': 'سايدبار دليل المدونة' }
const labels = { offers: 'Special Offers page', home: 'Homepage offers', 'trips-sidebar': 'Trips — Filters sidebar', 'blog-sidebar': 'Blog — In this guide sidebar' }
export function CampaignFields({ value, onChange }: { value: CampaignContent; onChange(value: CampaignContent): void }) {
  const ar = useAdminLocale() === 'ar'
  const set = (key: keyof CampaignContent, text: string) => onChange({ ...value, [key]: text })
  return <fieldset className="campaign-admin-fields"><legend><AdminText en="Campaign page and promotion" ar="صفحة الحملة وأماكن ظهورها"/></legend>
    <label><AdminText en="Full description" ar="الوصف الكامل"/><TranslatedTextarea field="campaign.body" rows={6} value={value.body} onChange={e => set('body', e.target.value)}/><small><AdminText en="Separate paragraphs with an empty line." ar="افصل بين الفقرات بسطر فارغ."/></small></label>
    <label><AdminText en="Terms and conditions" ar="الشروط والأحكام"/><TranslatedTextarea field="campaign.terms" rows={4} value={value.terms} onChange={e => set('terms', e.target.value)}/></label>
    <div className="sp-form-2"><label><AdminText en="Button text" ar="نص الزر"/><TranslatedInput field="campaign.ctaLabel" value={value.ctaLabel} onChange={e => set('ctaLabel', e.target.value)} placeholder="Plan my trip"/></label><label><AdminText en="Button destination" ar="رابط الزر"/><input dir="ltr" value={value.ctaHref} onChange={e => set('ctaHref', e.target.value)} placeholder="/make-your-trip"/><small><AdminText en="Website path or HTTPS URL. Leave blank to contact the team about this campaign." ar="مسار داخل الموقع أو رابط HTTPS. اتركه فارغًا للتواصل بشأن الحملة."/></small></label></div>
    <label><AdminText en="Price label (optional)" ar="وصف السعر (اختياري)"/><TranslatedInput field="campaign.priceLabel" value={value.priceLabel} onChange={e => set('priceLabel', e.target.value)} placeholder="Starting from"/></label>
    <fieldset><legend><AdminText en="Show this campaign in" ar="إظهار الحملة في"/></legend>{campaignPlacements.map(p => <label className="sp-check" key={p}><input type="checkbox" checked={value.placements.includes(p)} onChange={e => onChange({ ...value, placements: e.target.checked ? [...value.placements, p] : value.placements.filter(x => x !== p) })}/>{ar ? arLabels[p] : labels[p]}</label>)}<small><AdminText en="Published campaigns follow their start/end dates. Each sidebar shows the first matching campaign by display order." ar="تظهر الحملات المنشورة حسب مواعيد البداية والنهاية. يعرض كل سايدبار أول حملة مناسبة حسب ترتيب العرض."/></small></fieldset>
  </fieldset>
}
