import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PaymentDetailPage } from '@/components/account/account-portal'
import { isPaymentReference } from '@/lib/payments/payment'

export const metadata: Metadata = {
  title: 'Payment Details',
  description: 'View your STAR PYRAMIDS payment details.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const { ref } = await searchParams
  if (typeof ref !== 'string' || !isPaymentReference(ref)) notFound()
  return <PaymentDetailPage reference={ref.trim()} />
}
