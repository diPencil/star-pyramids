import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CustomerTripRequestsPage } from '@/components/account-custom-trip'
import { isTripReference } from '@/lib/trip-request'

export const metadata: Metadata = {
  title: 'My Trip Requests',
  description: 'View your STAR PYRAMIDS trip requests.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string | string[]; edit?: string | string[] }> }) {
  const { new: startNew, edit } = await searchParams
  if (edit !== undefined && (typeof edit !== 'string' || !isTripReference(edit))) notFound()
  return <CustomerTripRequestsPage startNew={startNew === '1'} editRef={typeof edit === 'string' ? edit.trim() : null} />
}
