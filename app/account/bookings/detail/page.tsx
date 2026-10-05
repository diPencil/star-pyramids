import { BookingDetailPage } from '@/components/account-portal'

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; print?: string | string[] }>
}) {
  const params = await searchParams
  return <BookingDetailPage reference={first(params.ref)} autoPrint={first(params.print) === '1'} />
}
