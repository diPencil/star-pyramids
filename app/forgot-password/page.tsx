import type { Metadata } from 'next'
import { ForgotPasswordPage } from '@/components/extended-pages'

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your STAR PYRAMIDS account password.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() {
  return <ForgotPasswordPage />
}
