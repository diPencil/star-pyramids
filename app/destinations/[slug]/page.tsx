import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DestinationDetailPage } from '@/components/extended-pages'
import { findDestinationBySlug, listDestinationSlugs } from '@/lib/server/destinations'
import { getSiteUrl, getHreflangEntries } from '@/lib/seo'

export async function generateStaticParams() {
  try {
    const slugs = await listDestinationSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const destination = await findDestinationBySlug(slug).catch(() => null)
  if (!destination) {
    return { title: 'Destination not found', description: 'This destination is no longer available.', robots: { index: false, follow: false } }
  }
  const siteUrl = await getSiteUrl()
  const hreflang = await getHreflangEntries(`/destinations/${destination.slug}`)
  const title = `${destination.title} | STAR PYRAMIDS`
  const description = destination.copy
    ? destination.copy.slice(0, 160)
    : `Explore ${destination.title} with STAR PYRAMIDS. Discover tours, travel tips, and local insights for ${destination.title}, Egypt.`
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/destinations/${destination.slug}`, languages: hreflang },
    openGraph: {
      title,
      description,
      type: 'website',
      images: destination.image ? [{ url: destination.image }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const destination = await findDestinationBySlug(slug).catch(() => null)
  if (!destination) notFound()
  return <DestinationDetailPage slug={slug} />
}
