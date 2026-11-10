'use client'

import { useBrandSettings } from '@/lib/admin-store'
import styles from './admin-release-label.module.css'

export function shortCompanyName(companyName: string): string {
  return companyName.trim().split(/\s+/u).filter(Boolean).slice(0, 2).join(' ')
}

export function AdminReleaseLabel({ collapsed }: { collapsed: boolean }) {
  const brand = useBrandSettings()
  const name = shortCompanyName(brand.companyName)
  const version = process.env.NEXT_PUBLIC_APP_RELEASE_VERSION || 'v—'
  const label = `${name} ${version}`.trim()

  return (
    <p className={styles.label} title={label} aria-label={label}>
      {!collapsed && <span className={styles.name}>{name}</span>}
      <span className={styles.version} dir="ltr">{version}</span>
    </p>
  )
}
