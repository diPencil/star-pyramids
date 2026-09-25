'use client'

import { useState } from 'react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { readImageFile } from '@/lib/admin-store'

export function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ar = useAdminLocale() === 'ar'
  const [error, setError] = useState('')

  const onFile = async (files: FileList | null) => {
    const dataUrl = files?.[0] ? await readImageFile(files[0]) : null
    if (dataUrl) {
      onChange(dataUrl)
      setError('')
    } else {
      setError(ar ? 'الملف ليس صورة أو يتجاوز 1.5MB. استخدم رابطا بدلا منه.' : 'File is not an image or exceeds 1.5MB. Use a link instead.')
    }
  }

  return (
    <div className="sp-image-field">
      <div className="sp-form-2">
        <label><AdminText en="Image link" ar="رابط الصورة" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." dir="ltr" /></label>
        <label><AdminText en="Or upload an image" ar="أو رفع صورة" /><input type="file" accept="image/*" onChange={(e) => onFile(e.target.files)} /></label>
      </div>
      {value ? (
        <figure className="sp-image-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <figcaption>
            <span><AdminText en="Live preview" ar="معاينة حية" /></span>
            <button type="button" className="sp-delete-btn" onClick={() => onChange('')}><AdminText en="Remove" ar="إزالة" /></button>
          </figcaption>
        </figure>
      ) : (
        <p className="sp-image-empty"><AdminText en="Paste a link or upload an image to preview it here." ar="الصق رابطا أو ارفع صورة لمعاينتها هنا." /></p>
      )}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    </div>
  )
}
