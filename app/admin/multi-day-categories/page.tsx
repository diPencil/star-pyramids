'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Eye, EyeOff, Link2, Pencil, Plus, Tags } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { getMultiDayToursForCategory, getToursByCategory, multiDayCategories } from '@/data/tours'
import { useDbCategories } from '@/lib/catalogue-client'
import { useDbTours } from '@/lib/tours-client'

export default function MultiDayCategoriesPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [removeError, setRemoveError] = useState('')
  const liveCategories = useDbCategories(multiDayCategories)
  const removeCategory = async (slug: string) => {
    setRemoveError('')
    try {
      const res = await fetch(`/api/multi-day-categories/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete category.')
      }
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to delete category.')
    }
  }
  const liveTours = useDbTours(getToursByCategory('multi-days-tours'))
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return liveCategories
      .map((category) => ({ category, linked: getMultiDayToursForCategory(liveTours, category.slug).length }))
      .filter(({ category }) => !q || `${category.name} ${category.nameAr} ${category.slug}`.toLowerCase().includes(q))
  }, [liveCategories, liveTours, query])
  const published = liveCategories.filter((c) => c.active).length
  const assignments = rows.reduce((sum, row) => sum + row.linked, 0)
  const categorySort = useAdminTableSort(rows, {
    category: (row) => row.category.name,
    tours: (row) => row.linked,
    status: (row) => (!row.category.active ? 'hidden' : 'published'),
    order: (row) => row.category.order,
  }, 'order', 'asc')
  const paging = usePagination(categorySort.sortedRows)

  return <>
    <PageHead eyebrow="Catalogue" title="Multi Day Categories" titleAr="فئات الرحلات متعددة الأيام" sub="Manage themed collections and their linked multi-day tours" subAr="إدارة المجموعات الموضوعية ورحلاتها المرتبطة" actions={<Link className="sp-btn primary" href="/admin/multi-day-categories/new"><Plus size={17} /> <AdminText en="New category" ar="فئة جديدة" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Categories" ar="الفئات" />, value: liveCategories.length, note: <AdminText en="Themed collections" ar="مجموعات موضوعية" />, icon: Tags },
      { label: <AdminText en="Linked tours" ar="الرحلات المرتبطة" />, value: assignments, note: <AdminText en="Category assignments" ar="ارتباطات الفئات" />, icon: Link2, tone: 'orange' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: published, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: Eye, tone: 'green' },
      { label: <AdminText en="Hidden" ar="المخفية" />, value: liveCategories.length - published, note: <AdminText en="Hidden from the website" ar="مخفية عن الموقع" />, icon: EyeOff, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="All categories" ar="كل الفئات" />} sub={<AdminText en={`${rows.length} of ${liveCategories.length} shown`} ar={`عرض ${rows.length} من ${liveCategories.length}`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث في الفئات...' : 'Search categories...'} />
      {removeError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{removeError}</p> : null}
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Category" ar="الفئة" />} column="category" {...categorySort} onSort={categorySort.sortBy} /><SortableTh label={<AdminText en="Linked tours" ar="الرحلات المرتبطة" />} column="tours" {...categorySort} onSort={categorySort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...categorySort} onSort={categorySort.sortBy} /><SortableTh label={<AdminText en="Order" ar="الترتيب" />} column="order" {...categorySort} onSort={categorySort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map(({ category, linked }, index) => <tr key={category.slug}>
          <td className="sp-row-number">{paging.from + index}</td>
          <td><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{category.image ? <img src={category.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flex: 'none' }} /> : null}<span><strong>{ar ? category.nameAr : category.name}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{(ar ? category.copyAr : category.copy).slice(0, 76)}...</small></span></span></td>
          <td>{linked}</td>
          <td><StatusPill status={!category.active ? 'hidden' : 'published'} /></td>
          <td>{category.order}</td>
          <td><AdminTableActions>
            <AdminIconAction icon={Pencil} label={ar ? `تعديل ${category.name}` : `Edit ${category.name}`} href={`/admin/multi-day-categories/new?slug=${category.slug}`} />
            <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${category.name}` : `View ${category.name}`} href={`/egypt-tours/multi-days-tours/${category.slug}`} />
            {<button type="button" className="sp-delete-btn" onClick={() => removeCategory(category.slug)}><AdminText en="Delete" ar="حذف" /></button>}
          </AdminTableActions></td>
        </tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No categories found" ar="لا توجد فئات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
