'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { tours } from '@/data/tours'
import { slugify } from '@/lib/admin-store'
import { useDbOffers, invalidateOffersBlogsCache } from '@/lib/offers-blogs-client'
import { useDbTours } from '@/lib/tours-client'
import { ImageField } from '@/components/admin/image-field'
import { SharedSelect } from '@/components/shared-select'
import type { Offer } from '@/data/types'
import { DateInput } from '@/components/date-input'

const cleanSlugInput = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 80)

function OfferForm({ initial, editSlug }: { initial: Offer | null; editSlug: string }) {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const editing = Boolean(editSlug)
  const missing = editing && initial === null

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [tourSlug, setTourSlug] = useState(tours[0]?.slug ?? '')
  const [percent, setPercent] = useState('15')
  const [endsAt, setEndsAt] = useState(initial?.deadline ?? '2026-12-31')
  const [badge, setBadge] = useState(initial?.badge ?? 'SAVE 15%')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [copy, setCopy] = useState(initial?.copy ?? '')
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '')
  const [originalPrice, setOriginalPrice] = useState(initial?.originalPrice != null ? String(initial.originalPrice) : '')
  const [duration, setDuration] = useState(initial?.duration ?? '')
  const [rating, setRating] = useState(initial?.rating != null ? String(initial.rating) : '')
  const [image, setImage] = useState(initial?.image ?? '')
  const [gallery, setGallery] = useState((initial?.gallery ?? []).join('\n'))
  const [highlights, setHighlights] = useState((initial?.highlights ?? []).join('\n'))
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [published, setPublished] = useState(initial?.isPublished !== false)
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder != null ? String(initial.displayOrder) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const liveTours = useDbTours(tours)
  const dbOffers = useDbOffers([])

  const tour = liveTours.find((t) => t.slug === tourSlug)
  const dealPrice = tour ? Math.round(tour.price * (1 - Math.min(90, Math.max(0, Number(percent) || 0)) / 100)) : 0

  const postOffer = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as { error?: string }))
      throw new Error(data.error || 'Failed to save the offer.')
    }
  }

  const save = async () => {
    setError('')
    if (saving) return
    if (editing) {
      if (!title.trim()) { setError(ar ? 'اكتب عنوان العرض.' : 'Enter the offer title.'); return }
      if (!badge.trim()) { setError(ar ? 'اكتب شارة الحملة.' : 'Enter the campaign badge.'); return }
      if (!copy.trim()) { setError(ar ? 'اكتب وصف العرض.' : 'Enter the offer description.'); return }
      setSaving(true)
      try {
        const res = await fetch(`/api/offers/${encodeURIComponent(editSlug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            badge: badge.trim(),
            copy: copy.trim(),
            image: image.trim(),
            gallery: gallery.split('\n').map((s) => s.trim()).filter(Boolean),
            highlights: highlights.split('\n').map((s) => s.trim()).filter(Boolean),
            duration: duration.trim() || null,
            rating: rating.trim() ? Number(rating) : null,
            price: price.trim() ? Number(price) : null,
            originalPrice: originalPrice.trim() ? Number(originalPrice) : null,
            deadline: endsAt.trim() || null,
            isPublished: published,
            displayOrder: displayOrder.trim() ? Number(displayOrder) : 999,
          }),
          credentials: 'same-origin',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({} as { error?: string }))
          throw new Error(data.error || 'Failed to save the offer.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save the offer.')
        setSaving(false)
        return
      }
      setSaving(false)
      invalidateOffersBlogsCache()
      router.push('/admin/offers')
      return
    }
    if (mode === 'existing') {
      if (!tour) { setError(ar ? 'اختر الرحلة.' : 'Select a tour.'); return }
      const pct = Math.min(90, Math.max(1, Number(percent) || 0))
      setSaving(true)
      try {
        const offerSlug = `custom-offer-${tour.slug}`
        if (dbOffers.some((o) => o.slug === offerSlug)) {
          throw new Error(ar ? 'يوجد عرض مرتبط بهذه الرحلة بالفعل.' : 'An offer linked to this tour already exists.')
        }
        // Offer row first: if linking the tour discount fails below, the
        // offer stays visible in the list and the discount can be retried.
        await postOffer({
          slug: offerSlug,
          title: tour.title,
          image: tour.image,
          gallery: tour.gallery ? [...tour.gallery] : [],
          badge: badge.trim() || `SAVE ${pct}%`,
          copy: copy.trim() || tour.summary,
          highlights: tour.summary ? [tour.summary] : [],
          duration: tour.duration,
          price: Math.round(tour.price * (1 - pct / 100)),
          originalPrice: tour.price,
          deadline: endsAt,
          isPublished: published,
        })
        // The discount lives on the tour row itself (DB-authoritative) so
        // the website badge reflects it immediately.
        const res = await fetch(`/api/tours/${encodeURIComponent(tour.slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deal: { percent: pct, endsAt } }),
          credentials: 'same-origin',
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({} as { error?: string }))
          throw new Error(data.error || (ar ? 'حُفظ العرض، لكن تعذر ربط الخصم بالرحلة.' : 'Offer saved, but the tour discount could not be linked.'))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save the offer.')
        setSaving(false)
        return
      }
      setSaving(false)
      invalidateOffersBlogsCache()
      router.push('/admin/offers')
      return
    }
    if (!title.trim()) { setError(ar ? 'اكتب عنوان العرض.' : 'Enter the offer title.'); return }
    const finalSlug = cleanSlugInput(slugTouched ? slug : slugify(title)) || slugify(title || 'offer')
    if (!/^[a-z0-9-]{1,80}$/.test(finalSlug)) {
      setError(ar ? 'المعرف (slug) يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات.' : 'Slug must be lowercase letters, numbers and dashes.')
      return
    }
    if (dbOffers.some((o) => o.slug === finalSlug)) {
      setError(ar ? 'هذا المعرف مستخدم بالفعل. اختر معرفًا مختلفًا.' : 'This slug is already taken. Choose a different one.')
      return
    }
    setSaving(true)
    try {
      await postOffer({
        slug: finalSlug,
        title: title.trim(),
        image: image.trim() || tours[0]?.image || '',
        gallery: gallery.split('\n').map((s) => s.trim()).filter(Boolean),
        badge: badge.trim() || 'Special Offer',
        copy: copy.trim() || title.trim(),
        highlights: highlights.split('\n').map((s) => s.trim()).filter(Boolean),
        duration: duration.trim() || null,
        rating: rating.trim() ? Number(rating) : null,
        price: price.trim() ? Number(price) : null,
        originalPrice: originalPrice.trim() ? Number(originalPrice) : null,
        deadline: endsAt.trim() || null,
        isPublished: published,
        displayOrder: displayOrder.trim() ? Number(displayOrder) : 999,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the offer.')
      setSaving(false)
      return
    }
    setSaving(false)
    invalidateOffersBlogsCache()
    router.push('/admin/offers')
  }

  if (missing) {
    return <>
      <PageHead eyebrow="Special Offers" title="Offer not found" titleAr="العرض غير موجود" sub="Unknown slug" subAr="معرف غير معروف" backHref="/admin/offers" />
      <Card title={<AdminText en="Unknown offer" ar="عرض غير معروف" />}>
        <p><AdminText en={`No offer matches slug "${editSlug}".`} ar={`لا يوجد عرض بالمعرف "${editSlug}".`} /></p>
      </Card>
    </>
  }

  return <>
    <PageHead eyebrow="Special Offers" title={editing ? 'Edit offer' : 'New offer'} titleAr={editing ? 'تعديل عرض' : 'عرض جديد'} sub={editing ? `Editing ${editSlug}` : 'Link an existing tour or publish a standalone offer'} subAr={editing ? `تعديل ${editSlug}` : 'اربط رحلة موجودة أو انشر عرضا مستقلا'} backHref="/admin/offers" actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saving}><AdminText en={editing ? 'Save changes' : 'Publish offer'} ar={editing ? 'حفظ التعديلات' : 'نشر العرض'} /></button>} />
    {!editing && <Card title={<AdminText en="Creation method" ar="طريقة الإنشاء" />} sub={<AdminText en="Linking a tour adds the discount badge on the website automatically" ar="ربط رحلة يضيف شارة الخصم عليها في الموقع تلقائيا" />}>
      <div className="sp-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}><AdminText en="Link existing tour" ar="سحب رحلة موجودة" /></button>
        <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}><AdminText en="New standalone offer" ar="عرض مستقل جديد" /></button>
      </div>
      {mode === 'existing' ? (
        <div className="sp-form">
          <label><AdminText en="Tour" ar="الرحلة" /><SharedSelect value={tourSlug} onChange={setTourSlug} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={liveTours.map((t) => ({ value: t.slug, label: `${t.title} — $${t.price}` }))} /></label>
          <div className="sp-form-2">
            <label><AdminText en="Discount %" ar="نسبة الخصم %" /><input type="number" min={1} max={90} value={percent} onChange={(e) => { setPercent(e.target.value); setBadge(`SAVE ${e.target.value}%`) }} /></label>
            <label><AdminText en="Ends at" ar="ينتهي في" /><DateInput value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Badge" ar="الشارة" /><input value={badge} onChange={(e) => setBadge(e.target.value)} /></label>
            <label><AdminText en="Price after discount" ar="السعر بعد الخصم" /><input value={`$${dealPrice}`} readOnly /></label>
          </div>
          <label><AdminText en="Offer description" ar="وصف العرض" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder={tour?.summary} /></label>
          <label className="sp-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <AdminText en="Published (visible on website)" ar="منشور (ظاهر على الموقع)" /></label>
        </div>
      ) : (
        <div className="sp-form">
          <div className="sp-form-2">
            <label><AdminText en="Title" ar="العنوان" /><input value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }} placeholder="Summer Nile Escape" /></label>
            <label><AdminText en="Badge" ar="الشارة" /><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="SAVE 20%" /></label>
          </div>
          <label><AdminText en="Slug" ar="المعرف" /><input value={slugTouched ? slug : slugify(title)} dir="ltr" onChange={(e) => { setSlugTouched(true); setSlug(cleanSlugInput(e.target.value)) }} placeholder="custom-..." /><small><AdminText en="Lowercase letters, numbers, dashes. Must be unique." ar="أحرف صغيرة وأرقام وشرطات. يجب أن يكون فريدًا." /></small></label>
          <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
          <div className="sp-form-2">
            <label><AdminText en="Price" ar="السعر" /><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <label><AdminText en="Price before discount" ar="السعر قبل الخصم" /><input type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Duration" ar="المدة" /><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 days" /></label>
            <label><AdminText en="Deadline" ar="الموعد النهائي" /><DateInput value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          </div>
          <ImageField value={image} onChange={setImage} />
          <label><AdminText en="Highlights (one per line)" ar="النقاط البارزة (سطر لكل نقطة)" /><textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} /></label>
          <div className="sp-form-2">
            <label className="sp-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <AdminText en="Published (visible on website)" ar="منشور (ظاهر على الموقع)" /></label>
            <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="1" /></label>
          </div>
        </div>
      )}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}><AdminText en="Publish offer" ar="نشر العرض" /></button>
      </div>
    </Card>}
    {editing && <Card title={<AdminText en="Offer details" ar="بيانات العرض" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Title" ar="العنوان" /><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label><AdminText en="Badge" ar="الشارة" /><input value={badge} onChange={(e) => setBadge(e.target.value)} /></label>
        </div>
        <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
        <div className="sp-form-2">
          <label><AdminText en="Price" ar="السعر" /><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label><AdminText en="Price before discount" ar="السعر قبل الخصم" /><input type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Duration" ar="المدة" /><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 days" /></label>
          <label><AdminText en="Rating" ar="التقييم" /><input type="number" min="0" max="5" step="0.1" value={rating} onChange={(e) => setRating(e.target.value)} /></label>
        </div>
        <label><AdminText en="Deadline" ar="الموعد النهائي" /><DateInput value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Gallery (one URL per line)" ar="المعرض (رابط في كل سطر)" /><textarea rows={3} value={gallery} onChange={(e) => setGallery(e.target.value)} placeholder="https://..." /></label>
        <label><AdminText en="Highlights (one per line)" ar="النقاط البارزة (سطر لكل نقطة)" /><textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} /></label>
        <div className="sp-form-2">
          <label className="sp-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <AdminText en="Published (visible on website)" ar="منشور (ظاهر على الموقع)" /></label>
          <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="1" /></label>
        </div>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}><AdminText en="Save changes" ar="حفظ التعديلات" /></button>
      </div>
    </Card>}
  </>
}

function OfferFormLoader() {
  const params = useSearchParams()
  const editSlug = params.get('slug') ?? ''
  const [remote, setRemote] = useState<Record<string, unknown> | null | undefined>(editSlug ? undefined : null)
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
    fetch(`/api/offers/${encodeURIComponent(editSlug)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          // Unknown slugs are "not found"; any other failure is a DB/API
          // error and must never render as a missing record.
          if (res.status === 404) setRemote(null)
          else setLoadError(`Request failed (${res.status}).`)
          return
        }
        const data = (await res.json()) as { offer?: Record<string, unknown> }
        if (!cancelled) setRemote((data.offer ?? null) as unknown as Offer | null)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not reach the database.')
      })
    return () => { cancelled = true }
  }, [editSlug, attempt])

  if (remote === undefined && loadError) {
    return <>
      <PageHead eyebrow="Special Offers" title="Edit offer" titleAr="تعديل عرض" backHref="/admin/offers" />
      <Card title={<AdminText en="Could not load offer" ar="تعذر تحميل العرض" />}>
        <p>{loadError}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="sp-btn primary" onClick={() => { setLoadError(null); setRemote(undefined); setAttempt((n) => n + 1) }}><AdminText en="Retry" ar="إعادة المحاولة" /></button>
        </div>
      </Card>
    </>
  }
  if (remote === undefined) {
    return <>
      <PageHead eyebrow="Special Offers" title="Edit offer" titleAr="تعديل عرض" backHref="/admin/offers" />
      <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading offer…" ar="جارٍ تحميل العرض…" /></p></Card>
    </>
  }
  // Normalize the raw API row (content JSON) into the domain shape for the form.
  const initial = remote ? normalizeOfferRow(remote as unknown as Record<string, unknown>) : null
  return <OfferForm key={editSlug || 'new'} initial={initial} editSlug={editSlug} />
}

function normalizeOfferRow(row: Record<string, unknown>): Offer {
  const content = (row.content ?? {}) as Record<string, unknown>
  const strArray = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  const gallery = strArray(row.gallery ?? content.gallery)
  const highlights = strArray(row.highlights ?? content.highlights)
  return {
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    gallery: gallery.length ? gallery : undefined,
    badge: String((row.badge ?? '') as string),
    copy: String(row.copy ?? ''),
    highlights: highlights.length ? highlights : undefined,
    duration: typeof row.duration === 'string' ? row.duration : undefined,
    rating: typeof row.rating === 'number' ? row.rating : undefined,
    price: typeof row.price === 'number' ? row.price : undefined,
    originalPrice: typeof row.originalPrice === 'number' ? row.originalPrice : undefined,
    deadline: typeof row.deadline === 'string' ? row.deadline : undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : undefined,
  } as Offer
}

export default function NewOfferPage() {
  return <Suspense><OfferFormLoader /></Suspense>
}
