import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchPage } from '@/components/extended-pages'
import { resolveSiteUrl } from '@/lib/seo'

const SITE_URL = resolveSiteUrl()

export const metadata: Metadata = {
  title: 'Search Results',
  description: 'Search STAR PYRAMIDS for Egypt tours, destinations, blogs, events, and offers.',
  alternates: { canonical: `${SITE_URL}/search` },
  robots: { index: false, follow: true },
}

export default function Page() {
  return <Suspense><SearchPage/></Suspense>
}
