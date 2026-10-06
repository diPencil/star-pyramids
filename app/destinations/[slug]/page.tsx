import { notFound } from 'next/navigation'
import { DestinationDetailPage } from '@/components/extended-pages'
import { findDestinationBySlug, listDestinationSlugs } from '@/lib/server/destinations'

export async function generateStaticParams() {
  // DB-authoritative static params; no pre-render when DB is unreachable.
  try {
    const slugs = await listDestinationSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // DB-authoritative existence check; unknown slugs are real 404s.
  const destination = await findDestinationBySlug(slug).catch(() => null)
  if (!destination) notFound()
  return <DestinationDetailPage slug={slug} />
}
