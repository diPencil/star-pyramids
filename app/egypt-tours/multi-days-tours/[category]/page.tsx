import { listCategorySlugs } from '@/lib/server/categories'
import { MultiDayCategoryPage } from '@/components/site'

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
  return <MultiDayCategoryPage categorySlug={categorySlug} />
}
