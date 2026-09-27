import { multiDayCategoryRouteSlugs } from '@/data/tours'
import { MultiDayCategoryPage } from '@/components/site'

export function generateStaticParams() {
  return multiDayCategoryRouteSlugs.map((category) => ({ category }))
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = await params
  return <MultiDayCategoryPage categorySlug={categorySlug} />
}
