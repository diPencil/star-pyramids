import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { readPublishedPage } from '@/lib/server/page-sections'
import { CmsPolicyPage } from '@/components/cms-additional-pages'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/terms')

  return {
    title: 'Terms of Use',
    description: 'STAR PYRAMIDS terms of use. Conditions for booking Egypt tours, Nile cruises, and travel services with STAR PYRAMIDS.',
    ...(await pageContentMetadata('terms')),
    alternates: { canonical: `${siteUrl}/terms`, languages: hreflang },
  }
}

export default async function Page() {
  return <CmsPolicyPage pageId="terms" state={await readPublishedPage('terms')} />
}
