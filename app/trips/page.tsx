import type { Metadata } from 'next'
import { TripsPage } from '@/components/trips-page'

export const metadata: Metadata = {
  title: 'Egypt Trips | STAR PYRAMIDS',
  description: 'Explore one-day tours, multi-day journeys, Nile cruises, and shore excursions across Egypt.',
}

export default function Page() {
  return <TripsPage />
}
