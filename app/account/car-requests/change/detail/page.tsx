import { LocaleProvider } from '@/components/locale'
import { AccountShell } from '@/components/account-portal'
import { CarAmendmentDetailContent } from '@/components/account-car-change'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>
}) {
  const params = await searchParams
  return (
    <LocaleProvider>
      <AccountShell section="car-requests">
        <CarAmendmentDetailContent amendmentRef={first(params.ref)} />
      </AccountShell>
    </LocaleProvider>
  )
}
