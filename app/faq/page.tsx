import type { Metadata } from 'next'
import { FAQPage } from '@/components/extended-pages'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/faq')

  return {
    title: 'Frequently Asked Questions',
    description: 'Find answers to common questions about STAR PYRAMIDS Egypt tours, bookings, Nile cruises, and travel planning.',
    alternates: { canonical: `${siteUrl}/faq`, languages: hreflang },
  }
}

export default FAQPage