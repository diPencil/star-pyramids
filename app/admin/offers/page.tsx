'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BadgePercent, CircleDollarSign, ExternalLink, Pencil, Plus, Tags, Ticket } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { offers } from '@/data/content'
import { isCustomSlug, removeCustomItem, removeTourDeal, useLiveCollection } from '@/lib/admin-store'

export default function OffersPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [badge, setBadge] = useState('all')
  const liveOffers = useLiveCollection('offers', offers)
  const badges = [...new Set(liveOffers.map((offer) => offer.badge))]
  const rows = useMemo(() => liveOffers
    .filter((offer) => badge === 'all' || offer.badge === badge)
    .filter((offer) => `${offer.title} ${offer.copy} ${offer.badge}`.toLowerCase().includes(query.trim().toLowerCase())), [liveOffers, badge, query])
  const offerSort = useAdminTableSort(rows, {
    offer: (row) => row.title,
    badge: (row) => row.badge,
    price: (row) => row.price ?? -1,
    highlights: (row) => row.highlights?.length ?? 0,
    status: (row) => isCustomSlug(row.slug) ? 'custom' : 'published',
  }, 'offer', 'asc')
  const paging = usePagination(offerSort.sortedRows)

  const remove = (slug: string) => {
    removeCustomItem('offers', slug)
    if (slug.startsWith('custom-offer-')) removeTourDeal(slug.replace('custom-offer-', ''))
  }

  return <>
    <PageHead eyebrow="Content" title="Special Offers" titleAr="العروض الخاصة" sub="Discounts, campaign labels and linked journeys" subAr="الخصومات وشارات الحملات والرحلات المرتبطة" actions={<Link className="sp-btn primary" href="/admin/offers/new"><Plus size={17} /> <AdminText en="New offer" ar="عرض جديد" /></Link>} />
    <AdminStats items={[
      { label: <AdminText en="All offers" ar="كل العروض" />, value: liveOffers.length, note: <AdminText en="Current campaigns" ar="الحملات الحالية" />, icon: Ticket },
      { label: <AdminText en="Campaign labels" ar="شارات الحملات" />, value: badges.length, note: <AdminText en="Unique offer badges" ar="شارات عروض فريدة" />, icon: Tags, tone: 'orange' },
      { label: <AdminText en="Priced offers" ar="عروض مسعرة" />, value: liveOffers.filter((offer) => offer.price).length, note: <AdminText en="Offers with confirmed price" ar="عروض بسعر مؤكد" />, icon: CircleDollarSign, tone: 'green' },
      { label: <AdminText en="Published" ar="المنشورة" />, value: liveOffers.length, note: <AdminText en="Visible on the website" ar="ظاهرة على الموقع" />, icon: BadgePercent, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="All offers" ar="كل العروض" />} sub={<AdminText en={`${rows.length} of ${liveOffers.length} offers shown`} ar={`عرض ${rows.length} من ${liveOffers.length} عروض`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعنوان العرض أو الحملة...' : 'Search offer title or campaign...'}>
        <select className="sp-filter-select" value={badge} onChange={(event) => setBadge(event.target.value)} aria-label={ar ? 'فلترة حسب الشارة' : 'Filter by campaign label'}><option value="all">{ar ? 'كل الشارات' : 'All labels'}</option>{badges.map((item) => <option key={item}>{item}</option>)}</select>
      </AdminTableTools>
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Offer" ar="العرض" />} column="offer" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Badge" ar="الشارة" />} column="badge" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Price" ar="السعر" />} column="price" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Highlights" ar="البارزة" />} column="highlights" {...offerSort} onSort={offerSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...offerSort} onSort={offerSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((offer, index) => <tr key={offer.slug}>
          <td className="sp-row-number">{paging.from + index}</td>
          <td><strong>{offer.title}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{offer.copy.slice(0, 70)}...</small></td><td>{offer.badge}</td><td>{offer.price ? `$${offer.price}` : <AdminText en="Not set" ar="غير محدد" />}</td><td>{offer.highlights?.length ?? 0}</td><td><StatusPill status={isCustomSlug(offer.slug) ? 'custom' : 'published'} /></td>
          <td><AdminTableActions><AdminIconAction icon={Pencil} label={ar ? `تعديل ${offer.title}` : `Edit ${offer.title}`} href={`/admin/offers/new`} /><AdminIconAction icon={ExternalLink} label={ar ? `عرض ${offer.title}` : `View ${offer.title}`} href={`/special-offers/${offer.slug}`} />{isCustomSlug(offer.slug) && <button type="button" className="sp-delete-btn" onClick={() => remove(offer.slug)}><AdminText en="Delete" ar="حذف" /></button>}</AdminTableActions></td>
        </tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No offers found" ar="لا توجد عروض" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
