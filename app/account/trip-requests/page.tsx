import { CustomerTripRequestsPage } from '@/components/account-custom-trip'
import { isTripReference } from '@/lib/trip-request'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ new?: string | string[]; edit?: string | string[] }>
}) {
  const params = await searchParams
  const edit = first(params.edit).trim()
  // Shared contract: official refs are `SP-TR-XXXXXX`; legacy `SP-…` refs
  // stay routable so they fail honestly instead of silently opening a blank form.
  return <CustomerTripRequestsPage startNew={first(params.new) === '1'} editRef={isTripReference(edit) ? edit : null} />
}
