'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, FileText, Layers, Pencil, Send } from 'lucide-react'
import { PageHead } from './admin-shell'
import { Card, AdminStats, AdminTableTools, AdminTableWrap, AdminTableActions, AdminIconAction } from './admin-ui'
import { AdminPagination, usePagination } from './admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import type { CmsPageDefinition } from '@/lib/cms-coverage'
import { cmsSharedRegistry } from '@/lib/cms-coverage'
type CmsPageRow = CmsPageDefinition & { statuses: { scope: string; mode: string; draft: boolean }[]; updatedAt: string | null; hasDraft: boolean; hasPublication: boolean }
type Snapshot = { pages: CmsPageRow[]; counts: { pages: number; manageable: number; routePatterns: number; sections: number; cms: number; business: number; functional: number; uncovered: number; partialInventories: number }; published: number; drafts: number }
export function CmsPagesDashboard({ overview = false }: { overview?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [status, setStatus] = useState('all')
  useEffect(() => { const controller = new AbortController(); setError(''); void fetch('/api/admin/website-cms/pages', { signal: controller.signal, cache: 'no-store' }).then(async (response) => { const next = await response.json(); if (!response.ok) throw new Error(); if (!controller.signal.aborted) setData(next) }).catch(() => { if (!controller.signal.aborted) setError('Could not load CMS publication data.') }); return () => controller.abort() }, [retry])
  const rows = (data?.pages ?? []).filter((page) => (group === 'all' || group === page.group) && (status === 'all' || status === 'draft' && page.hasDraft || status === 'published' && page.hasPublication || status === 'uncovered' && page.sections.some((s) => s.owner === 'uncovered')) && `${page.name} ${page.route}`.toLowerCase().includes(query.toLowerCase()))
  const paging = usePagination(rows)
  return <>
    <PageHead eyebrow="WEBSITE CMS" title={overview ? 'Website CMS' : 'Pages & Sections'} sub="Page structure, presentation editors and original content sources" />
    {error && <p className="form-error" role="alert">{error} <button className="sp-btn" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
    {!data && !error && <p role="status">Loading real publication data…</p>}
    {data && <>
      <AdminStats items={[{ label: 'Manageable pages / templates', value: data.counts.manageable, note: `${data.counts.pages} registered · ${data.counts.routePatterns} route patterns`, icon: FileText }, { label: 'Pages with CMS publications', value: data.published, note: 'At least one published CMS document', icon: Send, tone: 'green' }, { label: 'Pages with draft changes', value: data.drafts, note: 'Saved draft differs from public content', icon: Pencil, tone: 'orange' }, { label: 'Registered page sections', value: data.counts.sections, note: `${data.counts.cms} CMS · ${data.counts.business} business · ${data.counts.functional} functional`, icon: Layers }]} />
      <p className="cms-coverage-note">{data.counts.uncovered} registered presentation sections still need integration. {data.counts.partialInventories} page/template inventories are partial. This is coverage tracking, not a full-site completion claim.</p>
      {overview && <Card title="Recently updated CMS content" action={<Link href="/admin/website-cms/pages" className="sp-btn">All pages & sections</Link>}>
        {data.pages.some((page) => page.updatedAt) ? <ul className="cms-recent-list">{data.pages.filter((page) => page.updatedAt).sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!)).slice(0, 6).map((page) => <li key={page.key}><Link href={'/admin/website-cms/pages/' + page.key}>{page.name}</Link><span>{new Date(page.updatedAt!).toLocaleString()}</span></li>)}</ul> : <p>No saved CMS changes yet.</p>}
      </Card>}
      {overview && <Card title="Shared content sources"><ul className="cms-recent-list">{cmsSharedRegistry.map((section) => <li key={section.id}><span>{section.name}</span>{section.editor ? <Link className="sp-btn" href={section.editor}>Open original editor</Link> : <span>{section.owner === 'functional' ? 'Fixed behavior' : 'Integration pending'}</span>}</li>)}</ul></Card>}
    </>}
    <Card title={overview ? 'Quick access to pages' : 'Actual pages & sections'}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder="Search page name or route"><SharedSelect value={group} label="Page group" onChange={setGroup} options={[{ value: 'all', label: 'All groups' }, ...[...new Set((data?.pages ?? []).map((page) => page.group))].map((value) => ({ value, label: value }))]} /><SharedSelect value={status} label="Publication / coverage" onChange={setStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'draft', label: 'Draft changes' }, { value: 'published', label: 'Has CMS publication' }, { value: 'uncovered', label: 'Needs integration' }]} /></AdminTableTools>
      <AdminTableWrap><table className="sp-table"><thead><tr><th>Page</th><th>Route</th><th>Type</th><th>Languages</th><th>Publication</th><th>Sections</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{paging.pageRows.map((page) => <tr key={page.key}><td><strong>{page.name}</strong>{page.inventory === 'partial' && <small className="cms-row-note">Partial inventory</small>}</td><td>{page.route}</td><td>{page.type}</td><td>{page.sections.some((s) => s.owner === 'cms') ? 'EN / ES / IT' : 'Owned by source'}</td><td>{page.statuses.length ? page.statuses.map((status) => <div key={status.scope}>{status.scope}: {status.mode}{status.draft && ' · Draft changes'}</div>) : 'Original source'}</td><td>{page.sections.length}</td><td>{page.updatedAt ? new Date(page.updatedAt).toLocaleString() : '—'}</td><td><AdminTableActions><AdminIconAction icon={Pencil} href={'/admin/website-cms/pages/' + page.key} label="Open page structure" />{!page.route.includes('[') && <AdminIconAction icon={Eye} href={page.route} label="View public page" />}</AdminTableActions></td></tr>)}{data && rows.length === 0 && <tr><td colSpan={8}>No pages match these filters.</td></tr>}</tbody></table></AdminTableWrap>
      <AdminPagination {...paging} onPage={paging.setPage} onPageSize={paging.setPageSize} />
    </Card>
  </>
}
