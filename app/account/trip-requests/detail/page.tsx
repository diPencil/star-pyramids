import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CustomerTripRequestDetailPage } from '@/components/account/account-custom-trip'
import { isTripReference } from '@/lib/trip-builder/trip-request'

export const metadata: Metadata = {
  title: 'Trip Request Details',
  description: 'View your STAR PYRAMIDS trip request details.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const { ref } = await searchParams
  if (typeof ref !== 'string' || !isTripReference(ref)) notFound()
  return <CustomerTripRequestDetailPage reference={ref.trim()} />
}
