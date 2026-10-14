import { NextResponse } from 'next/server'
import { isRecordSeoKind, emptyRecordSeoContent } from '@/lib/record-seo'
import { readRecordSeo } from '@/lib/server/record-seo'
import { recordSeoAccess, SEO_PRIVATE_HEADERS } from '@/lib/server/record-seo-api'
import { recordSeoPreview } from '@/lib/seo-diagnostics'
import { ENABLED_LOCALES, type EnabledLocale } from '@/lib/locale-config'
import { getSiteUrl } from '@/lib/seo'
import { findTourBySlug } from '@/lib/server/tours'
import { findBlogBySlug } from '@/lib/server/blogs'
import { generateTouristTripJsonLd, generateBlogPostingJsonLd, generateRecordPageJsonLd } from '@/lib/structured-data'
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await params
  if (!isRecordSeoKind(kind) || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) return NextResponse.json({ error: 'Unknown SEO record.' }, { status: 404, headers: SEO_PRIVATE_HEADERS })
  const access = await recordSeoAccess(kind)
  if (access.response) return access.response
  const locale = new URL(request.url).searchParams.get('locale') ?? 'en'
  if (!ENABLED_LOCALES.includes(locale as EnabledLocale)) return NextResponse.json({ error: 'Unsupported language.' }, { status: 400, headers: SEO_PRIVATE_HEADERS })
  try {
    const { record, state } = await readRecordSeo(kind, slug)
    const content = state.draft ?? state.published ?? emptyRecordSeoContent()
    const detail = record as typeof record & { description?: string; image?: string }
    const snapshot = recordSeoPreview({ name: record.name, route: record.canonicalPaths[0], description: detail.description, image: detail.image }, content, locale as EnabledLocale, await getSiteUrl())
    let structuredData: object | null = null
    if (content.structuredData !== false) {
      if (kind === 'tour' && record.published) { const tour = await findTourBySlug(slug); if (tour) structuredData = generateTouristTripJsonLd(tour) }
      else if (kind === 'blog' && record.published) { const blog = await findBlogBySlug(slug); if (blog) structuredData = generateBlogPostingJsonLd(blog) }
      else if (kind !== 'tour' && kind !== 'blog') structuredData = generateRecordPageJsonLd({ name: record.name, path: record.canonicalPaths[0], collection: kind === 'category' })
    }
    return NextResponse.json({ ...snapshot, structuredData }, { headers: SEO_PRIVATE_HEADERS })
  } catch { return NextResponse.json({ error: 'Preview is unavailable.' }, { status: 503, headers: SEO_PRIVATE_HEADERS }) }
}
