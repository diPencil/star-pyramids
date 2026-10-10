import type { Metadata } from 'next'
import { LoginPage } from '@/components/auth-pages'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your STAR PYRAMIDS account to manage bookings and trips.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() {
  return <LoginPage />
}
