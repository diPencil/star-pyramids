import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { BookingConfirmation } from '@/components/booking/booking-confirmation'
import { confirmationCookieName, readBookingConfirmation } from '@/lib/server/booking/access/booking-confirmation'

export const metadata: Metadata = {
  title: 'Booking request confirmation',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ flow?: string | string[] }> }) {
  const { flow } = await searchParams
  const context = readBookingConfirmation((await cookies()).get(confirmationCookieName())?.value, flow)
  // Never pass the private receipt, owner, email or access URL into this public
  // document/RSC payload. Only the non-credential context selector is public.
  return <BookingConfirmation flow={context?.flow ?? null} />
}
