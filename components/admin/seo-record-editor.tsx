'use client'

import { useEffect, useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { Card, AdminTableTools, AdminTableWrap, AdminTableActions, AdminIconAction } from './admin-ui'
import { AdminPagination, usePagination } from './admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { SeoEditor } from './seo-manager'
import type { RecordSeoDescriptor, RecordSeoState } from '@/lib/record-seo'
import type { Metadata } from 'next'
import type { EnabledLocale } from '@/lib/locale-config'

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
export function SeoRecordEditor({ kind, slug }: { kind: string; slug: string }) {
  return <SeoEditor pageKey="about" recordKey={{ kind, slug }} />
}

export function filterSeoRecords(rows: Omit<SeoRecordResponse, 'canEdit'>[], query: string, kind: string, visibility: string) {
  const search = query.trim().toLowerCase()
  return rows.filter(({ record }) => `${record.name} ${record.slug} ${record.publicUrl ?? ''}`.toLowerCase().includes(search) && (kind === 'all' || record.kind === kind) && (visibility === 'all' || (visibility === 'published' ? record.published : !record.published)))
}

function useSeoResource<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    void fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'You do not have access to these SEO records.' : 'Could not load SEO data.')
      const result: T = await response.json()
      if (!controller.signal.aborted) setData(result)
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load SEO data.') })
    return () => controller.abort()
  }, [endpoint, attempt])
  return { data, error, retry: () => setAttempt(value => value + 1) }
}

export function DynamicSeoRecords() {
  const { data, error, retry } = useSeoResource<{ records: Omit<SeoRecordResponse, 'canEdit'>[]; canEdit: boolean }>('/api/admin/website-cms/seo/records')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [visibility, setVisibility] = useState('all')
  const rows = filterSeoRecords(data?.records ?? [], query, kind, visibility)
  const paging = usePagination(rows)
  const filter = (set: (value: string) => void) => (value: string) => { set(value); paging.setPage(1) }
  return <>
    <p className="cms-coverage-note">Cars are not eligible for individual SEO: they have no public detail URL; use Static Pages / Rent Car. Tour-linked offers redirect to their tour, so their SEO is managed on the tour record rather than in a competing offer override.</p>
    {error && <p role="alert" className="form-error">{error} <button type="button" className="sp-btn" onClick={retry}>Retry</button></p>}
    {!data && !error && <p role="status">Loading dynamic SEO records...</p>}
    {data && <Card title="Dynamic content SEO">
      <AdminTableTools query={query} onQueryChange={filter(setQuery)} placeholder="Search record name, slug or URL">
        <SharedSelect label="Record type" value={kind} onChange={filter(setKind)} options={['all', ...RECORD_KINDS].map(value => ({ value, label: value === 'all' ? 'All types' : value }))} />
        <SharedSelect label="Content visibility" value={visibility} onChange={filter(setVisibility)} options={[{ value: 'all', label: 'All records' }, { value: 'published', label: 'Published' }, { value: 'hidden', label: 'Hidden' }]} />
      </AdminTableTools>
      <AdminTableWrap><table className="sp-table"><thead><tr><th>Record / URL</th><th>Type</th><th>Content</th><th>SEO publication</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {paging.pageRows.map(({ record, state }) => <tr key={`${record.kind}:${record.slug}`}><td className="seo-copy"><strong>{record.name}</strong><small className="cms-row-note">{record.publicUrl ?? 'No public URL'}</small></td><td>{record.kind}</td><td>{record.published ? 'Published' : 'Hidden'}</td><td>{state.published ? 'Published override' : 'Original defaults'}{state.draft && <small className="cms-row-note">Saved draft</small>}</td><td>{state.updatedAt ? new Date(state.updatedAt).toLocaleString() : 'Not recorded'}</td><td><AdminTableActions><AdminIconAction icon={Pencil} href={`/admin/website-cms/seo/dynamic/${encodeURIComponent(record.kind)}/${encodeURIComponent(record.slug)}`} label="Open record SEO" />{record.published && record.publicUrl && safePublicUrl(record.publicUrl) && <AdminIconAction icon={Eye} href={record.publicUrl} label="View public page" />}</AdminTableActions></td></tr>)}
        {!rows.length && <tr><td colSpan={6}>No records match these filters.</td></tr>}
      </tbody></table></AdminTableWrap><AdminPagination {...paging} onPage={paging.setPage} onPageSize={paging.setPageSize} />
    </Card>}
  </>
}

function safePublicUrl(value: string) { return /^\/(?!\/)/.test(value) && !value.includes('\\') }
type Diagnostic = { id: string; route: string; locale?: string; severity: 'confirmed' | 'issue' | 'recommendation' | 'unverified'; code: string; message: string }
export function SeoDiagnostics() {
  const { data, error, retry } = useSeoResource<{ checks: Diagnostic[]; counts: { records: number; staticPages: number; indexable: number; noindex: number }; googleConnected: false }>('/api/admin/website-cms/seo/diagnostics')
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('all')
  const [locale, setLocale] = useState('all')
  const rows = (data?.checks ?? []).filter(row => `${row.route} ${row.code} ${row.message}`.toLowerCase().includes(query.toLowerCase()) && (severity === 'all' || row.severity === severity || severity === 'confirmed' && row.severity === 'issue') && (locale === 'all' || row.locale === locale))
  const paging = usePagination(rows)
  const filter = (set: (value: string) => void) => (value: string) => { set(value); paging.setPage(1) }
  return <>
    {error && <p role="alert" className="form-error">{error} <button type="button" className="sp-btn" onClick={retry}>Retry</button></p>}
    {!data && !error && <p role="status">Loading technical SEO diagnostics...</p>}
    {data && <><p className="cms-coverage-note">{data.counts.records} records | {data.counts.staticPages} static pages | {data.counts.indexable} index allowed | {data.counts.noindex} noindex. Source diagnostics only. Google Search Console is not connected.</p><Card title="Technical SEO diagnostics">
      <AdminTableTools query={query} onQueryChange={filter(setQuery)} placeholder="Search route, code or diagnostic">
        <SharedSelect label="Severity" value={severity} onChange={filter(setSeverity)} options={['all', 'confirmed', 'recommendation', 'unverified'].map(value => ({ value, label: value === 'all' ? 'All severities' : value }))} />
        <SharedSelect label="Language" value={locale} onChange={filter(setLocale)} options={['all', 'en', 'es', 'it'].map(value => ({ value, label: value === 'all' ? 'All languages' : value.toUpperCase() }))} />
      </AdminTableTools><AdminTableWrap><table className="sp-table"><thead><tr><th>Route</th><th>Language</th><th>Severity</th><th>Code</th><th>Diagnostic</th></tr></thead><tbody>{paging.pageRows.map((row, index) => <tr key={`${row.id}:${row.locale}:${index}`}><td className="seo-copy">{row.route}</td><td>{row.locale?.toUpperCase() ?? 'All'}</td><td>{row.severity === 'issue' ? 'confirmed' : row.severity}</td><td>{row.code}</td><td className="seo-copy">{row.message}</td></tr>)}{!rows.length && <tr><td colSpan={5}>No diagnostics match these filters.</td></tr>}</tbody></table></AdminTableWrap><AdminPagination {...paging} onPage={paging.setPage} onPageSize={paging.setPageSize} />
    </Card></>}
  </>
}
