import type { Metadata } from 'next'
import { CheckoutPage } from '@/components/checkout-page'

export const metadata: Metadata = {
  title: 'Checkout | STAR PYRAMIDS',
  description: 'Complete your Egypt trip booking securely.',
}

export default function Page() {
  return <CheckoutPage />
}
