import type { Metadata } from 'next'
import { ContactPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/contact')

  return {
    title: 'Contact Us',
    description: 'Get in touch with STAR PYRAMIDS. Call, email, or visit us in Giza, Egypt. We are here to plan your perfect Egypt journey.',
    alternates: { canonical: `${siteUrl}/contact`, languages: hreflang },
  }
}

export default ContactPage
