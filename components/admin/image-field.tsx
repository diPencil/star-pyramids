'use client'

import { useId, useState } from 'react'
import { CheckCircle2, ImageIcon, Link2, Trash2, Upload } from 'lucide-react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { uploadImageFile, type MediaScopeInput } from '@/lib/admin-store'

type ImageFieldProps = {
  value: string
  onChange: (url: string) => void
  linkLabel?: { en: string; ar: string }
  uploadLabel?: { en: string; ar: string }
  previewAlt?: string
  preview?: 'default' | 'wide' | 'compact' | 'none'
  /** Permission gate applied server-side. Defaults to catalogue media. */
  scope?: MediaScopeInput
  disabled?: boolean
}

export function ImageField({
  value,
  onChange,
  linkLabel = { en: 'Image URL', ar: 'رابط الصورة' },
  uploadLabel = { en: 'Upload image', ar: 'رفع صورة' },
  previewAlt = '',
  preview = 'default',
  scope = 'catalogue',
  disabled = false,
}: ImageFieldProps) {
  const ar = useAdminLocale() === 'ar'
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const inputId = useId()

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || uploading) return
    setUploading(true)
    const url = await uploadImageFile(file, scope)
    setUploading(false)
    if (url) {
      onChange(url)
      setFileName(file.name)
      setError('')
    } else {
      setFileName('')
      setError(ar ? 'الملف ليس صورة أو يتجاوز 1.5MB. استخدم رابطا بدلا منه.' : 'File is not an image or exceeds 1.5MB. Use a link instead.')
    }
  }

  const clear = () => {
    onChange('')
    setFileName('')
    setError('')
  }

  const displayFileName = fileName.length > 30 ? fileName.slice(0, 27) + '…' : fileName

  return (
    <div className="sp-image-field">
      <div className="sp-image-source-grid">
        <label className="sp-image-url-field">
          <span><Link2 size={14} aria-hidden="true" /><AdminText en={linkLabel.en} ar={linkLabel.ar} /></span>
          <input value={value.startsWith('data:') ? '' : value} onChange={(event) => { onChange(event.target.value); setFileName(''); setError('') }} placeholder="https://..." dir="ltr" inputMode="url" autoComplete="url" disabled={disabled} />
        </label>
        <div className="sp-image-upload-field">
          <span><ImageIcon size={14} aria-hidden="true" /><AdminText en={uploadLabel.en} ar={uploadLabel.ar} /></span>
          <label className="sp-image-upload-button" htmlFor={inputId}>
            <Upload size={17} aria-hidden="true" />
            <span>{uploading ? <AdminText en="Uploading…" ar="جارٍ الرفع…" /> : <AdminText en="Choose image" ar="اختيار صورة" />}</span>
            <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading || disabled} onChange={(event) => { onFile(event.target.files); event.target.value = '' }} />
          </label>
          <small className={fileName ? 'has-file' : ''} title={fileName}>{fileName ? <><CheckCircle2 size={13} />{displayFileName}</> : <AdminText en="JPG, PNG, WEBP or GIF · max 1.5 MB" ar="JPG أو PNG أو WEBP أو GIF · بحد أقصى 1.5MB" />}</small>
        </div>
      </div>
      {value && preview !== 'none' ? (
        <figure className={`sp-image-preview is-${preview}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={value} src={value} alt={previewAlt} onError={() => setError(ar ? 'تعذر تحميل معاينة الصورة. تحقق من الرابط.' : 'The image preview could not be loaded. Check the URL.')} onLoad={() => setError('')} />
          <figcaption>
            <span><CheckCircle2 size={14} /><AdminText en="Image ready" ar="الصورة جاهزة" /></span>
            <button type="button" className="sp-image-remove" onClick={clear} aria-label={ar ? 'إزالة الصورة' : 'Remove image'} title={ar ? 'إزالة الصورة' : 'Remove image'} disabled={disabled}><Trash2 size={16} /></button>
          </figcaption>
        </figure>
      ) : null}
      {error && <p className="sp-image-error" role="alert">{error}</p>}
    </div>
  )
}
