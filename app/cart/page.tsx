import type { Metadata } from 'next'
import { CartPage } from '@/components/cart-page'

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review your selected Egypt trips before checkout.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() {
  return <CartPage />
}
