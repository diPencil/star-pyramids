import type { Metadata } from 'next'
import { pageContentMetadata } from '@/lib/server/page-content-metadata'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'
import { readPublishedPage } from '@/lib/server/page-sections'
import { CmsPolicyPage } from '@/components/cms-additional-pages'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/privacy')

  return {
    title: 'Privacy Policy',
    description: 'STAR PYRAMIDS privacy policy. Learn how we collect, use, and protect your personal information when you book Egypt tours and travel services.',
    ...(await pageContentMetadata('privacy')),
    alternates: { canonical: `${siteUrl}/privacy`, languages: hreflang },
  }
}

export default async function Page() {
  return <CmsPolicyPage pageId="privacy" state={await readPublishedPage('privacy')} />
}
