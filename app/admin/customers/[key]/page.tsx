import { bookings } from '@/components/admin/admin-data'
import { CustomerDetailContent } from './content'

export function generateStaticParams() {
  return bookings.map((booking) => ({ key: booking.customer }))
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return <CustomerDetailContent customerKey={key} />
}
