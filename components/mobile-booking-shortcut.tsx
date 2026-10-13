'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { tx, useLocale } from './locale'

export function MobileBookingShortcut() {
  const { locale } = useLocale()
  const [show, setShow] = useState(false)
  useEffect(() => {
    const booking = document.querySelector('.tour-booking-card')
    if (!booking) return
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      rootMargin: '0px 0px -80px 0px',
    })
    observer.observe(booking)
    return () => observer.disconnect()
  }, [])
  if (!show) return null
  return <div className="mobile-booking-shortcut"><button type="button" onClick={() => {
    const booking = document.querySelector<HTMLElement>('.tour-booking-card')
    if (!booking) return
    booking.tabIndex = -1
    booking.focus({ preventScroll: true })
    booking.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }}><CalendarDays size={18}/><span>{tx(locale, { en: 'Dates & travelers', es: 'Fechas y viajeros', it: 'Date e viaggiatori', ar: 'التاريخ والمسافرون' })}</span><ArrowRight size={18}/></button></div>
}
