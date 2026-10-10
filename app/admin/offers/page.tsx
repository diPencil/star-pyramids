'use client'

import { isOfferActive, offerHref } from '@/lib/special-offers'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BadgePercent, ExternalLink, Eye, EyeOff, Pencil, Plus, Tags, Ticket, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { invalidateOffersBlogsCache, useDbOffersStatus } from '@/lib/offers-blogs-client'

export default function OffersPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [badge, setBadge] = useState('all')
  const [visibility, setVisibility] = useState<'all' | 'published' | 'hidden'>('all')
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  // DB-authoritative catalogue with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never bootstrap
  // rows masquerading as database records.
  const { data, loading, error, retry } = useDbOffersStatus()
  const liveOffers = data ?? []

  const setPublished = async (slug: string, published: boolean) => {
    setActionError('')
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(slug)}`, {
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

  const removeOffer = async (slug: string) => {
    setActionError('')
    try {
      const res = await fetch(`/api/offers/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to delete offer.')
      }
      invalidateOffersBlogsCache()
      // Refresh from the DB source of truth.
      window.location.reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete offer.')
    }
  }

  const badges = useMemo(() => [...new Set(liveOffers.map((offer) => offer.badge))], [liveOffers])
  const rows = useMemo(() => liveOffers
    .filter((offer) => badge === 'all' || offer.badge === badge)
    .filter((offer) => visibility === 'all' || (visibility === 'hidden' ? offer.isPublished === false : offer.isPublished !== false))
    .filter((offer) => `${offer.title} ${offer.copy} ${offer.badge}`.toLowerCase().includes(query.trim().toLowerCase())), [liveOffers, badge, query, visibility])
  const offerSort = useAdminTableSort(rows, {
    offer: (row) => row.title,
    badge: (row) => row.badge,
    price: (row) => row.price ?? -1,
    highlights: (row) => row.highlights?.length ?? 0,
    status: (row) => row.isPublished === false ? 'hidden' : 'published',
  }, 'offer', 'asc')
  const paging = usePagination(offerSort.sortedRows)
  const hiddenCount = liveOffers.filter((o) => o.isPublished === false).length
  const publishedCount = liveOffers.length - hiddenCount

  return <>
    <PageHead eyebrow="Content" title="Special Offers" titleAr="العروض الخاصة" sub="Discounts, campaign labels and linked journeys" subAr="الخصومات وشارات الحملات والرحلات المرتبطة" actions={<Link className="sp-btn primary" href="/admin/offers/new"><Plus size={17} /> <AdminText en="New offer" ar="عرض جديد" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="All offers" ar="كل العروض" />, value: liveOffers.length, note: <AdminText en="DB-backed catalogue" ar="كتالوج قاعدة البيانات" />, icon: Ticket },
      { label: <AdminText en="Campaign labels" ar="شارات الحملات" />, value: badges.length, note: <AdminText en="Unique offer badges" ar="شارات عروض فريدة" />, icon: Tags, tone: 'orange' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: publishedCount, note: <AdminText en="Publication enabled; dates still apply" ar="النشر مفعّل مع مراعاة مواعيد العرض" />, icon: BadgePercent, tone: 'violet' },
      { label: <AdminText en="Hidden" ar="المخفية" />, value: hiddenCount, note: <AdminText en="Admin only" ar="للإدارة فقط" />, icon: EyeOff, tone: 'orange' },
    ]} />
    <Card title={<AdminText en="All offers" ar="كل العروض" />} sub={<AdminText en={`${rows.length} of ${liveOffers.length} offers shown`} ar={`عرض ${rows.length} من ${liveOffers.length} عروض`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعنوان العرض أو الحملة...' : 'Search offer title or campaign...'}>
        <SharedSelect value={badge} onChange={setBadge} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الشارة' : 'Filter by campaign label'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل الشارات' : 'All labels' }, ...badges.map((item) => ({ value: item, label: item }))]} />
        <SharedSelect value={visibility} onChange={(next) => setVisibility(next as typeof visibility)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الظهور' : 'Filter by visibility'} options={[{ value: 'all', label: ar ? 'الكل' : 'All' }, { value: 'published', label: ar ? 'المنشورة' : 'Published' }, { value: 'hidden', label: ar ? 'المخفية' : 'Hidden' }]} />
      </AdminTableTools>
      {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
      {loading ? <AdminEmpty title={<AdminText en="Loading offers…" ar="جارٍ تحميل العروض…" />} copy={<AdminText en="Reading the authoritative catalogue." ar="تتم قراءة السجل المعتمد." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load offers" ar="تعذر تحميل العروض" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Offer" ar="العرض" />} column="offer" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Badge" ar="الشارة" />} column="badge" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Price" ar="السعر" />} column="price" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Highlights" ar="البارزة" />} column="highlights" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...offerSort} onSort={offerSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((offer, index) => {
          const isHidden = offer.isPublished === false
          const scheduled = Boolean(offer.startsAt && Date.parse(offer.startsAt) > Date.now())
          const statusLabel = isHidden ? (ar ? 'مخفية' : 'Hidden') : scheduled ? (ar ? 'مجدولة' : 'Scheduled') : !isOfferActive(offer) ? (ar ? 'منتهية' : 'Expired') : (ar ? 'نشطة' : 'Active')
          return <tr key={offer.slug}>
            <td className="sp-row-number">{paging.from + index}</td>
            <td><strong>{offer.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{offer.copy.slice(0, 70)}...</small></td><td>{offer.badge}</td><td>{offer.price ? `$${offer.price}` : <AdminText en="Not set" ar="غير محدد" />}</td><td>{offer.highlights?.length ?? 0}</td><td><span className={`sp-status is-${isHidden ? 'cancelled' : 'confirmed'}`}>{statusLabel}</span></td>
            <td><AdminTableActions>
              <AdminIconAction icon={Pencil} label={ar ? `تعديل ${offer.title}` : `Edit ${offer.title}`} href={`/admin/offers/new?slug=${encodeURIComponent(offer.slug)}`} />
              <AdminIconAction icon={ExternalLink} label={ar ? `عرض ${offer.title}` : `View ${offer.title}`} href={offerHref(offer)} />
              <button type="button" className="sp-icon-btn" onClick={() => void setPublished(offer.slug, isHidden ? true : false)} aria-label={isHidden ? (ar ? `نشر ${offer.title}` : `Publish ${offer.title}`) : (ar ? `إخفاء ${offer.title}` : `Hide ${offer.title}`)} title={isHidden ? (ar ? 'نشر' : 'Publish') : (ar ? 'إخفاء' : 'Hide')}>{isHidden ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <button type="button" className="sp-delete-btn" onClick={() => setDeleteSlug(offer.slug)}><Trash2 size={14} /> <AdminText en="Delete" ar="حذف" /></button>
            </AdminTableActions></td>
          </tr>
        })}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No offers found" ar="لا توجد عروض" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <AdminConfirmDialog
      open={deleteSlug !== null}
      onClose={() => setDeleteSlug(null)}
      onConfirm={() => { if (deleteSlug) { void removeOffer(deleteSlug) } setDeleteSlug(null) }}
      title={<AdminText en="Delete this offer?" ar="حذف هذا العرض؟" />}
      description={<AdminText en="Removes it from the admin list and public pages everywhere." ar="يحذفه من قائمة الإدارة والصفحات العامة في كل مكان." />}
      confirmLabel={<AdminText en="Delete" ar="حذف" />}
      cancelLabel={<AdminText en="Keep" ar="تراجع" />}
      tone="danger"
    />
  </>
}
