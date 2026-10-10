import type { Metadata } from 'next'
import { CustomerAccountPage } from '@/components/account-portal'

export const metadata: Metadata = {
  title: 'Trip Request Details',
  description: 'View your STAR PYRAMIDS trip request details.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() { return <CustomerAccountPage section="trip-requests" /> }
