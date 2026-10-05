import { CustomerTripRequestDetailPage } from '@/components/account-custom-trip'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>
}) {
  const params = await searchParams
  return <CustomerTripRequestDetailPage reference={first(params.ref)} />
}
