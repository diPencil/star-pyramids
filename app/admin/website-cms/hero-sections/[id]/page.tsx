import { notFound } from 'next/navigation'
import { EditorialHeroEditor } from '@/components/admin/editorial-hero-editor'
import { isEditorialHeroId } from '@/lib/editorial-hero-definitions'
import { isShowcaseHeroId } from '@/lib/showcase-heroes'
import { ShowcaseHeroEditor } from '@/components/admin/showcase-hero-editor'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (isShowcaseHeroId(id)) return <ShowcaseHeroEditor key={id} id={id} />
  if (!isEditorialHeroId(id)) notFound()
  return <EditorialHeroEditor key={id} id={id} />
}
