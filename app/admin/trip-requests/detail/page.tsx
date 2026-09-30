'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TripRequestDetailContent } from './content'

function TripRequestDetailFromQuery() {
  const params = useSearchParams()
  return <TripRequestDetailContent requestId={params.get('ref') ?? ''} />
}

export default function Page() {
  return <Suspense><TripRequestDetailFromQuery /></Suspense>
}
