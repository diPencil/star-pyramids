'use client'
import Link from 'next/link'
import { LocaleProvider, useLocale } from '@/components/locale'

function NotFoundContent() {
  const { locale } = useLocale()
  const isAr = locale === 'ar'
  const title = isAr ? 'الصفحة غير موجودة' : locale === 'es' ? 'Página no encontrada' : locale === 'it' ? 'Pagina non trovata' : 'Page not found'
  const message = isAr ? 'الرحلة التي تبحث عنها سلكت طريقًا آخر.' : locale === 'es' ? 'El viaje que buscabas ha tomado otro camino.' : locale === 'it' ? "Il viaggio che cercavi ha preso una strada diversa." : 'The journey you were looking for has taken a different route.'
  const cta = isAr ? 'العودة إلى الرئيسية' : locale === 'es' ? 'Volver al inicio' : locale === 'it' ? "Torna alla home" : 'Back home'
  return <main className="not-found"><div className="not-found-mark">404</div><h1>{title}</h1><p>{message}</p><Link href="/" className="primary-btn">{cta}</Link></main>
}

export default function NotFound() { return <LocaleProvider><NotFoundContent /></LocaleProvider> }
