import { CarRequestDetailPage } from '@/components/account-portal'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>
}) {
  const params = await searchParams
  return <CarRequestDetailPage reference={first(params.ref)} />
}
