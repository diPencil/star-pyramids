import { LocaleProvider } from '@/components/locale'
import { AccountShell } from '@/components/account-portal'
import { CarChangeContent } from '@/components/account-car-change'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; amendment?: string | string[] }>
}) {
  const params = await searchParams
  const amendment = first(params.amendment)
  return (
    <LocaleProvider>
      <AccountShell section="car-requests">
        <CarChangeContent requestRef={first(params.ref)} amendmentRef={amendment || undefined} />
      </AccountShell>
    </LocaleProvider>
  )
}
