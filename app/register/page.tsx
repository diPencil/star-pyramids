import type { Metadata } from 'next'
import { RegisterPage } from '@/components/auth-pages'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your STAR PYRAMIDS account to book Egypt trips and manage your travel.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() {
  return <RegisterPage />
}
