import { notFound } from 'next/navigation'
import { SeoRecordEditor } from '@/components/admin/seo-record-editor'

export default async function Page({ params }: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await params
  if (!['tour', 'blog', 'destination', 'event', 'offer', 'category'].includes(kind) || !slug.trim()) notFound()
  return <SeoRecordEditor key={`${kind}:${slug}`} kind={kind} slug={slug} />
}
