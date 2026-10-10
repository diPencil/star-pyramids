import type { Metadata } from 'next'
import { CustomerAccountPage } from '@/components/account-portal'

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Manage your STAR PYRAMIDS bookings, trips, and account settings.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() { return <CustomerAccountPage section="overview" /> }
