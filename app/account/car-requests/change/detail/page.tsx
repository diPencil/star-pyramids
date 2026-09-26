'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LocaleProvider } from '@/components/locale'
import { AccountShell } from '@/components/account-portal'
import { CarAmendmentDetailContent } from '@/components/account-car-change'

function CarAmendmentDetailFromQuery() {
  const params = useSearchParams()
  return <CarAmendmentDetailContent amendmentRef={params.get('ref') ?? ''} />
}

export default function Page() {
  return (
    <LocaleProvider>
      <AccountShell section="car-requests">
        <Suspense><CarAmendmentDetailFromQuery /></Suspense>
      </AccountShell>
    </LocaleProvider>
  )
}
