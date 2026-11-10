import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BookingDetailPage } from '@/components/account-portal'
import { isBookingReference } from '@/lib/booking'

export const metadata: Metadata = {
  title: 'Booking Details',
  description: 'View your STAR PYRAMIDS booking details.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string | string[]; print?: string | string[] }> }) {
  const { ref, print } = await searchParams
  if (typeof ref !== 'string' || !isBookingReference(ref)) notFound()
  return <BookingDetailPage reference={ref.trim()} autoPrint={print === '1'} />
}
