import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CarRequestDetailPage } from '@/components/account/account-portal'
import { isCarReference } from '@/lib/cars/car-request'

export const metadata: Metadata = {
  title: 'Car Request Details',
  description: 'View your STAR PYRAMIDS car rental request details.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const { ref } = await searchParams
  if (typeof ref !== 'string' || !isCarReference(ref)) notFound()
  return <CarRequestDetailPage reference={ref.trim()} />
}
