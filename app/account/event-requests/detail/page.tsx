'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CustomerEventRequestDetailPage } from '@/components/account-event-requests'

function EventRequestDetailFromQuery() {
  const params = useSearchParams()
  return <CustomerEventRequestDetailPage reference={params.get('ref') ?? ''} />
}

export default function Page() {
  return <Suspense><EventRequestDetailFromQuery /></Suspense>
}
