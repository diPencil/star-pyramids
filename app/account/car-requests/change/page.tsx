'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LocaleProvider } from '@/components/locale'
import { AccountShell } from '@/components/account-portal'
import { CarChangeContent } from '@/components/account-car-change'

function CarChangeFromQuery() {
  const params = useSearchParams()
  return <CarChangeContent requestRef={params.get('ref') ?? ''} amendmentRef={params.get('amendment') ?? undefined} />
}

export default function Page() {
  return (
    <LocaleProvider>
      <AccountShell section="car-requests">
        <Suspense><CarChangeFromQuery /></Suspense>
      </AccountShell>
    </LocaleProvider>
  )
}
