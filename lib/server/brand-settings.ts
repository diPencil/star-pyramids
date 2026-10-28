import 'server-only'
import { cache } from 'react'
import { db } from './db'
import { defaultBrandSettings, type BrandSettings } from '../brand-settings'
const brandKeys: Record<keyof BrandSettings, string> = {
  companyName: 'site.name', logo: 'site.logo', favicon: 'site.favicon', aboutEn: 'site.aboutEn', aboutAr: 'site.aboutAr',
  phone: 'contact.phone', whatsapp: 'contact.whatsapp', email: 'contact.email', address: 'contact.address', mapUrl: 'contact.mapUrl', copyrightEn: 'contact.copyrightEn', copyrightAr: 'contact.copyrightAr',
}
/** Public branding only; shared by initial HTML, hydration and icon metadata. */
export const readServerBrandSettings = cache(async (): Promise<BrandSettings> => {
  try {
    const rows = await db.siteSetting.findMany({ where: { key: { in: Object.values(brandKeys) } }, select: { key: true, value: true } })
    const values = new Map(rows.map(row => [row.key, row.value]))
    const brand = { ...defaultBrandSettings }
    for (const field of Object.keys(brandKeys) as (keyof BrandSettings)[]) {
      const value = values.get(brandKeys[field])?.trim()
      if (value) brand[field] = value
    }
    return brand
  } catch { return { ...defaultBrandSettings } }
})
