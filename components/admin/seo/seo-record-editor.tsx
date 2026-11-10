'use client'

import { useEffect, useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { Card, AdminTableTools, AdminTableWrap, AdminTableActions, AdminIconAction } from '../admin-ui'
import { AdminPagination, usePagination } from '../admin-pagination'
import { SharedSelect } from '@/components/shared/forms/shared-select'
import { SeoEditor } from './seo-manager'
import type { RecordSeoDescriptor, RecordSeoState } from '@/lib/seo/record-seo'
import type { Metadata } from 'next'
import type { EnabledLocale } from '@/lib/i18n/locale-config'
export function SeoRecordEditor({ kind, slug }: { kind: string; slug: string }) {
  return <SeoEditor pageKey="about" recordKey={{ kind, slug }} />
}

export { RECORD_KINDS, fetchSavedRecordSeoPreview, filterSeoRecords } from './seo-record-data'
export type { SeoRecordResponse, RecordSeoPreviewResponse } from './seo-record-data'
export { DynamicSeoRecords, SeoDiagnostics } from './seo-record-lists'
