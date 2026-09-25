import type { Metadata } from 'next'
import { CartPage } from '@/components/cart-page'

export const metadata: Metadata = {
  title: 'Trip Cart | STAR PYRAMIDS',
  description: 'Review your selected Egypt trips before checkout.',
}

export default function Page() {
  return <CartPage />
}
