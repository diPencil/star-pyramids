import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CustomerEventRequestDetailPage } from '@/components/account/account-event-requests'
import { isEventReference } from '@/lib/events/event-request'

export const metadata: Metadata = {
  title: 'Event Request Details',
  description: 'View your STAR PYRAMIDS event request details.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const { ref } = await searchParams
  if (typeof ref !== 'string' || !isEventReference(ref)) notFound()
  return <CustomerEventRequestDetailPage reference={ref.trim()} />
}
