'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BookingDetailPage } from '@/components/account-portal'

function BookingDetailFromQuery() {
  const params = useSearchParams()
  return <BookingDetailPage reference={params.get('ref') ?? ''} autoPrint={params.get('print') === '1'} />
}

export default function Page() {
  return <Suspense><BookingDetailFromQuery /></Suspense>
}
