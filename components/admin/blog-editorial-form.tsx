'use client'

import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from 'lucide-react'
import type { BlogEditorial, BlogGuideSection } from '@/data/types'
import { BLOG_GUIDE_ICONS } from '@/lib/blog-editorial'
import { moveTranslationRow, removeTranslationRow } from '@/lib/catalogue-translations'
import { AdminText, Card } from './admin-ui'
import { ImageField } from './image-field'
import { TourCtaPicker } from './tour-cta-picker'
import { TranslatedInput, TranslatedTextarea, useContentLanguage } from './content-language-tabs'
import { SharedSelect } from '../shared-select'
import { useAdminLocale } from './admin-locale'

type Props = { value: BlogEditorial; onChange: (value: BlogEditorial) => void }

const move = <T,>(items: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function BlockHeader({ index, count, title, prefix, onMove, onRemove }: {
  index: number
  count: number
  title: string
  prefix: string
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const context = useContentLanguage()
  const shift = (to: number) => {
    context?.setTranslations((current) => moveTranslationRow(current, prefix, index, to))
    onMove(to)
  }
  const remove = () => {
    context?.setTranslations((current) => removeTranslationRow(current, prefix, index))
    onRemove()
  }
  return <header className="sp-blog-block-head">
    <span>{String(index + 1).padStart(2, '0')}</span>
    <strong>{title}</strong>
    <div className="sp-blog-block-actions">
      <button type="button" onClick={() => shift(index - 1)} disabled={index === 0} aria-label="Move up" title="Move up"><ArrowUp /></button>
      <button type="button" onClick={() => shift(index + 1)} disabled={index === count - 1} aria-label="Move down" title="Move down"><ArrowDown /></button>
      <button type="button" className="danger" onClick={remove} aria-label="Remove" title="Remove"><Trash2 /></button>
    </div>
  </header>
}

function StringRows({ values, prefix, label, placeholder, onChange }: {
  values: readonly string[]
  prefix: string
  label: string
  placeholder: string
  onChange: (values: string[]) => void
}) {
  const context = useContentLanguage()
  return <div className="sp-form">
    {values.map((value, index) => <div className="sp-blog-inline-row" key={`${prefix}-${index}`}>
      <label>{label} {index + 1}<TranslatedTextarea field={`${prefix}.${index}`} value={value} rows={2} placeholder={placeholder} onChange={(event) => onChange(values.map((entry, position) => position === index ? event.target.value : entry))} /></label>
      <button type="button" className="sp-icon-btn danger" onClick={() => {
        context?.setTranslations((current) => removeTranslationRow(current, prefix, index))
        onChange(values.filter((_, position) => position !== index))
      }} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} title="Remove"><Trash2 size={16} /></button>
    </div>)}
    <button type="button" className="sp-btn" onClick={() => onChange([...values, ''])}><Plus size={16} />Add {label.toLowerCase()}</button>
  </div>
}

export function BlogEditorialForm({ value, onChange }: Props) {
  const ar = useAdminLocale() === 'ar'
  const facts = value.facts ?? []
  const links = value.sidebarLinks ?? []
  const sections = value.sections ?? []
  const tips = value.tips ?? []
  const checklist = value.checklist ?? []
  const guideAnchorOptions = [
    ...sections.map((section) => ({ value: `#${section.id}`, label: `${section.number} · ${section.heading || section.id}` })),
    ...(tips.length || checklist.length ? [{ value: '#tips', label: ar ? 'النصائح' : 'Tips' }] : []),
    ...(checklist.length ? [{ value: '#checklist', label: ar ? 'قائمة التجهيز' : 'Checklist' }] : []),
  ]
  const set = <K extends keyof BlogEditorial>(key: K, next: BlogEditorial[K]) => onChange({ ...value, [key]: next })

  return <>
    <Card title={<AdminText en="Article hero" ar="واجهة المقال" />} sub={<AdminText en="The same cinematic hero used by the current public story design." ar="نفس واجهة المقال السينمائية المستخدمة حاليًا." />}>
      <div className="sp-form">
        <ImageField value={value.heroImage ?? ''} onChange={(heroImage) => set('heroImage', heroImage)} preview="wide" previewAlt={value.heroAlt} linkLabel={{ en: 'Hero image URL', ar: 'رابط صورة الواجهة' }} uploadLabel={{ en: 'Upload hero image', ar: 'رفع صورة الواجهة' }} />
        <div className="sp-form-2">
          <label><AdminText en="Hero alt text" ar="النص البديل للصورة" /><TranslatedInput field="editorial.heroAlt" value={value.heroAlt ?? ''} onChange={(event) => set('heroAlt', event.target.value)} /></label>
          <label><AdminText en="Reading time" ar="مدة القراءة" /><TranslatedInput field="editorial.readTime" value={value.readTime ?? ''} placeholder="e.g. 6 min read" onChange={(event) => set('readTime', event.target.value)} /></label>
        </div>
        <label><AdminText en="Hero introduction" ar="مقدمة الواجهة" /><TranslatedTextarea field="editorial.heroDescription" value={value.heroDescription ?? ''} rows={3} onChange={(event) => set('heroDescription', event.target.value)} /></label>
      </div>
    </Card>

    <Card title={<AdminText en="At-a-glance facts" ar="معلومات سريعة" />} sub={<AdminText en="Compact fact cards displayed directly below the hero." ar="كروت المعلومات المختصرة أسفل الواجهة مباشرة." />}>
      <div className="sp-form">
        <div className="sp-repeat-list compact">{facts.map((fact, index) => <article className="sp-repeat-card" key={`fact-${index}`}>
          <BlockHeader index={index} count={facts.length} title={fact.label || `Fact ${index + 1}`} prefix="editorial.facts" onMove={(to) => set('facts', move(facts, index, to))} onRemove={() => set('facts', facts.filter((_, position) => position !== index))} />
          <label><AdminText en="Icon" ar="الأيقونة" /><SharedSelect value={fact.icon} onChange={(icon) => set('facts', facts.map((entry, position) => position === index ? { ...entry, icon } : entry))} locale={ar ? 'ar' : 'en'} options={BLOG_GUIDE_ICONS.map((icon) => ({ value: icon, label: icon }))} /></label>
          <label><AdminText en="Label" ar="العنوان الصغير" /><TranslatedInput field={`editorial.facts.${index}.label`} value={fact.label} onChange={(event) => set('facts', facts.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} /></label>
          <label><AdminText en="Value" ar="القيمة" /><TranslatedInput field={`editorial.facts.${index}.value`} value={fact.value} onChange={(event) => set('facts', facts.map((entry, position) => position === index ? { ...entry, value: event.target.value } : entry))} /></label>
        </article>)}</div>
        <button type="button" className="sp-btn" onClick={() => set('facts', [...facts, { icon: 'Compass', label: '', value: '' }])}><Plus size={16} /><AdminText en="Add fact" ar="إضافة معلومة" /></button>
      </div>
    </Card>

    <Card title={<AdminText en="Article sections" ar="سكاشن المقال" />} sub={<AdminText en="Every section keeps the current editorial typography, image layouts and responsive behavior." ar="كل سكشن يحتفظ بتصميم النصوص والصور والـresponsive الحالي." />}>
      <div className="sp-form">
        <div className="sp-repeat-list">{sections.map((section, index) => <article className="sp-repeat-card" key={`section-${index}`}>
          <BlockHeader index={index} count={sections.length} title={section.heading || `Section ${index + 1}`} prefix="editorial.sections" onMove={(to) => set('sections', move(sections, index, to))} onRemove={() => set('sections', sections.filter((_, position) => position !== index))} />
          <div className="sp-form-2">
            <label><AdminText en="Anchor ID" ar="معرف السكشن" /><input dir="ltr" value={section.id} placeholder="what-to-wear" onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') } : entry))} /></label>
            <label><AdminText en="Section number" ar="رقم السكشن" /><input dir="ltr" value={section.number} placeholder="01" onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, number: event.target.value } : entry))} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Eyebrow" ar="العنوان التمهيدي" /><TranslatedInput field={`editorial.sections.${index}.eyebrow`} value={section.eyebrow} onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, eyebrow: event.target.value } : entry))} /></label>
            <label><AdminText en="Heading" ar="العنوان" /><TranslatedInput field={`editorial.sections.${index}.heading`} value={section.heading} onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, heading: event.target.value } : entry))} /></label>
          </div>
          <label><AdminText en="Lead paragraph (optional)" ar="الفقرة الافتتاحية (اختياري)" /><TranslatedTextarea field={`editorial.sections.${index}.lede`} value={section.lede ?? ''} rows={3} onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, lede: event.target.value } : entry))} /></label>
          <StringRows values={section.copy ?? []} prefix={`editorial.sections.${index}.copy`} label="Paragraph" placeholder="Article paragraph" onChange={(copy) => set('sections', sections.map((entry, position) => position === index ? { ...entry, copy } : entry))} />
          <StringRows values={section.list ?? []} prefix={`editorial.sections.${index}.list`} label="List item" placeholder="Practical point" onChange={(list) => set('sections', sections.map((entry, position) => position === index ? { ...entry, list } : entry))} />
          <ImageField value={section.image?.src ?? ''} onChange={(src) => set('sections', sections.map((entry, position) => position === index ? { ...entry, image: src ? { src, alt: entry.image?.alt ?? '', caption: entry.image?.caption } : undefined } : entry))} preview="wide" previewAlt={section.image?.alt} linkLabel={{ en: 'Section image URL (optional)', ar: 'رابط صورة السكشن (اختياري)' }} uploadLabel={{ en: 'Upload section image', ar: 'رفع صورة السكشن' }} />
          {section.image?.src ? <div className="sp-form-2">
            <label><AdminText en="Image alt text" ar="النص البديل للصورة" /><TranslatedInput field={`editorial.sections.${index}.image.alt`} value={section.image.alt} onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, image: { ...entry.image!, alt: event.target.value } } : entry))} /></label>
            <label><AdminText en="Image caption" ar="وصف الصورة" /><TranslatedInput field={`editorial.sections.${index}.image.caption`} value={section.image.caption ?? ''} onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, image: { ...entry.image!, caption: event.target.value } } : entry))} /></label>
          </div> : null}
          <label className="sp-check"><input type="checkbox" checked={section.reverse === true} onChange={(event) => set('sections', sections.map((entry, position) => position === index ? { ...entry, reverse: event.target.checked } : entry))} /><AdminText en="Reverse image and text layout" ar="عكس اتجاه الصورة والنص" /></label>
        </article>)}</div>
        <button type="button" className="sp-btn primary" onClick={() => set('sections', [...sections, { id: `section-${sections.length + 1}`, number: String(sections.length + 1).padStart(2, '0'), eyebrow: '', heading: '', copy: [] } satisfies BlogGuideSection])}><Plus size={16} /><AdminText en="Add article section" ar="إضافة سكشن" /></button>
      </div>
    </Card>

    <Card title={<AdminText en="Guide navigation & sidebar" ar="التنقل والبطاقة الجانبية" />} sub={<AdminText en="Links point to section anchors; the optional card links to a real tour." ar="الروابط تشير لسكاشن المقال، والبطاقة الاختيارية ترتبط برحلة حقيقية." />}>
      <div className="sp-form">
        <div className="sp-builder-subhead"><div><strong><AdminText en="In this guide links" ar="روابط محتويات المقال" /></strong><small><AdminText en="Keep labels short; every anchor must match a section ID." ar="اجعل العناوين مختصرة، وكل رابط يجب أن يطابق معرف سكشن." /></small></div><button type="button" className="sp-btn" onClick={() => set('sidebarLinks', sections.map((section) => ({ href: `#${section.id}`, label: section.eyebrow || section.heading }))) }><ListChecks size={16} /><AdminText en="Sync from sections" ar="مزامنة من السكاشن" /></button></div>
        <div className="sp-repeat-list compact">{links.map((link, index) => <article className="sp-repeat-card" key={`link-${index}`}>
          <BlockHeader index={index} count={links.length} title={link.label || `Link ${index + 1}`} prefix="editorial.sidebarLinks" onMove={(to) => set('sidebarLinks', move(links, index, to))} onRemove={() => set('sidebarLinks', links.filter((_, position) => position !== index))} />
          <label><AdminText en="Section anchor" ar="رابط السكشن" /><SharedSelect value={link.href} onChange={(href) => set('sidebarLinks', links.map((entry, position) => position === index ? { ...entry, href } : entry))} locale={ar ? 'ar' : 'en'} options={guideAnchorOptions} /></label>
          <label><AdminText en="Navigation label" ar="اسم الرابط" /><TranslatedInput field={`editorial.sidebarLinks.${index}.label`} value={link.label} onChange={(event) => set('sidebarLinks', links.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} /></label>
        </article>)}</div>
        <button type="button" className="sp-btn" disabled={!guideAnchorOptions.length} onClick={() => set('sidebarLinks', [...links, { href: guideAnchorOptions[0]?.value ?? '', label: '' }])}><Plus size={16} /><AdminText en="Add guide link" ar="إضافة رابط" /></button>
        <hr className="sp-form-divider" />
        <div className="sp-form-2">
          <label><AdminText en="Sidebar card label (optional)" ar="عنوان البطاقة الجانبية" /><TranslatedInput field="editorial.sidebarAction.label" value={value.sidebarAction?.label ?? ''} onChange={(event) => set('sidebarAction', { label: event.target.value, heading: value.sidebarAction?.heading ?? '', tourSlug: value.sidebarAction?.tourSlug ?? '' })} /></label>
          <label><AdminText en="Sidebar card heading" ar="نص البطاقة الجانبية" /><TranslatedInput field="editorial.sidebarAction.heading" value={value.sidebarAction?.heading ?? ''} onChange={(event) => set('sidebarAction', { label: value.sidebarAction?.label ?? '', heading: event.target.value, tourSlug: value.sidebarAction?.tourSlug ?? '' })} /></label>
        </div>
        <TourCtaPicker value={value.sidebarAction?.tourSlug ?? ''} onChange={(tourSlug) => set('sidebarAction', { label: value.sidebarAction?.label ?? '', heading: value.sidebarAction?.heading ?? '', tourSlug })} />
        <button type="button" className="sp-btn" onClick={() => set('sidebarAction', undefined)}><Trash2 size={16} /><AdminText en="Clear sidebar card" ar="مسح البطاقة الجانبية" /></button>
      </div>
    </Card>

    <Card title={<AdminText en="Tips, quote & checklist" ar="النصائح والاقتباس والقائمة" />} sub={<AdminText en="Practical content rendered with the existing guide cards and checklist design." ar="محتوى عملي يظهر بنفس كروت الدليل وتصميم القائمة الحالي." />}>
      <div className="sp-form">
        <p className="sp-builder-note"><AdminText en="Tip cards appear in the section whose anchor ID is “essentials”, matching the current article template." ar="تظهر كروت النصائح داخل السكشن الذي معرفه essentials، مثل تصميم المقال الحالي." /></p>
        <div className="sp-repeat-list compact">{tips.map((tip, index) => <article className="sp-repeat-card" key={`tip-${index}`}>
          <BlockHeader index={index} count={tips.length} title={tip.title || `Tip ${index + 1}`} prefix="editorial.tips" onMove={(to) => set('tips', move(tips, index, to))} onRemove={() => set('tips', tips.filter((_, position) => position !== index))} />
          <label><AdminText en="Icon" ar="الأيقونة" /><SharedSelect value={tip.icon} onChange={(icon) => set('tips', tips.map((entry, position) => position === index ? { ...entry, icon } : entry))} locale={ar ? 'ar' : 'en'} options={BLOG_GUIDE_ICONS.map((icon) => ({ value: icon, label: icon }))} /></label>
          <label><AdminText en="Title" ar="العنوان" /><TranslatedInput field={`editorial.tips.${index}.title`} value={tip.title} onChange={(event) => set('tips', tips.map((entry, position) => position === index ? { ...entry, title: event.target.value } : entry))} /></label>
          <label><AdminText en="Copy" ar="النص" /><TranslatedTextarea field={`editorial.tips.${index}.copy`} value={tip.copy} rows={3} onChange={(event) => set('tips', tips.map((entry, position) => position === index ? { ...entry, copy: event.target.value } : entry))} /></label>
        </article>)}</div>
        <button type="button" className="sp-btn" onClick={() => set('tips', [...tips, { icon: 'Compass', title: '', copy: '' }])}><Plus size={16} /><AdminText en="Add tip card" ar="إضافة نصيحة" /></button>
        <label><AdminText en="Pull quote (optional)" ar="اقتباس بارز (اختياري)" /><TranslatedTextarea field="editorial.quote" value={value.quote ?? ''} rows={3} onChange={(event) => set('quote', event.target.value)} /></label>
        <ImageField value={value.wideImage?.src ?? ''} onChange={(src) => set('wideImage', src ? { src, alt: value.wideImage?.alt ?? '', caption: value.wideImage?.caption } : undefined)} preview="wide" previewAlt={value.wideImage?.alt} linkLabel={{ en: 'Wide article image (optional)', ar: 'صورة عريضة داخل المقال' }} uploadLabel={{ en: 'Upload wide image', ar: 'رفع صورة عريضة' }} />
        {value.wideImage?.src ? <div className="sp-form-2"><label><AdminText en="Wide image alt text" ar="النص البديل للصورة" /><TranslatedInput field="editorial.wideImage.alt" value={value.wideImage.alt} onChange={(event) => set('wideImage', { ...value.wideImage!, alt: event.target.value })} /></label><label><AdminText en="Wide image caption" ar="وصف الصورة" /><TranslatedInput field="editorial.wideImage.caption" value={value.wideImage.caption ?? ''} onChange={(event) => set('wideImage', { ...value.wideImage!, caption: event.target.value })} /></label></div> : null}
        <div className="sp-form-2">
          <label><AdminText en="Checklist eyebrow" ar="العنوان التمهيدي للقائمة" /><TranslatedInput field="editorial.checklistEyebrow" value={value.checklistEyebrow ?? 'Before you go'} onChange={(event) => set('checklistEyebrow', event.target.value)} /></label>
          <label><AdminText en="Checklist heading" ar="عنوان القائمة" /><TranslatedInput field="editorial.checklistHeading" value={value.checklistHeading ?? 'Your trip, simplified'} onChange={(event) => set('checklistHeading', event.target.value)} /></label>
        </div>
        <div className="sp-repeat-list">{checklist.map((item, index) => <article className="sp-repeat-card" key={`check-${index}`}>
          <BlockHeader index={index} count={checklist.length} title={item.title || `Checklist item ${index + 1}`} prefix="editorial.checklist" onMove={(to) => set('checklist', move(checklist, index, to))} onRemove={() => set('checklist', checklist.filter((_, position) => position !== index))} />
          <label><AdminText en="Title" ar="العنوان" /><TranslatedInput field={`editorial.checklist.${index}.title`} value={item.title} onChange={(event) => set('checklist', checklist.map((entry, position) => position === index ? { ...entry, title: event.target.value } : entry))} /></label>
          <label><AdminText en="Detail" ar="التفاصيل" /><TranslatedTextarea field={`editorial.checklist.${index}.detail`} value={item.detail} rows={2} onChange={(event) => set('checklist', checklist.map((entry, position) => position === index ? { ...entry, detail: event.target.value } : entry))} /></label>
        </article>)}</div>
        <button type="button" className="sp-btn" onClick={() => set('checklist', [...checklist, { title: '', detail: '' }])}><Plus size={16} /><AdminText en="Add checklist item" ar="إضافة عنصر للقائمة" /></button>
      </div>
    </Card>

    <Card title={<AdminText en="Final journey call to action" ar="دعوة الرحلة النهائية" />} sub={<AdminText en="The full-width image CTA shown before related stories." ar="دعوة الإجراء بعرض الصفحة قبل المقالات المرتبطة." />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Eyebrow" ar="العنوان التمهيدي" /><TranslatedInput field="editorial.cta.eyebrow" value={value.cta?.eyebrow ?? ''} onChange={(event) => set('cta', { eyebrow: event.target.value, heading: value.cta?.heading ?? '', copy: value.cta?.copy ?? '', tourSlug: value.cta?.tourSlug, tourLabel: value.cta?.tourLabel, customLabel: value.cta?.customLabel })} /></label>
          <label><AdminText en="Heading" ar="العنوان" /><TranslatedInput field="editorial.cta.heading" value={value.cta?.heading ?? ''} onChange={(event) => set('cta', { eyebrow: value.cta?.eyebrow ?? '', heading: event.target.value, copy: value.cta?.copy ?? '', tourSlug: value.cta?.tourSlug, tourLabel: value.cta?.tourLabel, customLabel: value.cta?.customLabel })} /></label>
        </div>
        <label><AdminText en="Copy" ar="الوصف" /><TranslatedTextarea field="editorial.cta.copy" value={value.cta?.copy ?? ''} rows={3} onChange={(event) => set('cta', { eyebrow: value.cta?.eyebrow ?? '', heading: value.cta?.heading ?? '', copy: event.target.value, tourSlug: value.cta?.tourSlug, tourLabel: value.cta?.tourLabel, customLabel: value.cta?.customLabel })} /></label>
        <TourCtaPicker value={value.cta?.tourSlug ?? ''} onChange={(tourSlug) => set('cta', { eyebrow: value.cta?.eyebrow ?? '', heading: value.cta?.heading ?? '', copy: value.cta?.copy ?? '', tourSlug, tourLabel: value.cta?.tourLabel, customLabel: value.cta?.customLabel })} />
        <div className="sp-form-2">
          <label><AdminText en="Tour button text" ar="نص زر الرحلة" /><TranslatedInput field="editorial.cta.tourLabel" value={value.cta?.tourLabel ?? ''} placeholder="View the tour" onChange={(event) => set('cta', { eyebrow: value.cta?.eyebrow ?? '', heading: value.cta?.heading ?? '', copy: value.cta?.copy ?? '', tourSlug: value.cta?.tourSlug, tourLabel: event.target.value, customLabel: value.cta?.customLabel })} /></label>
          <label><AdminText en="Planning button text" ar="نص زر التخطيط" /><TranslatedInput field="editorial.cta.customLabel" value={value.cta?.customLabel ?? ''} placeholder="Build my own trip" onChange={(event) => set('cta', { eyebrow: value.cta?.eyebrow ?? '', heading: value.cta?.heading ?? '', copy: value.cta?.copy ?? '', tourSlug: value.cta?.tourSlug, tourLabel: value.cta?.tourLabel, customLabel: event.target.value })} /></label>
        </div>
        <button type="button" className="sp-btn" onClick={() => set('cta', undefined)}><Trash2 size={16} /><AdminText en="Clear final CTA" ar="مسح الدعوة النهائية" /></button>
      </div>
    </Card>
  </>
}
