'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAdminLocale } from './admin-locale'

/**
 * Shared compact admin Back control.
 * Single design-system pattern for every nested admin page:
 * compact icon button (sp-icon-btn) with Lucide ArrowLeft,
 * placed beside/before the page title via PageHead `backHref`.
 * Always points at an explicit parent route — never browser history.
 */
export function AdminBackButton({
  href,
  labelEn = 'Back',
  labelAr = 'رجوع',
}: {
  href: string
  labelEn?: string
  labelAr?: string
}) {
  const ar = useAdminLocale() === 'ar'
  const label = ar ? labelAr : labelEn
  return (
    <Link href={href} className="sp-icon-btn sp-back-btn" aria-label={label} title={label}>
      <ArrowLeft size={18} aria-hidden="true" />
    </Link>
  )
}
