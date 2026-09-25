import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { dayTourRegions, getToursBySlugs } from '@/data/tours'
import { RegionTourPage } from '@/components/site'

export function generateStaticParams() {
  return dayTourRegions.map((r) => ({ region: r.slug }))
}

export default async function Page({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params
  const region = dayTourRegions.find((r) => r.slug === regionSlug)
  if (!region) notFound()
  const tours = getToursBySlugs(region.tourSlugs)
  return <Suspense><RegionTourPage region={region} tours={tours} page={1} /></Suspense>
}
