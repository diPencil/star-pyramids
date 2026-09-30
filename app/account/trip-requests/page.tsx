'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CustomerTripRequestsPage } from '@/components/account-custom-trip'

function TripRequestsFromQuery() {
  const params = useSearchParams()
  const edit = params.get('edit') ?? ''
  return <CustomerTripRequestsPage startNew={params.get('new') === '1'} editRef={/^SP-[A-Z0-9]{6,12}$/.test(edit) ? edit : null} />
}

export default function Page() {
  return <Suspense><TripRequestsFromQuery /></Suspense>
}
