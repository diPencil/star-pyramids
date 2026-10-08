'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CircleAlert, CheckCircle2, XCircle, Search } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'pending', en: 'Pending', ar: 'قيد المراجعة' },
  { id: 'published', en: 'Published', ar: 'منشورة' },
  { id: 'rejected', en: 'Rejected', ar: 'مرفوضة' },
] as const

type ReviewRow = {
  publicId: string
  tourSlug: string
  title: string | null
  rating: number
  text: string
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED'
  createdAt: string
  publishedAt: string | null
  user: {
    publicId: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

function userName(row: ReviewRow): string {
  const u = row.user
  if (!u) return 'Unknown customer'
  const parts = [u.firstName, u.lastName].filter(Boolean)
  return parts.length ? parts.join(' ') : u.email
}

export default function ReviewsPage() {
  const ar = useAdminLocale() === 'ar'
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter.toUpperCase())
    if (query.trim()) params.set('q', query.trim())
    fetch(`/api/admin/reviews?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json()) as { reviews?: ReviewRow[]; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load reviews.')
        if (!cancelled && Array.isArray(data.reviews)) {
          setReviews(data.reviews)
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load reviews.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [filter, query])

  const visible = useMemo(() => reviews, [reviews])
  const reviewSort = useAdminTableSort(visible, {
    tourSlug: (row) => row.tourSlug,
    userName: (row) => userName(row),
    rating: (row) => row.rating,
    status: (row) => row.status,
    createdAt: (row) => row.createdAt,
  }, 'createdAt', 'desc')
  const paging = usePagination(reviewSort.sortedRows)

  const moderate = (publicId: string, action: 'publish' | 'reject' | 'pend') => {
    fetch(`/api/admin/reviews/${encodeURIComponent(publicId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { review?: ReviewRow; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not update the review.')
        setReviews((prev) => prev.map((r) => (r.publicId === data.review?.publicId ? data.review! : r)))
        setLoadError('')
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Could not update the review.')
      })
  }

  return (
    <>
      <PageHead
        eyebrow="Reputation"
        title="Reviews"
        titleAr="التقييمات"
        sub="Moderate customer reviews for tours"
        subAr="إدارة تقييمات العملاء للرحلات"
      />
      <Card
        title={<AdminText en="All reviews" ar="كل التقييمات" />}
        sub={<AdminText en={`${visible.length} of ${reviews.length} reviews shown`} ar={`عرض ${visible.length} من ${reviews.length} تقييمات`} />}
      >
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعميل أو رحلة أو نص...' : 'Search customer, tour or text...'}>
          <div className="sp-tabs">
            {statusTabs.map((status) => (
              <button key={status.id} type="button" className={filter === status.id ? 'active' : ''} onClick={() => setFilter(status.id)}>
                {ar ? status.ar : status.en}
              </button>
            ))}
          </div>
        </AdminTableTools>
        {loading ? (
          <p><AdminText en="Loading reviews…" ar="جارٍ تحميل التقييمات…" /></p>
        ) : loadError && !reviews.length ? (
          <AdminEmpty title={<AdminText en="Could not load reviews" ar="تعذر تحميل التقييمات" />} copy={<AdminText en={loadError} ar={loadError} />} />
        ) : visible.length ? (
          <>
            <AdminTableWrap>
              <table className="sp-table">
                <thead>
                  <tr>
                    <th className="sp-row-number">#</th>
                    <SortableTh label={<AdminText en="Tour" ar="الرحلة" />} column="tourSlug" {...reviewSort} onSort={reviewSort.sortBy} />
                    <SortableTh label={<AdminText en="Customer" ar="العميل" />} column="userName" {...reviewSort} onSort={reviewSort.sortBy} />
                    <SortableTh label={<AdminText en="Rating" ar="التقييم" />} column="rating" {...reviewSort} onSort={reviewSort.sortBy} />
                    <SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...reviewSort} onSort={reviewSort.sortBy} />
                    <SortableTh label={<AdminText en="Submitted" ar="تاريخ الإرسال" />} column="createdAt" {...reviewSort} onSort={reviewSort.sortBy} />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paging.pageRows.map((r, index) => (
                    <tr key={r.publicId}>
                      <td className="sp-row-number">{paging.from + index}</td>
                      <td>
                        <Link href={`/egypt-tours/${r.tourSlug}`} target="_blank" rel="noopener noreferrer">
                          {r.tourSlug}
                        </Link>
                      </td>
                      <td>
                        <span className="sp-cust">
                          <Avatar name={userName(r)} src="" size={32} />
                          <span>
                            <strong>{userName(r)}</strong>
                            <small>{r.user.email}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="rev-stars">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <svg key={n} width="16" height="16" viewBox="0 0 24 24" fill={n <= r.rating ? '#ffc531' : 'none'} stroke="#ffc531" strokeWidth="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </span>
                        <span style={{ marginLeft: 8, fontWeight: 600 }}>{r.rating}/5</span>
                      </td>
                      <td><StatusPill status={r.status.toLowerCase()} /></td>
                      <td>{new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td>
                        <AdminTableActions>
                          <AdminIconAction icon={ArrowRight} label={ar ? `عرض التفاصيل` : `View details`} href={`/admin/reviews/${encodeURIComponent(r.publicId)}`} />
                          {r.status === 'PENDING' && (
                            <>
                              <AdminIconAction icon={CheckCircle2} label={ar ? `نشر` : `Publish`} tone="success" onClick={() => moderate(r.publicId, 'publish')} />
                              <AdminIconAction icon={XCircle} label={ar ? `رفض` : `Reject`} tone="danger" onClick={() => moderate(r.publicId, 'reject')} />
                            </>
                          )}
                          {r.status === 'PUBLISHED' && (
                            <>
                              <AdminIconAction icon={XCircle} label={ar ? `رفض` : `Reject`} tone="danger" onClick={() => moderate(r.publicId, 'reject')} />
                              <AdminIconAction icon={CircleAlert} label={ar ? `إعادة للمراجعة` : `Return to pending`} tone="default" onClick={() => moderate(r.publicId, 'pend')} />
                            </>
                          )}
                          {r.status === 'REJECTED' && (
                            <>
                              <AdminIconAction icon={CheckCircle2} label={ar ? `نشر` : `Publish`} tone="success" onClick={() => moderate(r.publicId, 'publish')} />
                              <AdminIconAction icon={CircleAlert} label={ar ? `إعادة للمراجعة` : `Return to pending`} tone="default" onClick={() => moderate(r.publicId, 'pend')} />
                            </>
                          )}
                        </AdminTableActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableWrap>
            <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
          </>
        ) : (
          <AdminEmpty title={<AdminText en="No reviews found" ar="لا توجد تقييمات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />
        )}
        {loadError && reviews.length > 0 && <p role="alert">{loadError}</p>}
      </Card>
    </>
  )
}