import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CheckoutPage } from '@/components/checkout-page'
import { isProductionTrackingHost } from '@/lib/tracking'
import { getTrackingSettings } from '@/lib/server/tracking'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your Egypt trip booking securely.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page() {
  const requestHeaders = await headers()
  const measureBookings = isProductionTrackingHost(process.env.NODE_ENV, requestHeaders.get('host') ?? '') &&
    (await getTrackingSettings()).enabled
  return <CheckoutPage measureBookings={measureBookings} />
}
