'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { EventRequestDetailContent } from './content'

function EventRequestDetailFromQuery() {
  const params = useSearchParams()
  return <EventRequestDetailContent requestId={params.get('ref') ?? ''} />
}

export default function Page() {
  return <Suspense><EventRequestDetailFromQuery /></Suspense>
}
