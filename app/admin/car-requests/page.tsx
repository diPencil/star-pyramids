'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, ClipboardList, Eye, Inbox, CheckCircle2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { useLiveCollection } from '@/lib/admin-store'
import { cars } from '@/data/content'
import { SharedSelect } from '@/components/shared-select'
import { carRequestStatusLabel, type CarRequestStatus, type StaffCarRequest } from '@/lib/car-request'

const statusTabs = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'new', en: 'New', ar: 'جديدة' },
  { id: 'reviewing', en: 'Reviewing', ar: 'قيد المراجعة' },
  { id: 'confirmed', en: 'Confirmed', ar: 'مؤكدة' },
  { id: 'cancelled', en: 'Cancelled', ar: 'ملغاة' },
] as const

type StatusFilter = (typeof statusTabs)[number]['id']
type TripFilter = 'all' | 'One Way' | 'Round Trip'
type VehicleFilter = 'all' | string

function vehicleTitle(liveCars: { slug: string; title: string }[], slug: string): string {
  return liveCars.find((car) => car.slug === slug)?.title ?? slug
}

function dateLabel(row: StaffCarRequest): string {
  if (row.preferredPickupDate && row.preferredReturnDate && row.preferredPickupDate !== row.preferredReturnDate) {
    return `${row.preferredPickupDate} → ${row.preferredReturnDate}`
  }
  return row.preferredPickupDate || ''
}

export default function CarRequestsPage() {
  const ar = useAdminLocale() === 'ar'
  const liveCars = useLiveCollection('cars', cars, { includeHidden: true })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [tripType, setTripType] = useState<TripFilter>('all')
  const [vehicle, setVehicle] = useState<VehicleFilter>('all')
  const [requests, setRequests] = useState<StaffCarRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/car-requests', { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) throw new Error(ar ? 'تعذر تحميل طلبات السيارات.' : 'Could not load car requests.')
        const data = (await res.json()) as { requests?: StaffCarRequest[] }
        if (cancelled) return
        setRequests(Array.isArray(data.requests) ? data.requests : [])
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Could not load car requests.')
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vehicleOptions = useMemo(
    () => Array.from(new Map(requests.map((row) => [row.vehicleSlug, vehicleTitle(liveCars, row.vehicleSlug)])).entries()),
    [requests, liveCars],
  )

  const matchesQuery = (row: StaffCarRequest, q: string) => {
    const needle = q.trim().toLowerCase()
    if (!needle) return true
    return `${row.reference} ${row.contact.name} ${row.contact.email} ${row.vehicleSlug} ${vehicleTitle(liveCars, row.vehicleSlug)} ${row.pickup} ${row.dropoff}`.toLowerCase().includes(needle)
  }

  const visible = useMemo(() => requests
    .filter((row) => status === 'all' || row.status === (status as CarRequestStatus))
    .filter((row) => tripType === 'all' || row.tripType === tripType)
    .filter((row) => vehicle === 'all' || row.vehicleSlug === vehicle || row.assignedVehicleSlug === vehicle)
    .filter((row) => matchesQuery(row, query)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [requests, status, tripType, vehicle, query, liveCars])

  const requestSort = useAdminTableSort<StaffCarRequest>(visible, {
    request: (row) => row.reference,
    customer: (row) => row.contact.name,
    vehicle: (row) => vehicleTitle(liveCars, row.vehicleSlug),
    route: (row) => `${row.pickup} ${row.dropoff}`,
    dates: (row) => row.preferredPickupDate,
    passengers: (row) => row.passengers,
    submitted: (row) => row.createdAt,
    status: (row) => row.status,
  }, 'submitted', 'desc')
  const paging = usePagination(requestSort.sortedRows)

  const count = (s: CarRequestStatus) => requests.filter((row) => row.status === s).length

  return (
    <>
      <PageHead eyebrow="Rentals" title="Car Requests" titleAr="طلبات السيارات" sub="Live vehicle rental requests from the website and customer accounts" subAr="طلبات تأجير السيارات من الموقع وحسابات العملاء" />
      <AdminStats items={[
        { label: <AdminText en="Total requests" ar="إجمالي الطلبات" />, value: requests.length, note: <AdminText en="Stored requests" ar="طلبات محفوظة" />, icon: ClipboardList },
        { label: <AdminText en="New" ar="جديدة" />, value: count('new'), note: <AdminText en="Awaiting review" ar="بانتظار المراجعة" />, icon: Inbox, tone: 'orange' },
        { label: <AdminText en="Reviewing" ar="قيد المراجعة" />, value: count('reviewing'), note: <AdminText en="Under staff review" ar="قيد مراجعة الفريق" />, icon: CalendarClock, tone: 'violet' },
        { label: <AdminText en="Confirmed" ar="المؤكدة" />, value: count('confirmed'), note: <AdminText en="Confirmed requests" ar="طلبات مؤكدة" />, icon: CheckCircle2, tone: 'green' },
      ]} />
      <Card
        title={<AdminText en="Car requests" ar="طلبات السيارات" />}
        sub={loading
          ? <AdminText en="Loading…" ar="جارٍ التحميل…" />
          : <AdminText en={`${visible.length} of ${requests.length} requests shown`} ar={`عرض ${visible.length} من ${requests.length} طلبات`} />}>
        {loading && <p role="status"><AdminText en="Loading car requests…" ar="جارٍ تحميل طلبات السيارات…" /></p>}
        {!loading && loadError && (
          <div className="sp-form">
            <p role="alert" style={{ color: '#b91c1c' }}>{loadError}</p>
            <div><button type="button" className="sp-btn" onClick={() => window.location.reload()}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div>
          </div>
        )}
        {!loading && !loadError && (
        <>
        <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بطلب أو عميل أو مركبة أو مسار...' : 'Search request, customer, vehicle or route...'}>
          <SharedSelect value={vehicle} onChange={setVehicle} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب المركبة' : 'Filter by vehicle'} popupWidth="trigger" options={[{ value: 'all', label: ar ? 'كل المركبات' : 'All vehicles' }, ...vehicleOptions.map(([slug, name]) => ({ value: slug, label: name }))]} />
          <SharedSelect value={tripType} onChange={(next) => setTripType(next as TripFilter)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب نوع الرحلة' : 'Filter by trip type'} options={[{ value: 'all', label: ar ? 'كل أنواع الرحلات' : 'All trip types' }, { value: 'One Way', label: ar ? 'ذهاب فقط' : 'One Way' }, { value: 'Round Trip', label: ar ? 'ذهاب وعودة' : 'Round Trip' }]} />
          <SharedSelect value={status} onChange={(next) => setStatus(next as StatusFilter)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الحالة' : 'Filter by status'} options={statusTabs.map((t) => ({ value: t.id, label: ar ? t.ar : t.en }))} />
        </AdminTableTools>
        {visible.length ? (
          <AdminTableWrap>
            <table className="sp-table">
              <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Request" ar="الطلب" />} column="request" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Vehicle" ar="المركبة" />} column="vehicle" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Route" ar="المسار" />} column="route" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Preferred dates" ar="التواريخ المفضلة" />} column="dates" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Passengers" ar="الركاب" />} column="passengers" {...requestSort} onSort={requestSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" {...requestSort} onSort={requestSort.sortBy} /><th /></tr></thead>
              <tbody>
                {paging.pageRows.map((row, index) => (
                  <tr key={row.reference}>
                    <td className="sp-row-number">{paging.from + index}</td>
                    <td><strong dir="ltr">{row.reference}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{row.tripType}</small></td>
                    <td><span className="sp-cust"><Avatar name={row.contact.name} size={32} /><span><strong>{row.contact.name || (ar ? 'بدون اسم' : 'No name')}</strong><small dir="ltr">{row.contact.email}</small><br /><small style={{ color: 'var(--sp-muted)' }}>{row.account ? <AdminText en="Registered account" ar="حساب مسجل" /> : <AdminText en="Guest" ar="زائر" />}</small></span></span></td>
                    <td><strong>{vehicleTitle(liveCars, row.vehicleSlug)}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{row.vehicleSlug}</small>{row.assignedVehicleSlug !== '' && <><br /><small style={{ color: 'var(--sp-muted)' }}><AdminText en="Assigned: " ar="المخصصة: " />{vehicleTitle(liveCars, row.assignedVehicleSlug)}</small></>}</td>
                    <td><span>{row.pickup}</span><br /><small style={{ color: 'var(--sp-muted)' }}>→ {row.dropoff}</small></td>
                    <td><span dir="ltr">{dateLabel(row) || (ar ? 'غير محدد' : 'Not set')}</span></td>
                    <td>{row.passengers}</td>
                    <td><span className={`sp-status is-${row.status}`}>{carRequestStatusLabel(row.status, ar)}</span></td>
                    <td><AdminTableActions><AdminIconAction icon={Eye} label={ar ? `عرض ${row.reference}` : `View ${row.reference}`} href={`/admin/car-requests/${row.reference}`} /></AdminTableActions></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrap>
        ) : (
          <AdminEmpty title={<AdminText en="No car requests found" ar="لا توجد طلبات سيارات" />} copy={<AdminText en="Vehicle rental requests created from the website or a customer account appear here." ar="طلبات تأجير السيارات المنشأة من الموقع أو حساب عميل تظهر هنا." />} />
        )}
        {visible.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
        </>
        )}
      </Card>
    </>
  )
}
