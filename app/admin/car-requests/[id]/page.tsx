import { CarRequestDetailContent } from './content'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CarRequestDetailContent requestId={id} />
}
