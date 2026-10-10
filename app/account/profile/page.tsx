import type { Metadata } from 'next'
import { CustomerAccountPage } from '@/components/account-portal'

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'Manage your STAR PYRAMIDS profile and contact details.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() { return <CustomerAccountPage section="profile" /> }
