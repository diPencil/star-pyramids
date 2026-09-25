'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { tours } from '@/data/tours'
import { saveCustomItem, saveTourDeal, slugify } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'
import type { Offer } from '@/data/types'

export default function NewOfferPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [tourSlug, setTourSlug] = useState(tours[0]?.slug ?? '')
  const [percent, setPercent] = useState('15')
  const [endsAt, setEndsAt] = useState('2026-12-31')
  const [badge, setBadge] = useState('SAVE 15%')
  const [title, setTitle] = useState('')
  const [copy, setCopy] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [duration, setDuration] = useState('')
  const [image, setImage] = useState('')
  const [highlights, setHighlights] = useState('')
  const [error, setError] = useState('')

  const tour = tours.find((t) => t.slug === tourSlug)
  const dealPrice = tour ? Math.round(tour.price * (1 - Math.min(90, Math.max(0, Number(percent) || 0)) / 100)) : 0

  const save = () => {
    setError('')
    if (mode === 'existing') {
      if (!tour) { setError(ar ? 'اختر الرحلة.' : 'Select a tour.'); return }
      const pct = Math.min(90, Math.max(1, Number(percent) || 0))
      const offer: Offer = {
        title: tour.title,
        slug: `custom-offer-${tour.slug}`,
        image: tour.image,
        gallery: tour.gallery ? [...tour.gallery] : undefined,
        badge: badge.trim() || `SAVE ${pct}%`,
        copy: copy.trim() || tour.summary,
        highlights: tour.summary ? [tour.summary] : undefined,
        duration: tour.duration,
        price: Math.round(tour.price * (1 - pct / 100)),
        originalPrice: tour.price,
        deadline: endsAt,
      }
      saveTourDeal(tour.slug, { percent: pct, endsAt })
      saveCustomItem('offers', offer)
    } else {
      if (!title.trim()) { setError(ar ? 'اكتب عنوان العرض.' : 'Enter the offer title.'); return }
      const offer: Offer = {
        title: title.trim(),
        slug: slugify(title),
        image: image.trim() || tours[0]?.image || '',
        badge: badge.trim() || 'Special Offer',
        copy: copy.trim() || title.trim(),
        highlights: highlights.split('\n').map((s) => s.trim()).filter(Boolean),
        duration: duration.trim() || undefined,
        price: price ? Number(price) : undefined,
        originalPrice: originalPrice ? Number(originalPrice) : undefined,
        deadline: endsAt || undefined,
      }
      saveCustomItem('offers', offer)
    }
    router.push('/admin/offers')
  }

  return <>
    <PageHead eyebrow="Special Offers" title="New offer" titleAr="عرض جديد" sub="Link an existing tour or publish a standalone offer" subAr="اربط رحلة موجودة أو انشر عرضا مستقلا" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Publish offer" ar="نشر العرض" /></button>} />
    <Card title={<AdminText en="Creation method" ar="طريقة الإنشاء" />} sub={<AdminText en="Linking a tour adds the discount badge on the website automatically" ar="ربط رحلة يضيف شارة الخصم عليها في الموقع تلقائيا" />}>
      <div className="sp-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}><AdminText en="Link existing tour" ar="سحب رحلة موجودة" /></button>
        <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}><AdminText en="New standalone offer" ar="عرض مستقل جديد" /></button>
      </div>
      {mode === 'existing' ? (
        <div className="sp-form">
          <label><AdminText en="Tour" ar="الرحلة" /><select value={tourSlug} onChange={(e) => setTourSlug(e.target.value)}>{tours.map((t) => <option key={t.slug} value={t.slug}>{t.title} — ${t.price}</option>)}</select></label>
          <div className="sp-form-2">
            <label><AdminText en="Discount %" ar="نسبة الخصم %" /><input type="number" min={1} max={90} value={percent} onChange={(e) => { setPercent(e.target.value); setBadge(`SAVE ${e.target.value}%`) }} /></label>
            <label><AdminText en="Ends at" ar="ينتهي في" /><input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Badge" ar="الشارة" /><input value={badge} onChange={(e) => setBadge(e.target.value)} /></label>
            <label><AdminText en="Price after discount" ar="السعر بعد الخصم" /><input value={`$${dealPrice}`} readOnly /></label>
          </div>
          <label><AdminText en="Offer description" ar="وصف العرض" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} placeholder={tour?.summary} /></label>
        </div>
      ) : (
        <div className="sp-form">
          <div className="sp-form-2">
            <label><AdminText en="Title" ar="العنوان" /><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer Nile Escape" /></label>
            <label><AdminText en="Badge" ar="الشارة" /><input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="SAVE 20%" /></label>
          </div>
          <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
          <div className="sp-form-2">
            <label><AdminText en="Price" ar="السعر" /><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <label><AdminText en="Price before discount" ar="السعر قبل الخصم" /><input type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} /></label>
          </div>
          <div className="sp-form-2">
            <label><AdminText en="Duration" ar="المدة" /><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 days" /></label>
            <label><AdminText en="Deadline" ar="الموعد النهائي" /><input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          </div>
          <ImageField value={image} onChange={setImage} />
          <label><AdminText en="Highlights (one per line)" ar="النقاط البارزة (سطر لكل نقطة)" /><textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} /></label>
        </div>
      )}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Publish offer" ar="نشر العرض" /></button>
      </div>
    </Card>
  </>
}
