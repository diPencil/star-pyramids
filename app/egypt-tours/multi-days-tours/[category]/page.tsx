import { findCategoryBySlug, listCategorySlugs } from '@/lib/server/categories'
import { MultiDayCategoryPage } from '@/components/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { dynamicCategorySeo } from '@/lib/dynamic-seo'
import { RecordPageJsonLd } from '@/lib/structured-data'

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category: slug } = await params
  const category = await findCategoryBySlug(slug)
  if (!category?.active) {
    return { title: 'Category not found', description: 'This category is no longer available.', robots: { index: false, follow: false } }
  }
  return dynamicCategorySeo(category, '/egypt-tours/multi-days-tours')
}

export async function generateStaticParams() {
  // DB-authoritative static params; no pre-render when DB is unreachable.
  try {
    const slugs = await listCategorySlugs()
    return slugs.map((category) => ({ category }))
  } catch {
    return []
  }
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params
  const category = await findCategoryBySlug(categorySlug)
  if (!category?.active) notFound()
  return <><RecordPageJsonLd kind="category" slug={category.slug} name={category.name} path={`/egypt-tours/multi-days-tours/${category.slug}`} collection /><MultiDayCategoryPage categorySlug={categorySlug} /></>
}
