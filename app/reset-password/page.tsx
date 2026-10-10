import type { Metadata } from 'next'
import { ResetPasswordPage } from '@/components/extended-pages'

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new password for your STAR PYRAMIDS account.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() {
  return <ResetPasswordPage />
}
