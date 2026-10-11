'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ExternalLink, Eye, EyeOff, Files, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { invalidateOffersBlogsCache, useDbBlogsStatus } from '@/lib/offers-blogs-client'

export default function BlogsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [visibility, setVisibility] = useState<'all' | 'published' | 'hidden'>('all')
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  // DB-authoritative catalogue with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never bootstrap
  // rows masquerading as database records.
  const { data, loading, error, retry } = useDbBlogsStatus()
  const liveBlogs = data ?? []

  const setPublished = async (slug: string, published: boolean) => {
    setActionError('')
    try {
      const res = await fetch(`/api/blogs/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: published }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to update visibility.')
      }
      invalidateOffersBlogsCache()
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update visibility.')
    }
  }

  const removeBlog = async (slug: string) => {
    setActionError('')
    try {
      const res = await fetch(`/api/blogs/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete story.')
      }
      invalidateOffersBlogsCache()
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete story.')
    }
  }

  const categories = useMemo(() => [...new Set(liveBlogs.map((b) => b.category))], [liveBlogs])
  const rows = useMemo(() => liveBlogs
    .filter((b) => category === 'all' || b.category === category)
    .filter((b) => visibility === 'all' || (visibility === 'hidden' ? b.isPublished === false : b.isPublished !== false))
    .filter((b) => `${b.title} ${b.excerpt}`.toLowerCase().includes(query.trim().toLowerCase())), [liveBlogs, query, category, visibility])
  const blogSort = useAdminTableSort(rows, {
    story: (row) => row.title,
    category: (row) => row.category,
    date: (row) => Date.parse(row.date) || row.date,
    status: (row) => row.isPublished === false ? 'hidden' : 'published',
  }, 'date', 'desc')
  const paging = usePagination(blogSort.sortedRows)
  const hiddenCount = liveBlogs.filter((b) => b.isPublished === false).length
  const publishedCount = liveBlogs.length - hiddenCount

  return <>
    <PageHead eyebrow="Content" title="Blogs" titleAr="المدونة" sub="Guides, stories and travel inspiration" subAr="أدلة وقصص وإلهام السفر" actions={<Link className="sp-btn primary" href="/admin/blogs/new"><Plus size={17} /> <AdminText en="New story" ar="مقال جديد" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="Stories" ar="المقالات" />, value: liveBlogs.length, note: <AdminText en="DB-backed catalogue" ar="كتالوج قاعدة البيانات" />, icon: Files },
      { label: <AdminText en="Categories" ar="التصنيفات" />, value: categories.length, note: <AdminText en="Editorial topics" ar="مواضيع تحريرية" />, icon: Newspaper, tone: 'orange' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: publishedCount, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: ExternalLink, tone: 'violet' },
      { label: <AdminText en="Hidden" ar="المخفية" />, value: hiddenCount, note: <AdminText en="Admin only" ar="للإدارة فقط" />, icon: EyeOff, tone: 'orange' },
    ]} />
    <Card title={<AdminText en="All stories" ar="كل المقالات" />} sub={<AdminText en={`${rows.length} of ${liveBlogs.length} shown`} ar={`عرض ${rows.length} من ${liveBlogs.length}`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث في المقالات...' : 'Search stories...'}>
          <SharedSelect value={category} onChange={setCategory} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب التصنيف' : 'Filter by category'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل التصنيفات' : 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]} />
          <SharedSelect value={visibility} onChange={(next) => setVisibility(next as typeof visibility)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الظهور' : 'Filter by visibility'} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'published', label: ar ? 'المنشورة' : 'Published' }, { value: 'hidden', label: ar ? 'المخفية' : 'Hidden' }]} />
      </AdminTableTools>
      {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
      {loading ? <AdminEmpty title={<AdminText en="Loading stories…" ar="جارٍ تحميل المقالات…" />} copy={<AdminText en="Reading the authoritative catalogue." ar="تتم قراءة السجل المعتمد." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load stories" ar="تعذر تحميل المقالات" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Story" ar="المقال" />} column="story" {...blogSort} onSort={blogSort.sortBy} /><SortableTh label={<AdminText en="Category" ar="التصنيف" />} column="category" {...blogSort} onSort={blogSort.sortBy} /><SortableTh label={<AdminText en="Date" ar="التاريخ" />} column="date" {...blogSort} onSort={blogSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...blogSort} onSort={blogSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((b, index) => {
          const isHidden = b.isPublished === false
          return <tr key={b.slug}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td><strong>{b.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{b.excerpt.slice(0, 76)}...</small></td>
            <td>{b.category}</td><td>{b.date}</td><td><span className={`sp-status is-${isHidden ? 'cancelled' : 'confirmed'}`}>{isHidden ? (ar ? 'مخفية' : 'Hidden') : (ar ? 'منشورة' : 'Published')}</span></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? `تعديل ${b.title}` : `Edit ${b.title}`} href={`/admin/blogs/new?slug=${encodeURIComponent(b.slug)}`} />
              <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${b.title}` : `View ${b.title}`} href={`/blogs/${b.slug}`} />
              <button type="button" className="sp-icon-btn" onClick={() => void setPublished(b.slug, isHidden ? true : false)} aria-label={isHidden ? (ar ? `نشر ${b.title}` : `Publish ${b.title}`) : (ar ? `إخفاء ${b.title}` : `Hide ${b.title}`)} title={isHidden ? (ar ? 'نشر' : 'Publish') : (ar ? 'إخفاء' : 'Hide')}>{isHidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <AdminIconAction icon={Trash2} label={ar ? `حذف ${b.title}` : `Delete ${b.title}`} tone="danger" onClick={() => setDeleteSlug(b.slug)} />
            </AdminTableActions></td>
          </tr>
        })}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No stories found" ar="لا توجد مقالات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <AdminConfirmDialog
      open={deleteSlug !== null}
      onClose={() => setDeleteSlug(null)}
      onConfirm={() => { if (deleteSlug) { void removeBlog(deleteSlug) } setDeleteSlug(null) }}
      title={<AdminText en="Delete this story?" ar="حذف هذا المقال؟" />}
      description={<AdminText en="Removes it from the admin list and public pages everywhere." ar="يحذفه من قائمة الإدارة والصفحات العامة في كل مكان." />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      cancelLabel={<AdminText en="Keep" ar="تراجع" />}
      tone="danger"
    />
  </>
}
