'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { saveCustomItem, slugify } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'
import type { Event } from '@/data/types'

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)

export default function NewEventPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [category, setCategory] = useState('')
  const [image, setImage] = useState('')
  const [copy, setCopy] = useState('')
  const [highlights, setHighlights] = useState('')
  const [program, setProgram] = useState('')
  const [included, setIncluded] = useState('')
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim() || !location.trim() || !date.trim()) {
      setError(ar ? 'العنوان والموقع والتاريخ حقول إلزامية.' : 'Title, location and date are required.')
      return
    }
    const item: Event = {
      title: title.trim(),
      slug: slugify(title),
      image: image.trim(),
      date: date.trim(),
      location: location.trim(),
      copy: copy.trim() || title.trim(),
      category: category.trim() || undefined,
      intro: copy.trim() || undefined,
      highlights: lines(highlights).map((row) => {
        const [h, ...rest] = row.split('|')
        return { title: h.trim(), description: rest.join('|').trim() }
      }),
      program: lines(program).map((row) => {
        const [day, h, ...rest] = row.split('|')
        return { day: (day ?? '').trim(), title: (h ?? '').trim(), description: rest.join('|').trim() }
      }),
      included: lines(included),
    }
    saveCustomItem('events', item)
    router.push('/admin/events')
  }

  return <>
    <PageHead eyebrow="Events" title="New event" titleAr="فعالية جديدة" sub="Published to the events calendar and detail pages" subAr="تنشر في أجندة الفعاليات وصفحات التفاصيل" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Publish event" ar="نشر الفعالية" /></button>} />
    <Card title={<AdminText en="Event details" ar="بيانات الفعالية" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Title" ar="العنوان" /><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label><AdminText en="Location" ar="الموقع" /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cairo" /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Date" ar="التاريخ" /><input value={date} onChange={(e) => setDate(e.target.value)} placeholder="October 12th, 2026" /></label>
          <label><AdminText en="Category" ar="التصنيف" /><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Festival" /></label>
        </div>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
        <label><AdminText en="Highlights (one per line: title | description)" ar="أبرز النقاط (سطر لكل نقطة: العنوان | الوصف)" /><textarea rows={3} value={highlights} onChange={(e) => setHighlights(e.target.value)} /></label>
        <label><AdminText en="Program (one per day: day | title | description)" ar="البرنامج (سطر لكل يوم: اليوم | العنوان | الوصف)" /><textarea rows={4} value={program} onChange={(e) => setProgram(e.target.value)} /></label>
        <label><AdminText en="Included (one per line)" ar="المشمول (سطر لكل بند)" /><textarea rows={3} value={included} onChange={(e) => setIncluded(e.target.value)} /></label>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Publish event" ar="نشر الفعالية" /></button>
      </div>
    </Card>
  </>
}
