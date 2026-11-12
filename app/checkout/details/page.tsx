import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CheckoutPage } from '@/components/booking/checkout/checkout-page'
import { isProductionTrackingHost } from '@/lib/tracking/tracking'
import { getTrackingSettings } from '@/lib/server/tracking/tracking'

export const metadata: Metadata = {
  title: 'Booking details',
  description: 'Complete your Egypt trip booking securely.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page() {
  const requestHeaders = await headers()
  const measureBookings = isProductionTrackingHost(process.env.NODE_ENV, requestHeaders.get('host') ?? '') &&
    (await getTrackingSettings()).enabled
  return <CheckoutPage measureBookings={measureBookings} />
}
