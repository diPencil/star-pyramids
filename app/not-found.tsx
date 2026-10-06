'use client'
import Link from 'next/link'
import { LocaleProvider, tx, useLocale } from '@/components/locale'

function NotFoundContent() {
  const { locale } = useLocale()
  const title = tx(locale, { en: 'Page not found', es: 'Página no encontrada', it: 'Pagina non trovata', ar: 'الصفحة غير موجودة' })
  const message = tx(locale, { en: 'The journey you were looking for has taken a different route.', es: 'El viaje que buscabas ha tomado otro camino.', it: 'Il viaggio che cercavi ha preso una strada diversa.', ar: 'الرحلة التي تبحث عنها سلكت طريقًا آخر.' })
  const cta = tx(locale, { en: 'Back home', es: 'Volver al inicio', it: 'Torna alla home', ar: 'العودة إلى الرئيسية' })
  return <main className="not-found"><div className="not-found-mark">404</div><h1>{title}</h1><p>{message}</p><Link href="/" className="primary-btn">{cta}</Link></main>
}

export default function NotFound() { return <LocaleProvider><NotFoundContent /></LocaleProvider> }
