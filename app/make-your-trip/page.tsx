import { Suspense } from 'react'
import type { Metadata } from 'next'
import MakeYourTripPlanner from './trip-request-planner'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries('/make-your-trip')

  return {
    title: 'Plan Your Egypt Trip',
    description: 'Use the STAR PYRAMIDS trip planner to design your perfect Egypt journey. Choose destinations, dates, and travelers — we handle the rest.',
    alternates: { canonical: `${siteUrl}/make-your-trip`, languages: hreflang },
  }
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <MakeYourTripPlanner />
    </Suspense>
  )
}
