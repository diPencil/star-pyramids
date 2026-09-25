'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { saveCustomItem, slugify } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'
import type { Destination } from '@/data/types'

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)

export default function NewDestinationPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [image, setImage] = useState('')
  const [copy, setCopy] = useState('')
  const [stay, setStay] = useState('2-3 days')
  const [bestFor, setBestFor] = useState('')
  const [tourSlugs, setTourSlugs] = useState('')
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim()) { setError(ar ? 'اكتب اسم الوجهة.' : 'Enter the destination name.'); return }
    const item: Destination = {
      title: title.trim(),
      slug: slugify(title),
      image: image.trim(),
      copy: copy.trim() || title.trim(),
      detail: {
        heroImage: image.trim(),
        heroAlt: title.trim(),
        eyebrow: 'Discover Egypt',
        intro: copy.trim() || title.trim(),
        facts: [{ label: 'Suggested stay', value: stay.trim() || 'Flexible' }],
        bestFor: lines(bestFor),
        experiences: [],
        rhythm: [],
        practical: [],
        tourSlugs: tourSlugs.split(',').map((s) => s.trim()).filter(Boolean),
      },
    }
    saveCustomItem('destinations', item)
    router.push('/admin/destinations')
  }

  return <>
    <PageHead eyebrow="Catalogue" title="New destination" titleAr="وجهة جديدة" sub="Published to destinations and the homepage" subAr="تنشر في الوجهات والرئيسية" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Publish destination" ar="نشر الوجهة" /></button>} />
    <Card title={<AdminText en="Destination details" ar="بيانات الوجهة" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Name" ar="الاسم" /><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Siwa Oasis" /></label>
          <label><AdminText en="Suggested stay" ar="مدة الإقامة المقترحة" /><input value={stay} onChange={(e) => setStay(e.target.value)} /></label>
        </div>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
        <label><AdminText en="Best for (one per line)" ar="مناسبة لـ (سطر لكل بند)" /><textarea rows={3} value={bestFor} onChange={(e) => setBestFor(e.target.value)} /></label>
        <label><AdminText en="Linked tour slugs (comma separated)" ar="الرحلات المرتبطة (slugs مفصولة بفاصلة)" /><input value={tourSlugs} onChange={(e) => setTourSlugs(e.target.value)} placeholder="cairo-and-giza-pyramids" dir="ltr" /></label>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Publish destination" ar="نشر الوجهة" /></button>
      </div>
    </Card>
  </>
}
