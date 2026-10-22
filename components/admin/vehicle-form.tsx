'use client'

import { useRef, useState } from 'react'
import { ContentLanguageTabs, TranslatedInput, TranslatedTextarea } from '@/components/admin/content-language-tabs'
import { type CatalogueTranslations } from '@/lib/catalogue-translations'
import { AdminText, Card } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { toast } from './admin-toaster'
import { SharedSelect } from '@/components/shared-select'
import { ImageField } from './image-field'
import { slugify } from '@/lib/admin-store'
import type { Car } from '@/data/types'

/**
 * Shared create/edit vehicle form. The New page and edit mode render this —
 * never separate copies. The caller owns the database mutation.
 * Slug is preserved in edit mode and generated on create.
 */
export function VehicleForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Car
  submitLabel: React.ReactNode
  /**
   * Receives only the edited fields. The legacy daily-rate field no longer
   * exists on `Car`: route prices are the sole customer-facing transfer
   * pricing source, so the form never sends a daily rate in any direction.
   */
  onSubmit: (car: Car) => void | Promise<void>
}) {
  const ar = useAdminLocale() === 'ar'
  const [translations, setTranslations] = useState<CatalogueTranslations>(initial?.translations ?? {})
  const [title, setTitle] = useState(initial?.title ?? '')
  const [seats, setSeats] = useState(initial?.seats ?? '')
  const [transmission, setTransmission] = useState(initial?.transmission ?? '')
  const [image, setImage] = useState(initial?.image ?? '')
  const [copy, setCopy] = useState(initial?.copy ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)

  const save = async () => {
    if (pending.current) return
    if (!title.trim()) { setError(ar ? 'اكتب اسم السيارة.' : 'Enter the vehicle name.'); return }
    // Capacity stays free text (matches the Car type and public display) but
    // must contain a positive seat count.
    const seatsCount = Number.parseInt(seats, 10)
    if (!seats.trim() || !Number.isSafeInteger(seatsCount) || seatsCount < 1) {
      setError(ar ? 'أدخل سعة صالحة (عدد مقاعد 1 على الأقل).' : 'Enter a valid capacity (at least 1 seat).')
      return
    }
    setError('')
    pending.current = true
    setSaving(true)
    try {
      await onSubmit({
      translations,
      title: title.trim(),
      slug: initial?.slug ?? slugify(title),
      image: image.trim(),
      seats: seats.trim(),
      transmission,
      copy: copy.trim() || title.trim(),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? 'تعذر حفظ السيارة.' : 'Failed to save vehicle.'), { dedupeKey: 'car-editor-save' })
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <Card title={<AdminText en="Vehicle details" ar="بيانات السيارة" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Name" ar="الاسم" /><TranslatedInput field="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Toyota Corolla" /></label>
          <label><AdminText en="Capacity" ar="السعة" /><input value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4 seats" /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Transmission" ar="ناقل الحركة" /><SharedSelect value={transmission} onChange={setTransmission} locale={ar ? 'ar' : 'en'} options={[{ value: 'Automatic', label: 'Automatic' }, { value: 'Manual', label: 'Manual' }]} /></label>
        </div>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Description" ar="الوصف" /><TranslatedTextarea field="copy" rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}>{submitLabel}</button>
      </div>
    </ContentLanguageTabs>
</Card>
  )
}
