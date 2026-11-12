import type { Metadata } from 'next'
import { CartPage } from '@/components/booking/cart/cart-page'
import { LocaleProvider } from '@/components/locale'

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Review your selected Egypt trips before entering your booking details.',
  robots: { index: false, follow: false, nocache: true },
}

export default function Page() {
  return <LocaleProvider><CartPage checkoutSummary /></LocaleProvider>
}
