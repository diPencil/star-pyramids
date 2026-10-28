'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { WEBSITE_REVIEW_SCOPE } from '@/lib/review-scope'
import { ArrowRight, CircleAlert, CheckCircle2, XCircle } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminTableActions, AdminTableTools, AdminTableWrap, Avatar, Card, } from '@/components/admin/admin-ui'
import { SortableTh } from '@/components/admin/admin-table-sort'
import { useLocale } from '@/components/locale'
import { reviewText } from '@/lib/review-copy'
import { useCurrentUser } from '@/lib/use-current-user'
import { AdminPagination } from '@/components/admin/admin-pagination'
import { toast } from '@/components/admin/admin-toaster'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'pending', en: 'Pending', ar: 'قيد المراجعة' },
  { id: 'published', en: 'Published', ar: 'منشورة' },
  { id: 'rejected', en: 'Rejected', ar: 'مرفوضة' },
] as const

type ReviewRow = {
  trip?: { title: string; href: string } | null
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
  const { locale } = useLocale()
  const t = (text: string) => reviewText(text, locale)
  const ar = false
  const AdminText = ({ en }: { en: string; ar?: string }) => <>{t(en)}</>
  const StatusPill = ({ status }: { status: string }) => <span className={`sp-pill is-${status}`}>{t(status.charAt(0).toUpperCase() + status.slice(1))}</span>
  const { user } = useCurrentUser()
  const canModerate = !!user && (user.roles.includes('SUPER_ADMIN') || user.permissions?.includes('reviews.moderate'))
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [scope, setScope] = useState('all')
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(20), [total, setTotal] = useState(0), [refresh, setRefresh] = useState(0)
  const [sortKey, setSortKey] = useState('createdAt'), [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const reviewSort = { sortKey, direction, sortBy: (key: string) => { setPage(1); setSortKey(key); setDirection(key === sortKey && direction === 'asc' ? 'desc' : 'asc') } }
  const pagingValues = { page, pageSize, setPage, setPageSize: (size: number) => { setPage(1); setPageSize(size) }, total, from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total), pageCount: Math.max(1, Math.ceil(total / pageSize)) }
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(''); setReviews([])
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize), scope, sort: sortKey, direction })
    if (filter !== 'all') params.set('status', filter.toUpperCase())
    if (query.trim()) params.set('q', query.trim())
    fetch(`/api/admin/reviews?${params.toString()}`, { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json()) as { reviews?: ReviewRow[]; pagination?: { total: number }; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load reviews.')
        if (!cancelled && Array.isArray(data.reviews)) {
          setReviews(data.reviews)
          setTotal(data.pagination?.total ?? 0)
          const lastPage = Math.max(1, Math.ceil((data.pagination?.total ?? 0) / pageSize))
          if (page > lastPage) { setPage(lastPage); return }
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
  }, [filter, query, scope, page, pageSize, sortKey, direction, refresh])

  const visible = reviews
  const paging = { ...pagingValues, pageRows: reviews }

  const moderate = (publicId: string, action: 'publish' | 'reject' | 'pend') => {
    if (busyRef.current || !canModerate) return
    busyRef.current = true; setBusy(true)
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
        setRefresh(value => value + 1)
        toast.success(action === 'publish'
          ? t('Review published.')
          : action === 'reject'
            ? t('Review rejected.')
            : t('Review returned to pending.'),
        { dedupeKey: `reviews-${action}` })
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Could not update the review.', { dedupeKey: 'reviews-moderate-error' })
      }).finally(() => { busyRef.current = false; setBusy(false) })
  }

  return (
    <>
      <PageHead
        eyebrow="Reputation"
        title={t("Reviews")}
        titleAr="التقييمات"
        sub={t("Moderate website and trip reviews")}
        subAr="إدارة تقييمات العملاء للرحلات"
      />
      <Card
        title={<AdminText en="All reviews" ar="كل التقييمات" />}
        sub={<AdminText en={`${total} ${t('Reviews')}`} ar={`عرض ${visible.length} من ${reviews.length} تقييمات`} />}
      >
        <AdminTableTools query={query} onQueryChange={value => { setPage(1); setQuery(value) }} placeholder={ar ? 'ابحث بعميل أو رحلة أو نص...' : t('Search customer, tour or text...')}>
          <div className="sp-tabs" role="group" aria-label={t("Review source")}>{[["all", "All reviews"], ["website", "Website reviews"], ["trips", "Trip reviews"]].map(([value, label]) => <button type="button" key={value} aria-pressed={scope === value} className={scope === value ? "active" : ""} onClick={() => { setPage(1); setScope(value) }}>{t(label)}</button>)}</div>
          <div className="sp-tabs">
            {statusTabs.map((status) => (
              <button key={status.id} type="button" className={filter === status.id ? 'active' : ''} aria-pressed={filter === status.id} onClick={() => { setPage(1); setFilter(status.id) }}>
                {t(status.en)}
              </button>
            ))}
          </div>
        </AdminTableTools>
        {loading ? (
          <p><AdminText en="Loading reviews…" ar="جارٍ تحميل التقييمات…" /></p>
        ) : loadError && !reviews.length ? (
          <AdminEmpty title={<AdminText en="Could not load reviews" ar="تعذر تحميل التقييمات" />} copy={<><AdminText en={loadError} ar={loadError} /><button className="sp-btn" onClick={() => setRefresh(v => v + 1)}>{t("Retry")}</button></>} />
        ) : visible.length ? (
          <>
            <AdminTableWrap>
              <table className="sp-table">
                <thead>
                  <tr>
                    <th className="sp-row-number">#</th>
                    <SortableTh label={<AdminText en="Review source" ar="مصدر التقييم" />} column="tourSlug" {...reviewSort} onSort={reviewSort.sortBy} />
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
                        <Link href={r.tourSlug === WEBSITE_REVIEW_SCOPE ? '/' : r.trip?.href ?? `/admin/reviews/${encodeURIComponent(r.publicId)}`} target="_blank" rel="noopener noreferrer">
                          {r.tourSlug === WEBSITE_REVIEW_SCOPE ? <AdminText en="Website review" ar="تقييم الموقع" /> : r.trip?.title ?? t('Trip unavailable')}
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
                          <AdminIconAction icon={ArrowRight} label={ar ? `عرض التفاصيل` : t('View details')} href={`/admin/reviews/${encodeURIComponent(r.publicId)}`} />
                          {canModerate && !busy && r.status === 'PENDING' && (
                            <>
                              <AdminIconAction icon={CheckCircle2} label={ar ? `نشر` : t('Publish')} tone="success" onClick={() => moderate(r.publicId, 'publish')} />
                              <AdminIconAction icon={XCircle} label={ar ? `رفض` : t('Reject')} tone="danger" onClick={() => moderate(r.publicId, 'reject')} />
                            </>
                          )}
                          {canModerate && !busy && r.status === 'PUBLISHED' && (
                            <>
                              <AdminIconAction icon={XCircle} label={ar ? `رفض` : `Reject`} tone="danger" onClick={() => moderate(r.publicId, 'reject')} />
                              <AdminIconAction icon={CircleAlert} label={ar ? `إعادة للمراجعة` : t('Return to pending')} tone="default" onClick={() => moderate(r.publicId, 'pend')} />
                            </>
                          )}
                          {canModerate && !busy && r.status === 'REJECTED' && (
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
