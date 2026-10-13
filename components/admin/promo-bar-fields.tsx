'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { TranslatedInput, TranslatedTextarea } from './content-language-tabs'
import { TourCtaPicker } from './tour-cta-picker'
import { BarIcons } from '@/components/promo-bar-icons'
import { MAX_PROMO_BAR_ICONS, PROMO_BAR_ICONS } from '@/lib/promo-bar-icons'
import { offerHref } from '@/lib/special-offers'
import type { CampaignContent } from '@/lib/marketing-campaigns'

/**
 * Dedicated Promotional Bars form (Top Bar / Footer Bar). Binds to the same
 * Offer + campaign records as every other workflow — only the placement
 * checkboxes are bar-specific, so catalogue fields and translations are
 * preserved exactly.
 */
export function PromoBarFields({
  title, setTitle, copy, setCopy,
  campaign, setCampaign,
  showTop, showFooter, setPlacement,
}: {
  title: string; setTitle: (v: string) => void;
  copy: string; setCopy: (v: string) => void;
  campaign: CampaignContent; setCampaign: (v: CampaignContent) => void;
  showTop: boolean; showFooter: boolean; setPlacement: (which: 'top' | 'footer', on: boolean) => void;
}) {
  const ar = useAdminLocale() === 'ar'
  const [iconQuery, setIconQuery] = useState('')
  const pickTour = (slug: string) => {
    if (!slug) {
      setCampaign({ ...campaign, ctaTourSlug: '' })
      return
    }
    setCampaign({ ...campaign, ctaTourSlug: slug, ctaHref: offerHref({ slug, tourSlug: slug }) })
  }
  const icons = campaign.icons
  const message = title.trim() || (ar ? 'نص تجريبي للشريط الترويجي' : 'Sample promotional message')
  const action = campaign.ctaLabel.trim() || (ar ? 'شاهد العروض' : 'View offers')
  const available = useMemo(() => {
    const query = iconQuery.trim().toLowerCase()
    const remaining = PROMO_BAR_ICONS.filter((id) => !icons.includes(id))
    if (!query) return remaining
    return remaining.filter((id) => id.toLowerCase().includes(query))
  }, [iconQuery, icons])
  const setIcons = (next: string[]) => setCampaign({ ...campaign, icons: next })
  return <>
    <fieldset><legend><AdminText en="Show this bar in" ar="إظهار الشريط في" /></legend>
      <label className="sp-check"><input type="checkbox" checked={showTop} onChange={(e) => setPlacement('top', e.target.checked)} /><AdminText en="Top promotional bar" ar="الشريط الترويجي العلوي" /></label>
      <label className="sp-check"><input type="checkbox" checked={showFooter} onChange={(e) => setPlacement('footer', e.target.checked)} /><AdminText en="Footer promotional bar" ar="الشريط الترويجي للفوتر" /></label>
      <small><AdminText en="The top bar rotates through every matching message; the footer shows the first matching message by display order. Unpublished, expired or not-yet-started bars never appear." ar="يتناوب الشريط العلوي على كل الرسائل المطابقة؛ ويعرض الفوتر أول رسالة مطابقة حسب الترتيب. لا تظهر الأشرطة غير المنشورة أو المنتهية أو التي لم تبدأ بعد." /></small>
    </fieldset>
    <label><AdminText en="Promotional message" ar="الرسالة الترويجية" /><TranslatedInput field="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ar ? 'مثال: خصم 20% على رحلات النيل' : 'e.g. 20% off Nile cruises'} /></label>
    <label><AdminText en="Supporting text (optional)" ar="نص مساند (اختياري)" /><TranslatedTextarea field="copy" rows={2} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder={ar ? 'يظهر في الفوتر ومعاينة العرض' : 'Shown in the footer bar and offer preview'} /></label>
    <div className="sp-form-2"><label><AdminText en="Button text" ar="نص الزر" /><TranslatedInput field="campaign.ctaLabel" value={campaign.ctaLabel} onChange={(e) => setCampaign({ ...campaign, ctaLabel: e.target.value })} placeholder="View offers" /></label><label><AdminText en="Button destination" ar="رابط الزر" /><input dir="ltr" value={campaign.ctaHref} onChange={(e) => setCampaign({ ...campaign, ctaHref: e.target.value })} placeholder="/special-offers" /><small><AdminText en="Website path or HTTPS URL." ar="مسار داخل الموقع أو رابط HTTPS." /></small></label></div>
    <TourCtaPicker value={campaign.ctaTourSlug} onChange={pickTour} />
    <fieldset><legend><AdminText en="Icons" ar="الأيقونات" /></legend>
      <div className="sp-form-2">
        <label><AdminText en="Search icons" ar="ابحث في الأيقونات" /><input value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="ticket, star..." /></label>
        <label><AdminText en="Add icon" ar="إضافة أيقونة" />
          <select
            value=""
            onChange={(e) => {
              const value = e.target.value
              if (!value || icons.includes(value) || icons.length >= MAX_PROMO_BAR_ICONS) return
              setIcons([...icons, value])
            }}
          >
            <option value="">{ar ? 'اختر أيقونة' : 'Choose an icon'}</option>
            {available.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </div>
      {icons.length > 0 ? (
        <ul className="sp-icon-list">
          {icons.map((id, index) => (
            <li key={id}>
              <span className="sp-icon-list-icon"><BarIcons ids={[id]} size={18} /></span>
              <strong>{id}</strong>
              <span className="sp-icon-list-actions">
                <button type="button" className="sp-icon-btn" aria-label={ar ? 'نقل للأعلى' : 'Move up'} disabled={index === 0} onClick={() => setIcons(icons.map((icon, i) => (i === index - 1 ? id : i === index ? icons[index - 1] : icon)))}><ChevronUp size={16} /></button>
                <button type="button" className="sp-icon-btn" aria-label={ar ? 'نقل للأسفل' : 'Move down'} disabled={index === icons.length - 1} onClick={() => setIcons(icons.map((icon, i) => (i === index + 1 ? id : i === index ? icons[index + 1] : icon)))}><ChevronDown size={16} /></button>
                <button type="button" className="sp-icon-btn" aria-label={ar ? `حذف ${id}` : `Remove ${id}`} onClick={() => setIcons(icons.filter((icon) => icon !== id))}><Trash2 size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p><AdminText en="No icons. The bar renders text and button only." ar="بدون أيقونات. يظهر الشريط النص والزر فقط." /></p>
      )}
      <small><AdminText en={`Identifiers come from the project icon library. Order is saved and rendered left-to-right (right-to-left in Arabic). At most ${MAX_PROMO_BAR_ICONS} icons.`} ar={`المعرّفات من مكتبة أيقونات المشروع. يُحفظ الترتيب ويُعرض من اليسار لليمين (ومن اليمين لليسار في العربية). بحد أقصى ${MAX_PROMO_BAR_ICONS} أيقونات.`} /></small>
    </fieldset>
    <p className="sp-group-title"><AdminText en="Preview" ar="معاينة" /></p>
    <div style={{ display: 'grid', gap: 10 }} aria-hidden="true">
      {showTop && <div className="promo"><span className="promo-icons"><BarIcons ids={icons} /></span><strong>{message}</strong><a tabIndex={-1}>{action}</a></div>}
      {showFooter && <div className="access-strip"><span className="promo-icons"><BarIcons ids={icons} size={20} /></span><p>{copy.trim() || message}</p><a tabIndex={-1}>{action}</a></div>}
      {!showTop && !showFooter && <p><AdminText en="Select a placement above to preview this bar." ar="اختر موضعًا أعلاه لمعاينة الشريط." /></p>}
    </div>
  </>
}
