import Link from 'next/link'
import { notFound } from 'next/navigation'
import { findCmsPage } from '@/lib/cms-coverage'
import { PageVisualEditor } from '@/components/admin/page-visual-editor'
import { PageHead } from '@/components/admin/admin-shell'
import { Card } from '@/components/admin/admin-ui'
import { isPageDocumentId } from '@/lib/additional-page-content'
export default async function Page({ params }: { params: Promise<{ pageKey: string }> }) {
  const { pageKey } = await params
  if (pageKey === 'shared') return <PageVisualEditor key={pageKey} pageId={pageKey} />
  const page = findCmsPage(pageKey)
  if (!page) notFound()
  if (isPageDocumentId(pageKey)) return <PageVisualEditor key={pageKey} pageId={pageKey} />
  return <><PageHead eyebrow="PAGES & SECTIONS" title={page.name} sub={page.route} backHref="/admin/website-cms/pages" /><Card title="Page structure" sub={page.inventory === 'partial' ? 'Partial inventory: remaining presentation content is explicitly marked below.' : 'Original visual section order'}>
    <ol className="cms-structure-list">{page.sections.map((section) => <li key={section.id}><div><h3>{section.name}</h3><p>{section.owner === 'cms' ? 'Managed by the existing CMS editor' : section.owner === 'business' ? 'Managed by the original content module' : section.owner === 'functional' ? 'Fixed application behavior; not a presentation editor' : 'Presentation integration still pending'}</p>{section.note && <p>{section.note}</p>}</div>{section.editor && <Link href={section.editor} className="sp-btn">Open existing editor</Link>}</li>)}</ol>
    {!page.route.includes('[') && <Link href={page.route} className="sp-btn">View public page</Link>}
  </Card></>
}
