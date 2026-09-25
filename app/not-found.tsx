'use client'
import Link from 'next/link'
import { LocaleProvider, useLocale } from '@/components/locale'

function NotFoundContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return <main className="not-found"><div className="not-found-mark">404</div><h1>{ar ? 'الصفحة غير موجودة' : 'Page not found'}</h1><p>{ar ? 'الرحلة التي تبحث عنها سلكت طريقًا آخر.' : 'The journey you were looking for has taken a different route.'}</p><Link href="/" className="primary-btn">{ar ? 'العودة إلى الرئيسية' : 'Back home'}</Link></main>
}

export default function NotFound() { return <LocaleProvider><NotFoundContent /></LocaleProvider> }
