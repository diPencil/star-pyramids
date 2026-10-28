'use client'

import { useId, useState } from 'react'
import { CheckCircle2, ImageIcon, Link2, Trash2, Upload } from 'lucide-react'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { uploadImageFile, type MediaScopeInput } from '@/lib/admin-store'
import { tx } from '@/components/locale'
import type { Locale } from '@/lib/locale-config'

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
  locale?: Locale
  onUploadingChange?: (uploading: boolean) => void
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
  locale,
  onUploadingChange,
}: ImageFieldProps) {
  const adminLocale = useAdminLocale()
  const language = locale ?? adminLocale
  const ar = language === 'ar'
  const t = (en: string, es: string, it: string, arabic: string) => tx(language, { en, es, it, ar: arabic })
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const inputId = useId()

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || uploading || disabled) return
    setUploading(true)
    onUploadingChange?.(true)
    let url: string | null = null
    try { url = await uploadImageFile(file, scope) } catch { url = null } finally { setUploading(false); onUploadingChange?.(false) }
    if (url) {
      onChange(url)
      setFileName(file.name)
      setError('')
    } else {
      setFileName('')
      setError(t('File is not an image or exceeds 1.5MB. Use a link instead.', 'El archivo no es una imagen o supera 1,5 MB. Usa un enlace.', 'Il file non è un’immagine o supera 1,5 MB. Usa un link.', 'الملف ليس صورة أو يتجاوز 1.5MB. استخدم رابطا بدلا منه.'))
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
            <span>{uploading ? t('Uploading…', 'Subiendo…', 'Caricamento…', 'جارٍ الرفع…') : t('Choose image', 'Elegir imagen', 'Scegli immagine', 'اختيار صورة')}</span>
            <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading || disabled} onChange={(event) => { onFile(event.target.files); event.target.value = '' }} />
          </label>
          <small className={fileName ? 'has-file' : ''} title={fileName}>{fileName ? <><CheckCircle2 size={13} />{displayFileName}</> : t('JPG, PNG, WEBP or GIF · max 1.5 MB', 'JPG, PNG, WEBP o GIF · máx. 1,5 MB', 'JPG, PNG, WEBP o GIF · max 1,5 MB', 'JPG أو PNG أو WEBP أو GIF · بحد أقصى 1.5MB')}</small>
        </div>
      </div>
      {value && preview !== 'none' ? (
        <figure className={`sp-image-preview is-${preview}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={value} src={value} alt={previewAlt} onError={() => setError(t('The image preview could not be loaded. Check the URL.', 'No se pudo cargar la vista previa. Comprueba la URL.', 'Impossibile caricare l’anteprima. Controlla l’URL.', 'تعذر تحميل معاينة الصورة. تحقق من الرابط.'))} onLoad={() => setError('')} />
          <figcaption>
            <span><CheckCircle2 size={14} />{t('Image ready', 'Imagen lista', 'Immagine pronta', 'الصورة جاهزة')}</span>
            <button type="button" className="sp-image-remove" onClick={clear} aria-label={t('Remove image', 'Quitar imagen', 'Rimuovi immagine', 'إزالة الصورة')} title={t('Remove image', 'Quitar imagen', 'Rimuovi immagine', 'إزالة الصورة')} disabled={disabled}><Trash2 size={16} /></button>
          </figcaption>
        </figure>
      ) : null}
      {error && <p className="sp-image-error" role="alert">{error}</p>}
    </div>
  )
}
