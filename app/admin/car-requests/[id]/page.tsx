import { demoCarRequests } from '@/components/admin/car-requests-data'
import { CarRequestDetailContent } from './content'

export function generateStaticParams() {
  return demoCarRequests.map((request) => ({ id: request.ref }))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CarRequestDetailContent requestId={id} />
}
