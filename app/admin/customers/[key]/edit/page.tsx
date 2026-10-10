import { EditCustomerContent } from './content'

// The record is resolved per request from the database (publicId), so there is
// no static param list. The previous implementation enumerated mock customer
// names here, which meant real customers could never be opened.
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  return <EditCustomerContent customerKey={key} />
}
