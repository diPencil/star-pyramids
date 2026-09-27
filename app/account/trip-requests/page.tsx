'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CustomerTripRequestsPage } from '@/components/account-custom-trip'

function TripRequestsFromQuery() {
  const params = useSearchParams()
  return <CustomerTripRequestsPage startNew={params.get('new') === '1'} />
}

export default function Page() {
  return <Suspense><TripRequestsFromQuery /></Suspense>
}
