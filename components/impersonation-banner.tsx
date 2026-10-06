'use client'

import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { bookings } from '@/components/admin/admin-data'
import { readImpersonation, stopImpersonation, type ImpersonatedCustomer } from '@/lib/admin-store'
import { useLocale, tx } from './locale'

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

  if (!impersonated) return null
  const mine = bookings.filter((b) => b.customer === impersonated.name)
  const spent = mine.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + b.total, 0)

  return (
    <div className="impersonate-banner" role="status">
      <div>
        <strong>{tx(locale, { en: 'Staff preview', es: 'Vista previa del personal', it: 'Anteprima staff', ar: 'معاينة الموظفين' })}</strong>
        <span>
          {tx(locale, { en: 'Viewing as', es: 'Viendo como', it: 'Visualizzazione come', ar: 'تشاهد الحساب باسم' })} <b>{impersonated.name}</b>
          {mine.length > 0 && <> · {mine.length} {tx(locale, { en: 'bookings', es: 'reservas', it: 'prenotazioni', ar: 'حجوزات' })} · ${spent.toLocaleString('en-US')} {tx(locale, { en: 'confirmed spend', es: 'gasto confirmado', it: 'spesa confermata', ar: 'إنفاق مؤكد' })}</>}
        </span>
      </div>
      <button type="button" onClick={() => { stopImpersonation(); setImpersonated(null) }}>
        <LogOut size={15} />{tx(locale, { en: 'Exit preview', es: 'Salir de la vista previa', it: 'Esci dall\'anteprima', ar: 'إنهاء المعاينة' })}
      </button>
    </div>
  )
}
