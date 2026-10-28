'use client'
import { useEffect, useState } from 'react'
import { sanitizeLocale, type EnabledLocale } from './locale-config'

export function useCarLocale() {
  const [locale, setLocale] = useState<EnabledLocale>('en')
  useEffect(() => {
    const sync = () => { try { setLocale(sanitizeLocale(localStorage.getItem('star-locale'))) } catch { setLocale('en') } }
    sync()
    for (const event of ['sp-admin-locale', 'storage', 'click']) window.addEventListener(event, sync)
    return () => { for (const event of ['sp-admin-locale', 'storage', 'click']) window.removeEventListener(event, sync) }
  }, [])
  return locale
}
