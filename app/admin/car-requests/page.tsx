'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, ClipboardList, Eye, Inbox, Play } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { StartReviewDialog } from '@/components/admin/car-request-dialogs'
import { type AdminCarRequestStatus, type AdminCarTripType, type AdminCarRequest } from '@/components/admin/car-requests-data'
import { getEffectiveRequests, useCarRequestOps, type EffectiveCarRequest } from '@/lib/car-request-ops'
import { AMENDABLE_FIELD_COPY, AMENDMENT_STATUS_COPY, useAmendments, type AmendmentStatus } from '@/lib/car-request-amendments'
import { SharedSelect } from '@/components/shared-select'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'new', en: 'New', ar: 'جديدة' },
  { id: 'reviewing', en: 'Reviewing', ar: 'قيد المراجعة' },
  { id: 'confirmed', en: 'Confirmed', ar: 'مؤكدة' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
] as const

type StatusFilter = (typeof statusTabs)[number]['id']
type TripFilter = 'all' | AdminCarTripType
type VehicleFilter = 'all' | string

function matchesQuery(row: AdminCarRequest, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return `${row.ref} ${row.customerName} ${row.customerEmail} ${row.vehicleName} ${row.vehicleSlug} ${row.pickup} ${row.dropoff}`.toLowerCase().includes(q)
}

export default function CarRequestsPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tripType, setTripType] = useState<TripFilter>('all')
  const [vehicle, setVehicle] = useState<VehicleFilter>('all')
  const [reviewRef, setReviewRef] = useState<string | null>(null)

  // Merged fixture + local demo overlay: transitions update list, KPIs, and
  // filters immediately through the shared reactive store.
  const opsStore = useCarRequestOps()
  const requests = useMemo(() => getEffectiveRequests(opsStore), [opsStore])
  const amendments = useAmendments()
  const vehicleOptions = useMemo(
    () => Array.from(new Map(requests.map((row) => [row.vehicleSlug, row.vehicleName])).entries()),
    [requests],
  )

  const visible = useMemo(() => requests
    .filter((row) => status === 'all' || row.status === (status as AdminCarRequestStatus))
    .filter((row) => tripType === 'all' || row.tripType === tripType)
    .filter((row) => vehicle === 'all' || row.vehicleSlug === vehicle || row.assignedVehicleSlug === vehicle)
    .filter((row) => matchesQuery(row, query)),
  [requests, status, tripType, vehicle, query])

  const requestSort = useAdminTableSort<EffectiveCarRequest>(visible, {
    request: (row) => row.ref,
    customer: (row) => row.customerName,
    vehicle: (row) => row.vehicleName,
    route: (row) => `${row.pickup} ${row.dropoff}`,
    dates: (row) => row.preferredPickupDate,
    passengers: (row) => row.passengers,
    status: (row) => row.status,
  }, 'request', 'asc')
  const paging = usePagination(requestSort.sortedRows)

  return (
    <>
      <PageHead eyebrow="Rentals" title="Car Requests" titleAr="طلبات السيارات" sub="Customer vehicle rental enquiries and request management" subAr="استفسارات وإدارة طلبات تأجير السيارات" />
      <AdminStats items={[
        { label: <AdminText en="Total requests" ar="إجمالي الطلبات" />, value: requests.length, note: <AdminText en="Demo fixture rows" ar="صفوف تجريبية" />, icon: ClipboardList },
        { label: <AdminText en="New" ar="جديدة" />, value: requests.filter((row) => row.status === 'new').length, note: <AdminText en="Awaiting review" ar="بانتظار المراجعة" />, icon: Inbox, tone: 'orange' },
        { label: <AdminText en="Reviewing" ar="قيد المراجعة" />, value: requests.filter((row) => row.status === 'reviewing').length, note: <AdminText en="Under staff review" ar="قيد مراجعة الفريق" />, icon: CalendarClock, tone: 'violet' },
        { label: <AdminText en="Confirmed" ar="المؤكدة" />, value: requests.filter((row) => row.status === 'confirmed').length, note: <AdminText en="Demo state only" ar="حالة تجريبية فقط" />, icon: CheckCircle2, tone: 'green' },
      ]} />
      <Card
        title={<AdminText en="Car requests" ar="طلبات السيارات" />}
        sub={<AdminText en={`${visible.length} of ${requests.length} requests shown · Demo fixtures, not customer submissions`} ar={`عرض ${visible.length} من ${requests.length} طلبات · بيانات تجريبية وليست طلبات عملاء`} />}
      >
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بطلب أو عميل أو مركبة أو مسار...' : 'Search request, customer, vehicle or route...'} className="sp-request-tools">
          <SharedSelect value={vehicle} onChange={setVehicle} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب المركبة' : 'Filter by vehicle'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل المركبات' : 'All vehicles' }, ...vehicleOptions.map(([slug, name]) => ({ value: slug, label: name }))]} />
          <SharedSelect value={tripType} onChange={(next) => setTripType(next as TripFilter)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب نوع الرحلة' : 'Filter by trip type'} options={[{ value: 'all', label: ar ? 'كل أنواع الرحلات' : 'All trip types' }, { value: 'One Way', label: ar ? 'ذهاب فقط' : 'One Way' }, { value: 'Round Trip', label: ar ? 'ذهاب وعودة' : 'Round Trip' }]} />
          <div className="sp-tabs">
            {statusTabs.map((tab) => <button key={tab.id} type="button" className={status === tab.id ? 'active' : ''} onClick={() => setStatus(tab.id)}>{ar ? tab.ar : tab.en}</button>)}
          </div>
        </AdminTableTools>
        {visible.length ? <AdminTableWrap><table className="sp-table">
          <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Request" ar="الطلب" />} column="request" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Vehicle" ar="المركبة" />} column="vehicle" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Route" ar="المسار" />} column="route" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Preferred dates" ar="التواريخ المفضلة" />} column="dates" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Passengers" ar="الركاب" />} column="passengers" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...requestSort} onSort={requestSort.sortBy} /><th></th></tr></thead>
          <tbody>
            {paging.pageRows.map((row, index) => (
              <tr key={row.ref}>
                <td className="sp-row-number">{paging.from + index}</td>
                <td><strong dir="ltr">{row.ref}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{row.tripType}</small></td>
                <td><span className="sp-cust"><Avatar name={row.customerName} size={32} /><span><strong>{row.customerName}</strong><small dir="ltr">{row.customerEmail}</small></span></span></td>
                <td><strong>{row.vehicleName}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{row.vehicleSlug}</small></td>
                <td><span>{row.pickup}</span><br /><small style={{ color: 'var(--sp-muted)' }}>→ {row.dropoff}</small></td>
                <td><span dir="ltr">{row.preferredPickupDate}</span>{row.tripType === 'Round Trip' && row.preferredReturnDate ? <><br /><small style={{ color: 'var(--sp-muted)' }}><span dir="ltr">{row.preferredReturnDate}</span></small></> : null}</td>
                <td>{row.passengers}</td>
                <td><StatusPill status={row.status} /></td>
                <td><AdminTableActions>
                  {row.status === 'new' && (
                    <AdminIconAction icon={Play} label={ar ? `بدء مراجعة ${row.ref}` : `Start review of ${row.ref}`} tone="success" onClick={() => setReviewRef(row.ref)} />
                  )}
                  <AdminIconAction icon={Eye} label={ar ? `عرض ${row.ref}` : `View ${row.ref}`} href={`/admin/car-requests/${row.ref}`} />
                </AdminTableActions></td>
              </tr>
            ))}
          </tbody>
        </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No requests found" ar="لا توجد طلبات" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
      </Card>
      <Card
        title={<AdminText en="Customer change requests" ar="طلبات تعديل العميل" />}
        sub={<AdminText en="Local browser demo — same-device customer proposals only, not server data" ar="تجريبي محلي — مقترحات العملاء على نفس المتصفح فقط، وليست بيانات خادم" />}
      >
        {amendments.length ? <AdminTableWrap><table className="sp-table">
          <thead><tr><th className="sp-row-number">#</th><th><AdminText en="Amendment" ar="التعديل" /></th><th><AdminText en="Original request" ar="الطلب الأصلي" /></th><th><AdminText en="Changes" ar="التغييرات" /></th><th><AdminText en="Status" ar="الحالة" /></th><th></th></tr></thead>
          <tbody>
            {amendments.map((entry, index) => {
              const pill = entry.status === 'draft' ? 'is-draft' : entry.status === 'pending' ? 'is-pending' : entry.status === 'approved' ? 'is-confirmed' : 'is-cancelled'
              const copy: { en: string; ar: string } = AMENDMENT_STATUS_COPY[entry.status as AmendmentStatus]
              return (
                <tr key={entry.amendmentRef}>
                  <td className="sp-row-number">{index + 1}</td>
                  <td><strong dir="ltr">{entry.amendmentRef}</strong></td>
                  <td><span dir="ltr">{entry.requestRef}</span></td>
                  <td><small style={{ color: 'var(--sp-muted)' }}>{entry.changedFields.map((field) => (ar ? AMENDABLE_FIELD_COPY[field].ar : AMENDABLE_FIELD_COPY[field].en)).join(' · ')}</small></td>
                  <td><span className={`sp-pill ${pill}`}><AdminText en={copy.en} ar={copy.ar} /></span></td>
                  <td><AdminTableActions>
                    <AdminIconAction icon={Eye} label={ar ? `عرض ${entry.amendmentRef}` : `View ${entry.amendmentRef}`} href={`/admin/car-requests/amendments/detail?ref=${entry.amendmentRef}`} />
                  </AdminTableActions></td>
                </tr>
              )
            })}
          </tbody>
        </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No local change requests" ar="لا توجد طلبات تعديل محلية" />} copy={<AdminText en="Customer proposals from this browser will appear here for demo review." ar="ستظهر مقترحات العملاء من هذا المتصفح هنا للمراجعة التجريبية." />} />}
      </Card>
      <StartReviewDialog requestRef={reviewRef} open={reviewRef !== null} onClose={() => setReviewRef(null)} />
    </>
  )
}
