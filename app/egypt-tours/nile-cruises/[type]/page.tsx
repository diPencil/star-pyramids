import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cruiseTypes, getCruiseTypeBySlug } from '@/data/tours'
import { getToursByCategory } from '@/lib/server/tours'
import { RegionTourPage } from '@/components/site'
import { ServerShowcaseHero } from '@/components/server-showcase-hero'
import { isCruiseHeroId } from '@/lib/compact-hero-defaults'

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
  if (!ct || !isCruiseHeroId(type)) notFound()
  // DB-authoritative tour list so builder edits (incl. cruise-type moves)
  // are reflected; the cruise-type definitions themselves stay reference.
  const tours = (await getToursByCategory('nile-cruises')).filter((tour) => tour.cruiseType === type)
  return <ServerShowcaseHero id={type}><Suspense><RegionTourPage region={{ slug: ct.slug, name: ct.titleEn, nameAr: ct.titleAr, copy: ct.descEn, copyAr: ct.descAr, tourSlugs: tours.map((t) => t.slug) }} tours={tours} page={1} category="nile-cruises" /></Suspense></ServerShowcaseHero>
}
