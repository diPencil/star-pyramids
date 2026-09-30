'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CustomerTripRequestDetailPage } from '@/components/account-custom-trip'

function TripRequestDetailFromQuery() {
  const params = useSearchParams()
  return <CustomerTripRequestDetailPage reference={params.get('ref') ?? ''} />
}

export default function Page() {
  return <Suspense><TripRequestDetailFromQuery /></Suspense>
}
