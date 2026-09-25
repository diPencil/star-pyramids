import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cruiseTypes, getCruiseTypeBySlug, getCruisesByType } from '@/data/tours'
import { RegionTourPage } from '@/components/site'

export function generateStaticParams() {
  return cruiseTypes.map((ct) => ({ type: ct.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params
  const ct = getCruiseTypeBySlug(type)
  if (!ct) return {}
  return {
    title: `${ct.titleEn} | STAR PYRAMIDS`,
    description: ct.descEn,
  }
}

export default async function Page({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  const ct = getCruiseTypeBySlug(type)
  if (!ct) notFound()
  const tours = getCruisesByType(type)
  return <Suspense><RegionTourPage region={{ slug: ct.slug, name: ct.titleEn, nameAr: ct.titleAr, copy: ct.descEn, copyAr: ct.descAr, tourSlugs: tours.map((t) => t.slug) }} tours={tours} page={1} category="nile-cruises" /></Suspense>
}
