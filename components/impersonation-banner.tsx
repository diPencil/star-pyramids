'use client'

import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { bookings } from '@/components/admin/admin-data'
import { readImpersonation, stopImpersonation, type ImpersonatedCustomer } from '@/lib/admin-store'
import { useLocale } from './locale'

export function ImpersonationBanner() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
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
        <strong>{ar ? 'معاينة الموظفين' : 'Staff preview'}</strong>
        <span>
          {ar ? 'تشاهد الحساب باسم' : 'Viewing as'} <b>{impersonated.name}</b>
          {mine.length > 0 && <> · {mine.length} {ar ? 'حجوزات' : 'bookings'} · ${spent.toLocaleString('en-US')} {ar ? 'إنفاق مؤكد' : 'confirmed spend'}</>}
        </span>
      </div>
      <button type="button" onClick={() => { stopImpersonation(); setImpersonated(null) }}>
        <LogOut size={15} />{ar ? 'إنهاء المعاينة' : 'Exit preview'}
      </button>
    </div>
  )
}
