'use client'
import type { ImgHTMLAttributes } from 'react'
import { defaultBrandSettings, useBrandSettings } from '@/lib/admin-store'

/** Compact identity shared by dashboards, support and documents. */
export function BrandMark(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
  const brand = useBrandSettings()
  return <img {...props} src={brand.favicon || defaultBrandSettings.favicon} alt={props.alt ?? ''} />
}
