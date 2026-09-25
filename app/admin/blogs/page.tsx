'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Files, Newspaper, Pencil, Plus, Sparkles } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { blogs } from '@/data/content'
import { isCustomSlug, removeCustomItem, useLiveCollection } from '@/lib/admin-store'

export default function BlogsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const liveBlogs = useLiveCollection('blogs', blogs)
  const categories = [...new Set(liveBlogs.map((b) => b.category))]
  const rows = useMemo(() => liveBlogs
    .filter((b) => category === 'all' || b.category === category)
    .filter((b) => `${b.title} ${b.excerpt}`.toLowerCase().includes(query.trim().toLowerCase())), [liveBlogs, query, category])
  const blogSort = useAdminTableSort(rows, {
    story: (row) => row.title,
    category: (row) => row.category,
    date: (row) => Date.parse(row.date) || row.date,
    status: (row) => isCustomSlug(row.slug) ? 'custom' : 'published',
  }, 'date', 'desc')
  const paging = usePagination(blogSort.sortedRows)

  return <>
    <PageHead eyebrow="Content" title="Blogs" titleAr="المدونة" sub="Guides, stories and travel inspiration" subAr="أدلة وقصص وإلهام السفر" actions={<Link className="sp-btn primary" href="/admin/blogs/new"><Plus size={17} /> <AdminText en="New story" ar="مقال جديد" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Stories" ar="المقالات" />, value: liveBlogs.length, note: <AdminText en="Published articles" ar="مقالات منشورة" />, icon: Files },
      { label: <AdminText en="Categories" ar="التصنيفات" />, value: categories.length, note: <AdminText en="Editorial topics" ar="مواضيع تحريرية" />, icon: Newspaper, tone: 'orange' },
      { label: <AdminText en="Custom stories" ar="مقالات مخصصة" />, value: liveBlogs.filter((b) => isCustomSlug(b.slug)).length, note: <AdminText en="Created in dashboard" ar="أنشئت من الداشبورد" />, icon: Sparkles, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: liveBlogs.length, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="All stories" ar="كل المقالات" />} sub={<AdminText en={`${rows.length} of ${liveBlogs.length} shown`} ar={`عرض ${rows.length} من ${liveBlogs.length}`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث في المقالات...' : 'Search stories...'}>
        <select className="sp-filter-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={ar ? 'فلترة حسب التصنيف' : 'Filter by category'}>
          <option value="all">{ar ? 'كل التصنيفات' : 'All categories'}</option>{categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </AdminTableTools>
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Story" ar="المقال" />} column="story" {...blogSort} onSort={blogSort.sortBy} /><SortableTh label={<AdminText en="Category" ar="التصنيف" />} column="category" {...blogSort} onSort={blogSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...blogSort} onSort={blogSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...blogSort} onSort={blogSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((b, index) => <tr key={b.slug}>
          <td className="sp-row-number">{paging.from + index}</td>
          <td><strong>{b.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{b.excerpt.slice(0, 76)}...</small></td>
          <td>{b.category}</td><td>{b.date}</td><td><StatusPill status={isCustomSlug(b.slug) ? 'custom' : 'published'} /></td>
          <td><AdminTableActions>
            <AdminIconAction icon={Pencil} label={ar ? `تعديل ${b.title}` : `Edit ${b.title}`} href={`/admin/blogs/new`} />
            <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${b.title}` : `View ${b.title}`} href={`/blogs/${b.slug}`} />
            {isCustomSlug(b.slug) && <button type="button" className="sp-delete-btn" onClick={() => removeCustomItem('blogs', b.slug)}><AdminText en="Delete" ar="حذف" /></button>}
          </AdminTableActions></td>
        </tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No stories found" ar="لا توجد مقالات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
