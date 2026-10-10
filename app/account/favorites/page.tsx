import type { Metadata } from 'next'
import { CustomerAccountPage } from '@/components/account-portal'

export const metadata: Metadata = {
  title: 'My Favorites',
  description: 'View your saved STAR PYRAMIDS trips.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() { return <CustomerAccountPage section="favorites" /> }
