'use client'

import { useEffect } from 'react'
import { useBrandSettings } from '@/lib/admin-store'

export function BrandFavicon() {
  const brand = useBrandSettings()

  useEffect(() => {
    const href = brand.favicon || '/favicon.png'
    const links = document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
    if (!links.length) {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.href = href
      document.head.appendChild(link)
    }
    links.forEach(link => {
      link.href = href
      // Stored uploads may be PNG, JPEG or WebP; do not retain a stale PNG hint.
      link.removeAttribute('type')
    })
  }, [brand.favicon])

  return null
}
