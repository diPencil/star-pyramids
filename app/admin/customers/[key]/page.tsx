import { bookings } from '@/components/admin/admin-data'
import { CustomerDetailContent } from './content'

export function generateStaticParams() {
  return Array.from(new Set(bookings.map((booking) => booking.customer))).map((customer) => ({ key: customer }))
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return <CustomerDetailContent customerKey={key} />
}
