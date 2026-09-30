'use client'

import { useState } from 'react'
import { AdminText, Card } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { SharedSelect } from '@/components/shared-select'
import { ImageField } from './image-field'
import { slugify } from '@/lib/admin-store'
import type { Car } from '@/data/types'

/**
 * Shared create/edit vehicle form. The New page and edit mode render this —
 * never separate copies. The caller owns persistence: custom vehicles update
 * the local item, canonical vehicles persist a local override (never
 * `data/content.ts`). Slug is preserved in edit mode, generated on create.
 */
export function VehicleForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Car
  submitLabel: React.ReactNode
  onSubmit: (car: Car) => void
}) {
  const ar = useAdminLocale() === 'ar'
  const [title, setTitle] = useState(initial?.title ?? '')
  const [seats, setSeats] = useState(initial?.seats ?? '4 seats')
  const [transmission, setTransmission] = useState(initial?.transmission ?? 'Automatic')
  const [dailyPrice, setDailyPrice] = useState(String(initial?.dailyPrice ?? 45))
  const [image, setImage] = useState(initial?.image ?? '')
  const [copy, setCopy] = useState(initial?.copy ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim()) { setError(ar ? 'اكتب اسم السيارة.' : 'Enter the vehicle name.'); return }
    // Capacity stays free text (matches the Car type and public display) but
    // must contain a positive seat count; rate must be a positive finite number.
    const seatsCount = Number.parseInt(seats, 10)
    if (!seats.trim() || !Number.isSafeInteger(seatsCount) || seatsCount < 1) {
      setError(ar ? 'أدخل سعة صالحة (عدد مقاعد 1 على الأقل).' : 'Enter a valid capacity (at least 1 seat).')
      return
    }
    const rate = Number(dailyPrice)
    if (!Number.isFinite(rate) || rate <= 0) {
      setError(ar ? 'أدخل سعرًا يوميًا صالحًا أكبر من الصفر.' : 'Enter a valid daily rate greater than zero.')
      return
    }
    setError('')
    onSubmit({
      title: title.trim(),
      slug: initial?.slug ?? slugify(title),
      image: image.trim(),
      seats: seats.trim(),
      transmission,
      dailyPrice: rate,
      copy: copy.trim() || title.trim(),
    })
  }

  return (
    <Card title={<AdminText en="Vehicle details" ar="بيانات السيارة" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Name" ar="الاسم" /><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Toyota Corolla" /></label>
          <label><AdminText en="Capacity" ar="السعة" /><input value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4 seats" /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Transmission" ar="ناقل الحركة" /><SharedSelect value={transmission} onChange={setTransmission} locale={ar ? 'ar' : 'en'} options={[{ value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }]} /></label>
          <label><AdminText en="Daily rate (USD)" ar="السعر اليومي (USD)" /><input type="number" value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value)} /></label>
        </div>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Description" ar="الوصف" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}>{submitLabel}</button>
      </div>
    </Card>
  )
}
