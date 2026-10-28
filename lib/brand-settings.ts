import { COMPANY_ADDRESS, COMPANY_EMAIL, COMPANY_MAP_URL, COMPANY_PHONE_DISPLAY } from '@/data/company'

export type BrandSettings = {
  companyName: string
  logo: string
  favicon: string
  aboutEn: string
  aboutAr: string
  phone: string
  whatsapp: string
  email: string
  address: string
  mapUrl: string
  copyrightEn: string
  copyrightAr: string
}

export const defaultBrandSettings: BrandSettings = {
  companyName: 'Star Pyramids Tours',
  logo: '/logo.png',
  favicon: '/favicon.png',
  aboutEn: 'We would be happy to help you discover Egypt.',
  aboutAr: 'سعداء بمساعدتك في اكتشاف مصر.',
  phone: COMPANY_PHONE_DISPLAY,
  whatsapp: COMPANY_PHONE_DISPLAY,
  email: COMPANY_EMAIL,
  address: COMPANY_ADDRESS,
  mapUrl: COMPANY_MAP_URL,
  copyrightEn: 'All rights reserved to STAR PYRAMIDS company, Egypt ©2026',
  copyrightAr: 'جميع الحقوق محفوظة لشركة ستار بيراميدز، مصر ©2026',
}
