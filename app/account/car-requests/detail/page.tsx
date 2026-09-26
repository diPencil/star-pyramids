'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CarRequestDetailPage } from '@/components/account-portal'

function CarRequestDetailFromQuery() {
  const params = useSearchParams()
  return <CarRequestDetailPage reference={params.get('ref') ?? ''} />
}

export default function Page() {
  return <Suspense><CarRequestDetailFromQuery /></Suspense>
}
