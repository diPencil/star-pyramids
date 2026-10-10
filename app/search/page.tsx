import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchPage } from '@/components/extended-pages'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://starpyramids.com'

export const metadata: Metadata = {
  title: 'Search Results',
  description: 'Search STAR PYRAMIDS for Egypt tours, destinations, blogs, events, and offers.',
  alternates: { canonical: `${SITE_URL}/search` },
  robots: { index: false, follow: true },
}

export default function Page() {
  return <Suspense><SearchPage/></Suspense>
}
