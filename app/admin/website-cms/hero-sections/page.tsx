'use client'
import { useEffect, useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { Card, AdminTableTools, AdminTableWrap, AdminTableActions, AdminIconAction } from '@/components/admin/admin-ui'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { heroCatalogue } from '@/lib/hero-catalogue'
import type { HeroState } from '@/lib/website-heroes'
export default function HeroSectionsPage() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [state, setState] = useState<HeroState | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { fetch('/api/admin/website-cms/hero-sections', { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setState(data.state) }).catch(() => setError('Could not load publication status.')) }, [])
  const rows = heroCatalogue.filter((hero) => (group === 'all' || hero.group === group) && (hero.name + ' ' + hero.route).toLowerCase().includes(query.toLowerCase()))
  const paging = usePagination(rows)
  return <>
    <PageHead eyebrow="WEBSITE CMS" title="Hero Sections" sub="Page heroes and their authoritative content editors" />
    <Card title="Hero sections" sub="Homepage is CMS-managed. Other static templates are not connected yet; dynamic content stays in its existing module.">
      {error && <p className="form-error" role="alert">{error}</p>}
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder="Search page name or route">
        <SharedSelect value={group} onChange={setGroup} label="Page group" options={[{ value: 'all', label: 'All groups' }, ...[...new Set(heroCatalogue.map((hero) => hero.group))].map((value) => ({ value, label: value }))]} />
      </AdminTableTools>
      <AdminTableWrap><table className="sp-table"><thead><tr><th>Preview</th><th>Page</th><th>Route</th><th>Hero type</th><th>Management</th><th>Publication</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {paging.pageRows.map((hero) => <tr key={hero.id}>
          <td>{hero.id === 'homepage' ? <img src={state?.published?.mediaType === 'image' ? state.published.mediaUrl : state?.published?.poster || '/egypt-hero.png'} alt="" width={64} height={42} style={{ objectFit: 'cover', borderRadius: 6 }} /> : '—'}</td>
          <td>{hero.name}</td><td>{hero.route}</td><td>{hero.type}</td><td>{'cms' in hero ? 'Website CMS' : 'editor' in hero ? 'Existing content editor' : 'Source-managed / pending'}</td>
          <td>{hero.id === 'homepage' ? state ? state.mode === 'original' ? 'Original defaults' : state.mode : 'Loading…' : 'Source-managed'}</td>
          <td>{hero.id === 'homepage' && state?.updatedAt ? new Date(state.updatedAt).toLocaleString() : '—'}</td>
          <td><AdminTableActions>{'editor' in hero && <AdminIconAction icon={Pencil} label={hero.id === 'homepage' ? 'Edit hero' : 'Open source editor'} href={hero.editor} />}{!hero.route.includes('[') && <AdminIconAction icon={Eye} label="View public page" href={hero.route} />}</AdminTableActions></td>
        </tr>)}
      </tbody></table></AdminTableWrap>
      <AdminPagination {...paging} onPage={paging.setPage} onPageSize={paging.setPageSize} />
    </Card>
  </>
}
