'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { ContentLanguageTabs, TranslatedInput, TranslatedTextarea, useContentLanguage, removeContentRow } from '@/components/admin/content-language-tabs'
import { alignTranslationRows, type CatalogueTranslations } from '@/lib/catalogue-translations'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { slugify } from '@/lib/admin-store'
import { invalidateEventsCarsCache, useDbEvents, normalizeEventRow } from '@/lib/events-cars-client'
import { sanitizeEvent } from '@/lib/events'
import { ImageField } from '@/components/admin/image-field'
import { SharedSelect } from '@/components/shared-select'
import { events } from '@/data/content'
import type { Event } from '@/data/types'
import { InternationalPhoneInput } from '@/components/international-phone-input'
import { DateInput } from '@/components/date-input'

type HighlightRow = { title: string; titleAr: string; description: string; descriptionAr: string }
type ProgramRow = { day: string; title: string; description: string }

const cleanSlugInput = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 80)

function RowList<T>({ rows, onChange, render, onAdd, addLabel, prefix }: {
  prefix?: string
  rows: T[]
  onChange: (rows: T[]) => void
  render: (row: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode
  onAdd: () => void
  addLabel: React.ReactNode
}) {
  const language = useContentLanguage()
  const english = !language || language.locale === 'en'
  return (
    <div className="sp-repeat-list">
      {!english && <p className="sp-builder-note">Add or remove items in English, then translate them here.</p>}
      {rows.map((row, index) => (
        <article className="sp-repeat-card" key={index}>
          <header className="sp-repeat-head"><strong>#{index + 1}</strong><button type="button" className="sp-icon-btn danger" disabled={!english} onClick={() => { removeContentRow(language, prefix, index); onChange(rows.filter((_, i) => i !== index)) }} aria-label="Remove row"><Trash2 size={18} /></button></header>
          {render(row, (patch) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r))), index)}
        </article>
      ))}
      <button type="button" className="sp-btn" disabled={!english} onClick={onAdd}><Plus size={15} />{addLabel}</button>
    </div>
  )
}

function StringRows({ rows, onChange, onAdd, placeholder, prefix }: { prefix?: string; rows: string[]; onChange: (rows: string[]) => void; onAdd: React.ReactNode; placeholder?: string }) {
  const language = useContentLanguage()
  const english = !language || language.locale === 'en'
  return (
    <div className="sp-repeat-list">
      {!english && <p className="sp-builder-note">Add or remove items in English, then translate them here.</p>}
      {rows.map((row, index) => (
        <div className="sp-repeat-row" key={index}>
          {prefix ? <TranslatedInput field={`${prefix}.${index}`} value={row} onChange={(e) => onChange(rows.map((r, i) => (i === index ? e.target.value : r)))} placeholder={placeholder} /> : <input value={row} onChange={(e) => onChange(rows.map((r, i) => (i === index ? e.target.value : r)))} placeholder={placeholder} />}
          <button type="button" className="sp-icon-btn danger" disabled={!english} onClick={() => { removeContentRow(language, prefix, index); onChange(rows.filter((_, i) => i !== index)) }} aria-label="Remove row"><Trash2 size={18} /></button>
        </div>
      ))}
      <button type="button" className="sp-btn" disabled={!english} onClick={() => onChange([...rows, ''])}><Plus size={15} />{onAdd}</button>
    </div>
  )
}

function EventForm({ initial, editSlug }: { initial: Event | null; editSlug: string }) {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const dbEvents = useDbEvents(events)

  const editing = Boolean(editSlug)
  const missing = editing && initial === null

  const [translations, setTranslations] = useState<CatalogueTranslations>(initial?.translations ?? {})
  const [title, setTitle] = useState(initial?.title ?? '')
  const [titleAr, setTitleAr] = useState(initial?.titleAr ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [category, setCategory] = useState(initial?.category ?? '')
  const [categoryAr, setCategoryAr] = useState(initial?.categoryAr ?? '')
  const [featured, setFeatured] = useState(Boolean(initial?.featured))
  const [copy, setCopy] = useState(initial?.copy ?? '')
  const [copyAr, setCopyAr] = useState(initial?.copyAr ?? '')
  const [intro, setIntro] = useState(initial?.intro ?? '')
  const [introAr, setIntroAr] = useState(initial?.introAr ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [startTime, setStartTime] = useState(initial?.startTime ?? '')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '')
  const [legacyDate, setLegacyDate] = useState(initial?.date ?? '')
  const [venueName, setVenueName] = useState(initial?.venueName ?? '')
  const [venueNameAr, setVenueNameAr] = useState(initial?.venueNameAr ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [addressAr, setAddressAr] = useState(initial?.addressAr ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [cityAr, setCityAr] = useState(initial?.cityAr ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [locationAr, setLocationAr] = useState(initial?.locationAr ?? '')
  const [mapQuery, setMapQuery] = useState(initial?.mapQuery ?? '')
  const [pricingType, setPricingType] = useState<'free' | 'paid' | 'request'>(initial?.pricingType ?? 'request')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD')
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : '')
  const [bookingDeadline, setBookingDeadline] = useState(initial?.bookingDeadline ?? '')
  const [image, setImage] = useState(initial?.image ?? '')
  const [gallery, setGallery] = useState<string[]>(initial?.gallery ? [...initial.gallery] : [])
  const [galleryDraft, setGalleryDraft] = useState('')
  const [highlights, setHighlights] = useState<HighlightRow[]>(initial?.highlights?.map((h) => ({ title: h.title, titleAr: h.titleAr ?? '', description: h.description, descriptionAr: h.descriptionAr ?? '' })) ?? [])
  const [program, setProgram] = useState<ProgramRow[]>(initial?.program?.map((p) => ({ day: p.day, title: p.title, description: p.description })) ?? [])
  const [included, setIncluded] = useState<string[]>(initial?.included ? [...initial.included] : [])
  const [includedAr, setIncludedAr] = useState<string[]>(initial?.includedAr ? [...initial.includedAr] : [])
  const [excluded, setExcluded] = useState<string[]>(initial?.excluded ? [...initial.excluded] : [])
  const [excludedAr, setExcludedAr] = useState<string[]>(initial?.excludedAr ? [...initial.excludedAr] : [])
  const [addOns, setAddOns] = useState<{ title: string; price: string }[]>(initial?.addOns?.map((a) => ({ title: a.title, price: a.price != null ? String(a.price) : '' })) ?? [])
  const [organizerName, setOrganizerName] = useState(initial?.organizerName ?? '')
  const [organizerPhone, setOrganizerPhone] = useState(initial?.organizerPhone ?? '')
  const [organizerWhatsapp, setOrganizerWhatsapp] = useState(initial?.organizerWhatsapp ?? '')
  const [organizerEmail, setOrganizerEmail] = useState(initial?.organizerEmail ?? '')
  const [published, setPublished] = useState(initial?.isPublished !== false)
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder != null ? String(initial.displayOrder) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const autoSlug = useMemo(() => {
    if (slugTouched || editing) return slug
    return title.trim() ? slugify(title) : ''
  }, [title, slugTouched, editing, slug])

  const takenSlugs = useMemo(() => {
    const set = new Set<string>(dbEvents.map((e) => e.slug))
    if (editing && editSlug) set.delete(editSlug)
    return set
  }, [editing, editSlug])

  const save = async () => {
    setError('')
    if (saving) return
    const finalSlug = editing ? editSlug : cleanSlugInput(autoSlug || slugify(title || 'event'))
    if (!title.trim() || !location.trim() || !legacyDate.trim()) {
      setError(ar ? 'العنوان والموقع والتاريخ حقول إلزامية.' : 'Title, location and date are required.')
      return
    }
    if (!/^[a-z0-9-]{1,80}$/.test(finalSlug)) {
      setError(ar ? 'المعرف (slug) يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات.' : 'Slug must be lowercase letters, numbers and dashes.')
      return
    }
    if (!editing && takenSlugs.has(finalSlug)) {
      setError(ar ? 'هذا المعرف مستخدم بالفعل. اختر معرفًا مختلفًا.' : 'This slug is already taken. Choose a different one.')
      return
    }
    let savedTranslations = translations
    try {
      const retain = <T,>(rows: T[], predicate: (row: T) => boolean) => rows.flatMap((row, index) => predicate(row) ? [index] : [])
      savedTranslations = alignTranslationRows(savedTranslations, 'highlights', retain(highlights, (row) => Boolean(row.title.trim() && row.description.trim())))
      savedTranslations = alignTranslationRows(savedTranslations, 'program', retain(program, (row) => Boolean(row.day.trim() && row.title.trim())))
      savedTranslations = alignTranslationRows(savedTranslations, 'addOns', retain(addOns, (row) => Boolean(row.title.trim())))
      savedTranslations = alignTranslationRows(savedTranslations, 'included', retain(included, (row) => Boolean(row.trim())))
      savedTranslations = alignTranslationRows(savedTranslations, 'excluded', retain(excluded, (row) => Boolean(row.trim())))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check translated content.')
      return
    }
    const candidate = {
      title: title.trim(), titleAr: titleAr.trim() || undefined, slug: finalSlug, image: image.trim(),
      gallery: gallery.map((g) => g.trim()).filter(Boolean),
      date: legacyDate.trim(), startDate: startDate.trim() || undefined, endDate: endDate.trim() || undefined,
      startTime: startTime.trim() || undefined, endTime: endTime.trim() || undefined,
      location: location.trim(), locationAr: locationAr.trim() || undefined,
      venueName: venueName.trim() || undefined, venueNameAr: venueNameAr.trim() || undefined,
      address: address.trim() || undefined, addressAr: addressAr.trim() || undefined,
      city: city.trim() || undefined, cityAr: cityAr.trim() || undefined, mapQuery: mapQuery.trim() || undefined,
      copy: copy.trim() || title.trim(), copyAr: copyAr.trim() || undefined,
      category: category.trim() || undefined, categoryAr: categoryAr.trim() || undefined,
      featured: featured || undefined, intro: intro.trim() || undefined, introAr: introAr.trim() || undefined,
      pricingType, price: pricingType === 'paid' && price.trim() ? Number(price) : undefined,
      currency: currency.trim().toUpperCase() || undefined,
      capacity: capacity.trim() ? Number(capacity) : undefined,
      bookingDeadline: bookingDeadline.trim() || undefined,
      organizerNameAr: initial?.organizerNameAr,
      organizerName: organizerName.trim() || undefined, organizerPhone: organizerPhone.trim() || undefined,
      organizerWhatsapp: organizerWhatsapp.trim() || undefined, organizerEmail: organizerEmail.trim() || undefined,
      isPublished: published ? undefined : false,
      displayOrder: displayOrder.trim() ? Number(displayOrder) : undefined,
      highlights: highlights.filter((h) => h.title.trim() && h.description.trim()).map((h) => ({ title: h.title.trim(), titleAr: h.titleAr.trim() || undefined, description: h.description.trim(), descriptionAr: h.descriptionAr.trim() || undefined })),
      program: program.filter((p) => p.day.trim() && p.title.trim()).map((p) => ({ day: p.day.trim(), title: p.title.trim(), description: p.description.trim() })),
      included: included.map((s) => s.trim()).filter(Boolean),
      includedAr: includedAr.map((s) => s.trim()).filter(Boolean),
      excluded: excluded.map((s) => s.trim()).filter(Boolean),
      excludedAr: excludedAr.map((s) => s.trim()).filter(Boolean),
      addOns: addOns.filter((a) => a.title.trim()).map((a) => ({ title: a.title.trim(), price: a.price.trim() ? Number(a.price) : undefined })),
    }
    const clean = sanitizeEvent(candidate)
    if (!clean) {
      setError(ar ? 'تعذر حفظ الفعالية: تحقق من الحقول الإلزامية والتواريخ والأرقام.' : 'Could not save the event: check required fields, dates and numbers.')
      return
    }
    if (pricingType === 'paid' && !(clean.price != null && clean.price >= 0)) {
      setError(ar ? 'الفعالية المدفوعة تحتاج سعرًا صحيحًا.' : 'Paid events need a valid price.')
      return
    }
    // Event record is DB-authoritative (POST for new, PUT for edit).
    setSaving(true)
    try {
      const url = editing
        ? `/api/events/${encodeURIComponent(editSlug)}`
        : '/api/events'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...clean,
          translations: savedTranslations,
          slug: finalSlug,
          content: {
            ...initial?.content,
            gallery: clean.gallery ?? [],
            highlights: clean.highlights ?? [],
            program: clean.program ?? [],
            included: clean.included ?? [],
            includedAr: clean.includedAr ?? [],
            excluded: clean.excluded ?? [],
            excludedAr: clean.excludedAr ?? [],
            addOns: clean.addOns ?? [],
          },
        }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to save event.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event.')
      setSaving(false)
      return
    }
    setSaving(false)
    invalidateEventsCarsCache()
    router.push('/admin/events')
  }

  if (missing) {
    return <>
      <PageHead eyebrow="Events" title="Event not found" titleAr="الفعالية غير موجودة" sub="Unknown slug" subAr="معرف غير معروف" backHref="/admin/events" />
      <Card title={<AdminText en="Unknown event" ar="فعالية غير معروفة" />}>
        <p><AdminText en={`No event matches slug "${editSlug}".`} ar={`لا توجد فعالية بالمعرف "${editSlug}".`} /></p>
      </Card>
    </>
  }

  return <>
    <PageHead
      eyebrow="Events"
      title={editing ? 'Edit event' : 'New event'}
      titleAr={editing ? 'تعديل فعالية' : 'فعالية جديدة'}
      sub={editing ? `Editing ${editSlug}` : 'Published to the events calendar and detail pages'}
      subAr={editing ? `تعديل ${editSlug}` : 'تنشر في أجندة الفعاليات وصفحات التفاصيل'}
      backHref="/admin/events"
      actions={<span style={{ display: 'flex', gap: 8 }}><button type="button" className="sp-btn dark" onClick={save} disabled={saving}><AdminText en={editing ? 'Save changes' : 'Publish event'} ar={editing ? 'حفظ التعديلات' : 'نشر الفعالية'} /></button></span>}
    />
    <Card title={<AdminText en="Basic" ar="أساسي" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <div className="sp-form">
        <div className="sp-form">
          <label><AdminText en="Title *" ar="العنوان EN *" /><TranslatedInput field="title" value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched && !editing) setSlug(slugify(e.target.value)) }} /></label>

        </div>
        <div className="sp-form-2">
          <label><AdminText en="Slug" ar="المعرف" /><input value={editing ? editSlug : autoSlug} disabled={editing} dir="ltr" onChange={(e) => { setSlugTouched(true); setSlug(cleanSlugInput(e.target.value)) }} placeholder="custom-..." />{!editing && <small><AdminText en="Lowercase letters, numbers, dashes. Must be unique." ar="أحرف صغيرة وأرقام وشرطات. يجب أن يكون فريدًا." /></small>}{editing && <small><AdminText en="Slug identity stays stable when editing." ar="يبقى المعرف ثابتًا عند التعديل." /></small>}</label>
          <label><AdminText en="Category" ar="التصنيف EN" /><TranslatedInput field="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Festival" /></label>
        </div>
        <div className="sp-form">

          <label className="sp-check"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> <AdminText en="Featured in hero" ar="مميزة في الواجهة" /></label>
        </div>
      </div>
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Content" ar="المحتوى" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <div className="sp-form">
        <div className="sp-form">
          <label><AdminText en="Short copy" ar="وصف مختصر EN" /><TranslatedTextarea field="copy" rows={2} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>

        </div>
        <div className="sp-form">
          <label><AdminText en="Intro" ar="مقدمة EN" /><TranslatedTextarea field="intro" rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} /></label>

        </div>
      </div>
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Schedule" ar="المواعيد" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Display date * (fallback)" ar="التاريخ المعروض * (احتياطي)" /><input value={legacyDate} onChange={(e) => setLegacyDate(e.target.value)} placeholder="October 15-18, 2026" /></label>
          <div />
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Start date (YYYY-MM-DD)" ar="تاريخ البداية" /><DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label><AdminText en="End date (YYYY-MM-DD)" ar="تاريخ النهاية" /><DateInput value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Start time (HH:MM)" ar="وقت البداية" /><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
          <label><AdminText en="End time (HH:MM)" ar="وقت النهاية" /><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
        </div>
      </div>
    </Card>
    <Card title={<AdminText en="Venue" ar="المكان" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <div className="sp-form">
        <div className="sp-form">
          <label><AdminText en="Location display *" ar="الموقع المعروض *" /><TranslatedInput field="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cairo" /></label>

        </div>
        <div className="sp-form">
          <label><AdminText en="Venue name" ar="اسم المكان EN" /><TranslatedInput field="venueName" value={venueName} onChange={(e) => setVenueName(e.target.value)} /></label>

        </div>
        <div className="sp-form">
          <label><AdminText en="Address" ar="العنوان EN" /><TranslatedInput field="address" value={address} onChange={(e) => setAddress(e.target.value)} /></label>

        </div>
        <div className="sp-form">
          <label><AdminText en="City" ar="المدينة EN" /><TranslatedInput field="city" value={city} onChange={(e) => setCity(e.target.value)} /></label>

        </div>
        <label><AdminText en="Map query (safe search)" ar="استعلام الخريطة" /><input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} dir="ltr" placeholder="Cairo Egypt" /><small><AdminText en="Blank = venue + city, or first city. Never sends multi-city strings blindly." ar="فارغ = المكان + المدينة أو أول مدينة. لا يرسل نصوص المدن المتعددة مباشرة." /></small></label>
      </div>
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Pricing" ar="الأسعار" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Pricing type" ar="نوع السعر" /><SharedSelect value={pricingType} onChange={(next) => setPricingType(next as typeof pricingType)} locale={ar ? 'ar' : 'en'} options={[{ value: 'request', label: ar ? 'السعر عند الطلب' : 'Request price' }, { value: 'free', label: ar ? 'مجاني' : 'Free' }, { value: 'paid', label: ar ? 'مدفوع' : 'Paid' }]} /></label>
          <label><AdminText en="Currency" ar="العملة" /><input value={currency} onChange={(e) => setCurrency(e.target.value)} dir="ltr" placeholder="USD" maxLength={8} /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Price (paid only)" ar="السعر (للمدفوع فقط)" /><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={pricingType !== 'paid'} /></label>
          <label><AdminText en="Capacity (optional)" ar="السعة (اختياري)" /><input type="number" min="1" step="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
        </div>
        <label><AdminText en="Booking deadline (YYYY-MM-DD, optional)" ar="آخر موعد للحجز (اختياري)" /><DateInput value={bookingDeadline} onChange={(e) => setBookingDeadline(e.target.value)} /></label>
      </div>
    </Card>
    <Card title={<AdminText en="Media" ar="الوسائط" />}>
      <div className="sp-form">
        <ImageField value={image} onChange={setImage} previewAlt={title || 'Event cover'} linkLabel={{ en: 'Cover image URL', ar: 'رابط صورة الغلاف' }} uploadLabel={{ en: 'Upload cover image', ar: 'رفع صورة الغلاف' }} />
        <div className="sp-builder-divider" />
        <div className="sp-builder-subhead"><div><strong><AdminText en="Gallery images" ar="صور المعرض" /></strong><small><AdminText en="Add each image by URL or upload it from your device." ar="أضف كل صورة برابط أو ارفعها من جهازك." /></small></div></div>
        <ImageField value={galleryDraft} onChange={setGalleryDraft} preview="compact" previewAlt={title || 'Gallery image'} linkLabel={{ en: 'Gallery image URL', ar: 'رابط صورة المعرض' }} uploadLabel={{ en: 'Upload gallery image', ar: 'رفع صورة للمعرض' }} />
        <button type="button" className="sp-btn" disabled={!galleryDraft.trim()} onClick={() => { setGallery((current) => [...current, galleryDraft].slice(0, 12)); setGalleryDraft('') }}><Plus size={15} /><AdminText en="Add to gallery" ar="إضافة إلى المعرض" /></button>
        {gallery.length > 0 && <div><strong><AdminText en="Added gallery images" ar="صور المعرض المضافة" /></strong><StringRows rows={gallery} onChange={setGallery} onAdd={<AdminText en="Add another URL" ar="إضافة رابط آخر" />} placeholder="https://..." /></div>}
      </div>
    </Card>
    <Card title={<AdminText en="Highlights" ar="أبرز النقاط" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <RowList prefix="highlights" rows={highlights} onChange={setHighlights} onAdd={() => setHighlights([...highlights, { title: '', titleAr: '', description: '', descriptionAr: '' }])} addLabel={<AdminText en="Add highlight" ar="إضافة نقطة" />} render={(row, update, index) => <div className="sp-form"><div className="sp-form"><label><AdminText en="Title" ar="العنوان EN" /><TranslatedInput field={`highlights.${index}.title`} value={row.title} onChange={(e) => update({ title: e.target.value })} /></label></div><label><AdminText en="Description" ar="الوصف EN" /><TranslatedTextarea field={`highlights.${index}.description`} rows={2} value={row.description} onChange={(e) => update({ description: e.target.value })} /></label></div>} />
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Program" ar="البرنامج" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <RowList prefix="program" rows={program} onChange={setProgram} onAdd={() => setProgram([...program, { day: '', title: '', description: '' }])} addLabel={<AdminText en="Add program day" ar="إضافة يوم" />} render={(row, update, index) => <div className="sp-form"><div className="sp-form-2"><label><AdminText en="Day" ar="اليوم" /><TranslatedInput field={`program.${index}.day`} value={row.day} onChange={(e) => update({ day: e.target.value })} placeholder="Day 1" /></label><label><AdminText en="Title" ar="العنوان" /><TranslatedInput field={`program.${index}.title`} value={row.title} onChange={(e) => update({ title: e.target.value })} /></label></div><label><AdminText en="Description" ar="الوصف" /><TranslatedTextarea field={`program.${index}.description`} rows={2} value={row.description} onChange={(e) => update({ description: e.target.value })} /></label></div>} />
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Included and Excluded" ar="المشمول والمستبعد" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <div className="sp-form">
        <div><strong><AdminText en="Included" ar="المشمول EN" /></strong><StringRows prefix="included" rows={included} onChange={setIncluded} onAdd={<AdminText en="Add included item" ar="إضافة بند مشمول" />} /></div>

        <div><strong><AdminText en="Excluded" ar="المستبعد EN" /></strong><StringRows prefix="excluded" rows={excluded} onChange={setExcluded} onAdd={<AdminText en="Add excluded item" ar="إضافة بند مستبعد" />} /></div>

      </div>
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Add-ons" ar="إضافات" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <RowList prefix="addOns" rows={addOns} onChange={setAddOns} onAdd={() => setAddOns([...addOns, { title: '', price: '' }])} addLabel={<AdminText en="Add add-on" ar="إضافة خدمة" />} render={(row, update, index) => <div className="sp-form-2"><label><AdminText en="Title" ar="العنوان" /><TranslatedInput field={`addOns.${index}.title`} value={row.title} onChange={(e) => update({ title: e.target.value })} /></label><label><AdminText en="Price (blank = on request)" ar="السعر (فارغ = عند الطلب)" /><input type="number" min="0" step="0.01" value={row.price} onChange={(e) => update({ price: e.target.value })} /></label></div>} />
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Organizer" ar="المنظم" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Name" ar="الاسم" /><TranslatedInput field="organizerName" value={organizerName} onChange={(e) => setOrganizerName(e.target.value)} /></label>
          <label><AdminText en="Email" ar="البريد" /><input value={organizerEmail} onChange={(e) => setOrganizerEmail(e.target.value)} dir="ltr" placeholder="you@example.com" /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Phone" ar="الهاتف" /><InternationalPhoneInput value={organizerPhone} onChange={setOrganizerPhone} locale={ar ? 'ar' : 'en'} /></label>
          <label><AdminText en="WhatsApp" ar="واتساب" /><InternationalPhoneInput value={organizerWhatsapp} onChange={setOrganizerWhatsapp} locale={ar ? 'ar' : 'en'} /></label>
        </div>
      </div>
    </ContentLanguageTabs>
</Card>
    <Card title={<AdminText en="Publishing" ar="النشر" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label className="sp-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <AdminText en="Published (visible on website)" ar="منشورة (ظاهرة على الموقع)" /></label>
          <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="1" /></label>
        </div>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}><AdminText en={editing ? 'Save changes' : 'Publish event'} ar={editing ? 'حفظ التعديلات' : 'نشر الفعالية'} /></button>
      </div>
    </Card>
  </>
}

function EventFormLoader() {
  const params = useSearchParams()
  const editSlug = params.get('slug') ?? ''
  const [remote, setRemote] = useState<Event | null | undefined>(editSlug ? undefined : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!editSlug) {
      setRemote(null)
      return
    }
    let cancelled = false
    setRemote(undefined)
    setLoadError(null)
    // Single source of truth: the DB record. Base-first snapshots would
    // leave admin-created slugs unresolvable and risk stale form state.
    fetch(`/api/events/${encodeURIComponent(editSlug)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          // Unknown slugs are "not found"; any other failure is a DB/API
          // error and must never render as a missing record.
          if (res.status === 404) setRemote(null)
          else setLoadError(`Request failed (${res.status}).`)
          return
        }
        const data = (await res.json()) as { event?: Event }
        if (!cancelled) setRemote(data.event ? normalizeEventRow(data.event as unknown as Record<string, unknown>) : null)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not reach the database.')
      })
    return () => { cancelled = true }
  }, [editSlug, attempt])

  if (remote === undefined && loadError) {
    return <>
      <PageHead eyebrow="Events" title="Edit event" titleAr="تعديل فعالية" backHref="/admin/events" />
      <Card title={<AdminText en="Could not load event" ar="تعذر تحميل الفعالية" />}>
        <p>{loadError}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="sp-btn primary" onClick={() => { setLoadError(null); setRemote(undefined); setAttempt((n) => n + 1) }}><AdminText en="Retry" ar="إعادة المحاولة" /></button>
        </div>
      </Card>
    </>
  }
  if (remote === undefined) {
    return <>
      <PageHead eyebrow="Events" title="Edit event" titleAr="تعديل فعالية" backHref="/admin/events" />
      <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading event…" ar="جارٍ تحميل الفعالية…" /></p></Card>
    </>
  }
  return <EventForm key={editSlug || 'new'} initial={remote} editSlug={editSlug} />
}

export default function NewEventPage() {
  return <Suspense><EventFormLoader /></Suspense>
}
