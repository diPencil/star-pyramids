'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { saveCustomItem, slugify } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'
import type { Car } from '@/data/types'

export default function NewCarPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [seats, setSeats] = useState('4 seats')
  const [transmission, setTransmission] = useState('Automatic')
  const [dailyPrice, setDailyPrice] = useState('45')
  const [image, setImage] = useState('')
  const [copy, setCopy] = useState('')
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim()) { setError(ar ? 'اكتب اسم السيارة.' : 'Enter the vehicle name.'); return }
    const item: Car = {
      title: title.trim(),
      slug: slugify(title),
      image: image.trim(),
      seats: seats.trim(),
      transmission,
      dailyPrice: Number(dailyPrice) || 0,
      copy: copy.trim() || title.trim(),
    }
    saveCustomItem('cars', item)
    router.push('/admin/cars')
  }

  return <>
    <PageHead eyebrow="Fleet" title="New vehicle" titleAr="سيارة جديدة" sub="Published to the fleet and request forms" subAr="تنشر في الأسطول ونماذج الطلب" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Add vehicle" ar="إضافة السيارة" /></button>} />
    <Card title={<AdminText en="Vehicle details" ar="بيانات السيارة" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Name" ar="الاسم" /><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Toyota Corolla" /></label>
          <label><AdminText en="Capacity" ar="السعة" /><input value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4 seats" /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Transmission" ar="ناقل الحركة" /><select value={transmission} onChange={(e) => setTransmission(e.target.value)}><option>Automatic</option><option>Manual</option></select></label>
          <label><AdminText en="Daily rate (USD)" ar="السعر اليومي (USD)" /><input type="number" value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value)} /></label>
        </div>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Add vehicle" ar="إضافة السيارة" /></button>
      </div>
    </Card>
  </>
}
