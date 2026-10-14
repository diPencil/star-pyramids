import { notFound } from 'next/navigation'
import { SeoEditor } from '@/components/admin/seo-manager'
import { isSeoPage } from '@/lib/seo-manager'

export default async function Page({ params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params
  if (!isSeoPage(pageKey)) notFound()
  return <SeoEditor key={pageKey} pageKey={pageKey} />
}
