import { NextResponse } from 'next/server'
import { listRecordSeo } from '@/lib/server/record-seo'
import { recordSeoAccess, canReadRecordSeo, SEO_PRIVATE_HEADERS } from '@/lib/server/record-seo-api'
import { hasPermission } from '@/lib/server/auth'
export async function GET() {
  const access = await recordSeoAccess()
  if (access.response) return access.response
  try {
    const records = (await listRecordSeo()).filter(entry => canReadRecordSeo(access.user!, entry.record.kind))
    return NextResponse.json({ records, canEdit: hasPermission(access.user!, 'settings.edit') }, { headers: SEO_PRIVATE_HEADERS })
  } catch { return NextResponse.json({ error: 'Could not load record SEO. No totals were estimated.' }, { status: 503, headers: SEO_PRIVATE_HEADERS }) }
}
