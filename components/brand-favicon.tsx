'use client'

import { useEffect } from 'react'
import { useBrandSettings } from '@/lib/admin-store'

export function BrandFavicon() {
  const brand = useBrandSettings()

  useEffect(() => {
    if (!brand.favicon || brand.favicon === '/favicon.png') return
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = brand.favicon
  }, [brand.favicon])

  return null
}
