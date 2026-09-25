'use client'

import { useEffect, useState } from 'react'

export type AdminLocale = 'en' | 'ar'

export function useAdminLocale(): AdminLocale {
  const [locale, setLocale] = useState<AdminLocale>('en')
  useEffect(() => {
    const sync = () => setLocale(window.localStorage.getItem('star-locale') === 'ar' ? 'ar' : 'en')
    sync()
    window.addEventListener('sp-admin-locale', sync)
    return () => window.removeEventListener('sp-admin-locale', sync)
  }, [])
  return locale
}
