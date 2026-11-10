'use client'

import type { RecordSeoDescriptor, RecordSeoState } from "@/lib/seo/record-seo"
import type { Metadata } from "next"
import type { EnabledLocale } from "@/lib/i18n/locale-config"

export const RECORD_KINDS = ['tour', 'blog', 'destination', 'event', 'offer', 'category'] as const
export type SeoRecordResponse = {
  record: RecordSeoDescriptor
  state: RecordSeoState
  canEdit: boolean
}
export type RecordSeoPreviewResponse = {
  metadata: Metadata
  structuredData: Record<string, unknown> | null
  locale: EnabledLocale
  publicUrl: string | null
}

export async function fetchSavedRecordSeoPreview(endpoint: string, locale: EnabledLocale): Promise<RecordSeoPreviewResponse> {
  const response = await fetch(`${endpoint}/preview?locale=${locale}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'You do not have access to this saved preview.' : 'Could not validate the saved preview. Retry when ready.')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object') throw new Error('Invalid saved preview response.')
  const preview = data as Record<string, unknown>
  const object = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value)
  if (!object(preview.metadata) || !(preview.structuredData === null || object(preview.structuredData)) || preview.locale !== locale || !(preview.publicUrl === null || typeof preview.publicUrl === 'string')) throw new Error('Invalid saved preview response.')
  return preview as RecordSeoPreviewResponse
}

export function filterSeoRecords(rows: Omit<SeoRecordResponse, 'canEdit'>[], query: string, kind: string, visibility: string) {
  const search = query.trim().toLowerCase()
  return rows.filter(({ record }) => `${record.name} ${record.slug} ${record.publicUrl ?? ''}`.toLowerCase().includes(search) && (kind === 'all' || record.kind === kind) && (visibility === 'all' || (visibility === 'published' ? record.published : !record.published)))
}
