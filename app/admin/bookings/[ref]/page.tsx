import { BookingDetailContent } from './content'

export default async function Page({
  params,
}: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  return <BookingDetailContent reference={decodeURIComponent(ref)} />
}
