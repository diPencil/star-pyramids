import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { CheckoutPage } from '@/components/checkout-page'
import { getCurrentUser } from '@/lib/server/auth'
import { confirmationCookieName, readBookingConfirmation } from '@/lib/server/booking-confirmation'

export const metadata: Metadata = {
  title: 'Private booking details',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ flow?: string | string[] }> }) {
  const { flow } = await searchParams
  const context = readBookingConfirmation((await cookies()).get(confirmationCookieName())?.value, flow)
  if (!context) redirect('/booking-confirmation')
  if (context.ownerId !== null) {
    const user = await getCurrentUser()
    if (user?.id !== context.ownerId || !user.roles.includes('CUSTOMER')) redirect('/login')
  }
  // This route is excluded by the existing document boundary. Reuse the full
  // existing receipt/recovery UI only after verifying this browser's context.
  return <CheckoutPage initialReceipt={context.receipt} />
}
