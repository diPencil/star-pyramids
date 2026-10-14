import { NextResponse } from 'next/server'
import { recordSeoAccess, canReadRecordSeo, SEO_PRIVATE_HEADERS } from '@/lib/server/record-seo-api'
import { listRecordSeo } from '@/lib/server/record-seo'
import { readSeoState } from '@/lib/server/seo-manager'
import { SEO_PAGES, isSeoPage, currentSeo } from '@/lib/seo-manager'
import { diagnoseSeo, type DiagnosticPage } from '@/lib/seo-diagnostics'
export async function GET() {
  const access = await recordSeoAccess()
  if (access.response) return access.response
  try {
    const allRecords = await listRecordSeo()
    const records = allRecords.filter(entry => canReadRecordSeo(access.user!, entry.record.kind))
    const staticPages: DiagnosticPage[] = await Promise.all(Object.keys(SEO_PAGES).filter(isSeoPage).map(async id => ({ id, route: SEO_PAGES[id]!.route, published: true, seo: currentSeo(await readSeoState(id), id) })))
    const dynamicPages: DiagnosticPage[] = records.flatMap(({ record, state }) => record.canonicalPaths.map(route => ({ id: record.kind + ':' + record.slug, route, published: record.published, seo: state.published, title: record.name + ' | STAR PYRAMIDS', description: record.description || record.name, image: record.image, baselineVerified: true })))
    const pages = [...staticPages, ...dynamicPages]
    const known = new Set([...staticPages.map(page => page.route), ...allRecords.filter(entry => entry.record.published).flatMap(entry => entry.record.canonicalPaths)])
    const eligible = pages.filter(page => page.published && page.seo?.index !== false && (!page.seo?.canonical || page.seo.canonical === page.route))
    return NextResponse.json({ checks: diagnoseSeo(pages, known), counts: { records: records.length, staticPages: staticPages.length, indexable: eligible.length, noindex: pages.filter(page => page.seo?.index === false).length }, googleConnected: false }, { headers: SEO_PRIVATE_HEADERS })
  } catch { return NextResponse.json({ error: 'Could not verify complete SEO diagnostics. No results were estimated.' }, { status: 503, headers: SEO_PRIVATE_HEADERS }) }
}
