'use client'
import { useEffect, useState } from 'react'
import { Eye, Pencil } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { Card, AdminTableTools, AdminTableWrap, AdminTableActions, AdminIconAction } from '@/components/admin/admin-ui'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { heroCatalogue } from '@/lib/hero-catalogue'
import type { HeroState } from '@/lib/website-heroes'
import type { FaqHeroState } from '@/lib/faq-hero'
import { EDITORIAL_HERO_IDS, isEditorialHeroId, originalEditorialHero } from '@/lib/editorial-hero-definitions'
import { SHOWCASE_HERO_IDS, isShowcaseHeroId, type ShowcaseHeroState } from '@/lib/showcase-heroes'
export default function HeroSectionsPage() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [state, setState] = useState<HeroState | null>(null)
  const [editorialStates, setEditorialStates] = useState<Record<string, FaqHeroState>>({})
  const [showcaseStates, setShowcaseStates] = useState<Record<string, ShowcaseHeroState>>({})
  const [error, setError] = useState('')
  useEffect(() => { fetch('/api/admin/website-cms/hero-sections', { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setState(data.state) }).catch(() => setError('Could not load publication status.')) }, [])
  useEffect(() => {
    for (const id of EDITORIAL_HERO_IDS) fetch('/api/admin/website-cms/editorial-heroes/' + id, { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(); setEditorialStates((previous) => ({ ...previous, [id]: data.state })) }).catch(() => setError('Could not load publication status.'))
    for (const id of SHOWCASE_HERO_IDS) fetch('/api/admin/website-cms/showcase-heroes/' + id, { cache: 'no-store' }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(); setShowcaseStates((previous) => ({ ...previous, [id]: data.state })) }).catch(() => setError('Could not load publication status.'))
  }, [])
  const rows = heroCatalogue.filter((hero) => (group === 'all' || hero.group === group) && (hero.name + ' ' + hero.route).toLowerCase().includes(query.toLowerCase()))
  const paging = usePagination(rows)
  return <>
    <PageHead eyebrow="WEBSITE CMS" title="Hero Sections" sub="Page heroes and their authoritative content editors" />
    <Card title="Hero sections">
      {error && <p className="form-error" role="alert">{error}</p>}
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder="Search page name or route">
        <SharedSelect value={group} onChange={setGroup} label="Page group" options={[{ value: 'all', label: 'All groups' }, ...[...new Set(heroCatalogue.map((hero) => hero.group))].map((value) => ({ value, label: value }))]} />
      </AdminTableTools>
      <AdminTableWrap><table className="sp-table"><thead><tr><th>Preview</th><th>Page</th><th>Route</th><th>Hero type</th><th>Management</th><th>Publication</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {paging.pageRows.map((hero) => {
          const publication = hero.id === 'homepage' ? state : isShowcaseHeroId(hero.id) ? showcaseStates[hero.id] : editorialStates[hero.id]
          const thumbnail = hero.id === 'homepage' ? state?.published?.mediaType === 'image' ? state.published.mediaUrl : state?.published?.poster || '/egypt-hero.png' : isEditorialHeroId(hero.id) ? editorialStates[hero.id]?.published?.image || originalEditorialHero(hero.id).image : isShowcaseHeroId(hero.id) ? showcaseStates[hero.id]?.published?.image : null
          return <tr key={hero.id}>
          <td>{thumbnail ? <img src={thumbnail} alt="" width={64} height={42} style={{ objectFit: 'cover', borderRadius: 6 }} /> : '—'}</td>
          <td>{hero.name}</td><td>{hero.route}</td><td>{hero.type}</td><td>{'cms' in hero ? 'Website CMS' : 'editor' in hero ? 'Existing content editor' : 'Source-managed / pending'}</td>
          <td>{'cms' in hero ? publication ? publication.mode === 'original' ? 'Original defaults' : publication.mode : 'Loading…' : 'Source-managed'}</td>
          <td>{publication?.updatedAt ? new Date(publication.updatedAt).toLocaleString() : '—'}</td>
          <td><AdminTableActions>{'editor' in hero && <AdminIconAction icon={Pencil} label={'cms' in hero ? 'Edit hero' : 'Open source editor'} href={hero.editor} />}{!hero.route.includes('[') && <AdminIconAction icon={Eye} label="View public page" href={hero.route} />}</AdminTableActions></td>
        </tr>})}
      </tbody></table></AdminTableWrap>
      <AdminPagination {...paging} onPage={paging.setPage} onPageSize={paging.setPageSize} />
    </Card>
  </>
}
