import { notFound } from 'next/navigation'
import { EditorialHeroEditor } from '@/components/admin/cms/editorial-hero-editor'
import { isEditorialHeroId } from '@/lib/cms/heroes/editorial-hero-definitions'
import { isShowcaseHeroId } from '@/lib/cms/heroes/showcase-heroes'
import { ShowcaseHeroEditor } from '@/components/admin/cms/showcase-hero-editor'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (isShowcaseHeroId(id)) return <ShowcaseHeroEditor key={id} id={id} />
  if (!isEditorialHeroId(id)) notFound()
  return <EditorialHeroEditor key={id} id={id} />
}
