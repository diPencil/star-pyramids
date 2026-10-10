'use client'

import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { readImpersonation, stopImpersonation, type ImpersonatedCustomer } from '@/lib/admin-store'
import { useStaffPreviewBookings } from '@/lib/staff-preview-client'
import { useLocale, tx } from './locale'

/**
 * Banner shown while staff preview a customer's account.
 *
 * The counts and totals come from the customer's REAL bookings, loaded through
 * the permission-gated CRM API. When the record cannot be loaded, nothing is
 * guessed — the banner says so instead of showing a made-up figure.
 */
export function ImpersonationBanner() {
  const { locale } = useLocale()
  const [impersonated, setImpersonated] = useState<ImpersonatedCustomer | null>(null)

  useEffect(() => {
    const sync = () => setImpersonated(readImpersonation())
    sync()
    window.addEventListener('sp-impersonate', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('sp-impersonate', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const preview = useStaffPreviewBookings(impersonated?.publicId ?? null)

  if (!impersonated) return null

  const confirmed = preview.bookings.filter((b) => b.status === 'confirmed')
  const confirmedSpend = confirmed.reduce((sum, b) => sum + b.total, 0)

  return (
    <div className="impersonate-banner" role="status">
      <div>
        <strong>{tx(locale, { en: 'Staff preview', es: 'Vista previa del personal', it: 'Anteprima staff', ar: 'معاينة الموظفين' })}</strong>
        <span>
          {tx(locale, { en: 'Viewing as', es: 'Viendo como', it: 'Visualizzazione come', ar: 'تشاهد الحساب باسم' })} <b>{impersonated.name}</b>
          {preview.loading && <> · {tx(locale, { en: 'loading bookings…', es: 'cargando reservas…', it: 'caricamento prenotazioni…', ar: 'جارٍ تحميل الحجوزات…' })}</>}
          {!preview.loading && preview.error && <> · <b>{tx(locale, { en: 'bookings unavailable', es: 'reservas no disponibles', it: 'prenotazioni non disponibili', ar: 'الحجوزات غير متاحة' })}</b></>}
          {!preview.loading && !preview.error && preview.bookings.length > 0 && <> · {preview.bookings.length} {tx(locale, { en: 'bookings', es: 'reservas', it: 'prenotazioni', ar: 'حجوزات' })} · ${confirmedSpend.toLocaleString('en-US')} {tx(locale, { en: 'confirmed spend', es: 'gasto confirmado', it: 'spesa confermata', ar: 'إنفاق مؤكد' })}</>}
          {!preview.loading && !preview.error && preview.bookings.length === 0 && <> · {tx(locale, { en: 'no bookings yet', es: 'aún sin reservas', it: 'nessuna prenotazione', ar: 'لا توجد حجوزات بعد' })}</>}
        </span>
      </div>
      <button type="button" onClick={() => { stopImpersonation(); setImpersonated(null) }}>
        <LogOut size={15} />{tx(locale, { en: 'Exit preview', es: 'Salir de la vista previa', it: "Esci dall'anteprima", ar: 'إنهاء المعاينة' })}
      </button>
    </div>
  )
}
