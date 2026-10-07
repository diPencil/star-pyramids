import { CustomerDetailContent } from './content'

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return <CustomerDetailContent customerKey={key} />
}
