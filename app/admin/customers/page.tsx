'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, CircleDollarSign, Eye, Mail, ShoppingBag, UserCheck, UserX, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import {formatCurrency} from '@/lib/payments/currency'
import { crmAccountLabel, formatCrmMoney, groupCrmMoney } from '@/lib/admin/admin-crm-reporting'
import { BookingToursSummary } from '@/components/admin/booking-tours-summary'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared/forms/shared-select'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { mutateCustomerStatus, useDbCustomersStatus, requestGuestCrmRecovery, type DirectoryCustomer, type GuestBookingContact } from '@/lib/admin/admin-customers-client'
import { toast } from '@/components/admin/admin-toaster'

const accountStatusMeta: Record<DirectoryCustomer['status'], { en: string; ar: string; color: string }> = {
  ACTIVE: { en: 'Active', ar: 'نشط', color: '#22c55e' },
  PENDING: { en: 'Pending verification', ar: 'بانتظار التفعيل', color: '#f59e0b' },
  SUSPENDED: { en: 'Suspended', ar: 'موقوف', color: '#ef4444' },
}

export default function CustomersPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [guestStatus, setGuestStatus] = useState('all')
  const [status, setStatus] = useState<'all' | DirectoryCustomer['status']>('all')
  // DB-authoritative directory with no static fallback: while the API is
  // loading or failing, the screen shows loading/error  -  never mock rows
  // masquerading as database records.
  const { data, guestContacts=[],canViewGuestContacts,canRequestGuestRecovery,viewerPermissions, loading, error, retry, refresh } = useDbCustomersStatus()
  const [recoveryTarget, setRecoveryTarget] = useState<GuestBookingContact|null>(null)
  const [recoverySending, setRecoverySending] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const requestRecovery = async () => {
    if (!recoveryTarget || recoverySending) return
    setRecoverySending(true); setRecoveryError('')
    try {
      await requestGuestCrmRecovery(recoveryTarget.reference,recoveryTarget.email)
      setRecoveryTarget(null)
      toast.info('If eligible, a private recovery link will be emailed to the saved booking contact.',{dedupeKey:'guest-crm-recovery'})
    } catch (error) { setRecoveryError(error instanceof Error?error.message:'Recovery is temporarily unavailable.') }
    finally { setRecoverySending(false) }
  }
  const liveCustomers = data ?? []
  const canManage = viewerPermissions.includes('customers.edit')

  const [statusTarget, setStatusTarget] = useState<{ customer: DirectoryCustomer; to: 'ACTIVE' | 'SUSPENDED' } | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusServerError, setStatusServerError] = useState('')

  const submitStatus = async () => {
    if (!statusTarget) return
    setStatusSaving(true)
    setStatusServerError('')
    try {
      await mutateCustomerStatus(statusTarget.customer.publicId, statusTarget.to)
      setStatusTarget(null)
      toast.success(statusTarget.to === 'ACTIVE'
        ? (ar ? 'تم تفعيل العميل.' : 'Customer activated.')
        : (ar ? 'تم إيقاف العميل.' : 'Customer suspended.'), { dedupeKey: 'customers-status' })
      refresh()
    } catch (err) {
      setStatusServerError(err instanceof Error ? err.message : (ar ? 'تعذر تحديث الحالة.' : 'Could not update status.'))
    } finally {
      setStatusSaving(false)
    }
  }

  const rows = useMemo(() => liveCustomers
    .filter((customer) => status === 'all' || customer.status === status)
    .filter((customer) => `${customer.displayName} ${customer.email} ${customer.username ?? ''} ${customer.phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [liveCustomers, query, status])

  const customerSort = useAdminTableSort(rows, {
    customer: (row) => row.displayName,
    bookings: (row) => row.bookingsCount,
    trips: (row)=>row.tripsCount??0,
    total: (row) => (row.bookedValue??[]).map(v=>`${v.currency}:${Math.round(v.amount*100).toString().padStart(20,'0')}`).join('|'),
    status: (row) => row.status,
  }, 'customer', 'asc')
  const paging = usePagination(customerSort.sortedRows)
  const bookingsCount = liveCustomers.reduce((sum, customer) => sum + customer.bookingsCount, 0)+guestContacts.length
  const guestRows=guestContacts.filter(contact=>(guestStatus==='all'||contact.status===guestStatus)&&`${contact.reference} ${contact.displayName} ${contact.email} ${contact.phone} ${(contact.tourTitles??[]).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const guestPaging=usePagination(guestRows)
  const confirmedValue = groupCrmMoney([...liveCustomers.flatMap(c=>c.confirmedValue??[]),...guestContacts.flatMap(c=>c.confirmedValue??[])])
  const suspendedCount = liveCustomers.filter((customer) => customer.status === 'SUSPENDED').length

  const showGuestsFirst = canViewGuestContacts && !loading && !error && liveCustomers.length === 0 && guestContacts.length > 0
  const guestSection = (canViewGuestContacts&&!loading&&!error&&<Card title="Guest booking contacts" sub="Booking contact records without a verified account link. Each row is one booking, not a registered customer account.">
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder="Search guest, booking, tour, email or phone...">
        <SharedSelect value={guestStatus} onChange={setGuestStatus} label="Guest booking status" options={[{value:'all',label:'All booking statuses'},...['PENDING','CONFIRMED','COMPLETED','CANCELLED'].map(value=>({value,label:value.toLowerCase()}))]}/>
      </AdminTableTools>
      {guestRows.length?<>
        <AdminTableWrap><table className="sp-table">
          <thead><tr><th>Contact</th><th>Booking</th><th>Trips</th><th>Booked value</th><th>Confirmed value</th><th>Collected net</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{guestPaging.pageRows.map(contact=><tr key={contact.reference}>
            <td><span className="sp-cust"><Avatar name={contact.displayName} size={34}/><span><strong>{contact.displayName}</strong><small dir="ltr">{contact.email}</small><small dir="ltr">{contact.phone}</small></span></span></td>
            <td><Link href={`/admin/bookings/${encodeURIComponent(contact.reference)}`}>{contact.reference}</Link><br/><small>Guest contact · no account access · 1 booking</small><BookingToursSummary titles={contact.tourTitles??[]} reference={contact.reference}/></td>
            <td>{contact.tripsCount}</td><td>{contact.currency} {formatCurrency(contact.total,contact.currency,'en')}</td><td>{formatCrmMoney(contact.confirmedValue)}</td><td>{formatCrmMoney(contact.collectedValue)}</td><td><StatusPill status={contact.status.toLowerCase()}/></td>
            <td><AdminTableActions><AdminIconAction icon={Eye} label={`View booking ${contact.reference}`} href={`/admin/bookings/${encodeURIComponent(contact.reference)}`}/>{canRequestGuestRecovery&&<AdminIconAction icon={Mail} label={`Email recovery link for ${contact.reference}`} onClick={()=>{setRecoveryError('');setRecoveryTarget(contact)}}/>}</AdminTableActions></td>
          </tr>)}</tbody>
        </table></AdminTableWrap>
        <AdminPagination page={guestPaging.page} pageCount={guestPaging.pageCount} onPage={guestPaging.setPage} pageSize={guestPaging.pageSize} onPageSize={guestPaging.setPageSize} from={guestPaging.from} to={guestPaging.to} total={guestPaging.total}/>
      </>:<AdminEmpty title="No matching guest booking contacts" copy="Guest bookings appear here without creating or linking an account."/>}
    </Card>)

  return <>
    <PageHead eyebrow="CRM" title="Customers" titleAr="العملاء" sub="Account and guest booking contacts · all-time totals" subAr="سجل الحجوزات وقنوات الوصول وقيمة العملاء" />
    <AdminStats items={[
      { label: <AdminText en="Customer accounts" ar="العملاء" />, value: liveCustomers.length, note: <AdminText en={canViewGuestContacts?`${guestContacts.length} guest booking contacts · Registered and pending accounts`:'Registered and pending accounts'} ar="حسابات مسجلة" />, icon: Users },
      { label: <AdminText en="Bookings" ar="الحجوزات" />, value: bookingsCount, note: <AdminText en={canViewGuestContacts?'Linked account and guest bookings':'Linked account bookings'} ar="عبر كل العملاء" />, icon: ShoppingBag, tone: 'orange' },
      { label: <AdminText en="Confirmed account customers" ar="عملاء مؤكدون" />, value: liveCustomers.filter((customer) => (customer.confirmedValue??[]).length > 0).length, note: <AdminText en="Accounts with confirmed bookings" ar="بإنفاق مؤكد" />, icon: CheckCircle2, tone: 'green' },
      { label: <AdminText en="Confirmed booked value" ar="قيمة المؤكد" />, value: formatCrmMoney(confirmedValue), note: <AdminText en={canViewGuestContacts?"Account and guest bookings by currency":"Account bookings by currency"} ar="إجمالي الحجوزات المؤكدة" />, icon: CircleDollarSign, tone: 'violet' },
    ]} />
    {showGuestsFirst && guestSection}
    <Card title={<AdminText en="Customer directory" ar="دليل العملاء" />} sub={<AdminText en={`${rows.length} of ${liveCustomers.length} accounts shown`} ar={`عرض ${rows.length} من ${liveCustomers.length} عملاء`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعميل أو بريد أو هاتف...' : 'Search customer, email or phone...'}>
        <SharedSelect value={status} onChange={(next) => setStatus(next as typeof status)} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب حالة الحساب' : 'Filter by account status'} options={[{ value: 'all', label: ar ? 'كل الحالات' : 'All statuses' }, { value: 'ACTIVE', label: ar ? 'نشط' : 'Active' }, { value: 'PENDING', label: ar ? 'بانتظار التفعيل' : 'Pending' }, { value: 'SUSPENDED', label: ar ? 'موقوف' : 'Suspended' }]} />
      </AdminTableTools>
      {loading ? <AdminEmpty title={<AdminText en="Loading customers…" ar="جارٍ تحميل العملاء…" />} copy={<AdminText en="Reading the customer directory." ar="تتم قراءة دليل العملاء." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load customers" ar="تعذر تحميل العملاء" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Customer" ar="العميل" />} column="customer" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Bookings" ar="الحجوزات" />} column="bookings" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Trips" ar="Trips" />} column="trips" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><SortableTh label={<AdminText en="Booked value" ar="إجمالي الإنفاق" />} column="total" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><th>Confirmed value</th><th>Collected net</th><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={customerSort.sortKey} direction={customerSort.direction} onSort={customerSort.sortBy} /><th><AdminText en="Actions" ar="إجراءات" /></th></tr></thead>
        <tbody>
          {paging.pageRows.map((customer, index) => {
            const meta = accountStatusMeta[customer.status] ?? accountStatusMeta.ACTIVE!
            const suspended = customer.status === 'SUSPENDED'
            return <tr key={customer.publicId}>
              <td className="sp-row-number">{paging.from + index}</td>
              <td><span className="sp-cust"><Avatar name={customer.displayName} size={34} online={customer.status === 'ACTIVE'} src={customer.avatar ?? undefined} /><span><strong>{customer.displayName}</strong><small dir="ltr">{customer.email}</small><small>{crmAccountLabel(customer)}</small></span></span></td>
                <td>{customer.bookingsCount}</td>
                <td>{customer.tripsCount??0}</td>
              <td>{formatCrmMoney(customer.bookedValue)}</td><td>{formatCrmMoney(customer.confirmedValue)}</td><td>{formatCrmMoney(customer.collectedValue)}</td>
              <td><span className="sp-inline-meta"><Circle size={8} fill={meta.color} color={meta.color} />{ar ? meta.ar : meta.en}</span></td>
              <td><AdminTableActions>
                <AdminIconAction icon={Eye} label={ar ? `عرض ${customer.displayName}` : `View ${customer.displayName}`} href={`/admin/customers/${encodeURIComponent(customer.publicId)}`} />
                {canManage ? <AdminIconAction icon={suspended ? UserCheck : UserX} label={suspended ? (ar ? `تفعيل ${customer.displayName}` : `Activate ${customer.displayName}`) : (ar ? `إيقاف ${customer.displayName}` : `Suspend ${customer.displayName}`)} tone={suspended ? 'success' : 'danger'} onClick={() => { setStatusServerError(''); setStatusTarget({ customer, to: suspended ? 'ACTIVE' : 'SUSPENDED' }) }} /> : null}
              </AdminTableActions></td>
            </tr>
          })}
        </tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en={liveCustomers.length?"No matching accounts":"No registered accounts yet"} ar="لا يوجد عملاء" />} copy={<AdminText en={liveCustomers.length?"Try changing the search or filters.":"Guest booking contacts are listed separately from login accounts."} ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>

    {!showGuestsFirst && guestSection}
    <AdminConfirmDialog open={recoveryTarget!==null} onClose={()=>{if(!recoverySending)setRecoveryTarget(null)}} onConfirm={()=>void requestRecovery()} title="Email a private recovery link?" description={`If eligible, the existing recovery service will email ${recoveryTarget?.email??''} for booking ${recoveryTarget?.reference??''}. This does not grant access in this browser, create consent or activate an account.`} confirmLabel={recoverySending?'Requesting…':'Request recovery email'} cancelLabel="Cancel" canConfirm={!recoverySending}>
      {recoveryError&&<p role="alert">{recoveryError}</p>}
    </AdminConfirmDialog>
    <AdminConfirmDialog
      open={statusTarget !== null}
      onClose={() => { if (!statusSaving) setStatusTarget(null) }}
      onConfirm={() => void submitStatus()}
      title={statusTarget?.to === 'ACTIVE'
        ? <AdminText en="Activate this customer?" ar="تفعيل هذا العميل؟" />
        : <AdminText en="Suspend this customer?" ar="إيقاف هذا العميل؟" />}
      description={statusTarget ? (statusTarget.to === 'ACTIVE'
        ? <AdminText en={`${statusTarget.customer.displayName} will be able to sign in again.`} ar={`سيتمكن ${statusTarget.customer.displayName} من تسجيل الدخول مجددًا.`} />
        : <AdminText en={`${statusTarget.customer.displayName} will be signed out everywhere and blocked from signing in.`} ar={`سيتم تسجيل خروج ${statusTarget.customer.displayName} من كل مكان ومنعه من الدخول.`} />) : undefined}
      confirmLabel={statusSaving
        ? <AdminText en="Working…" ar="جارٍ التنفيذ…" />
        : statusTarget?.to === 'ACTIVE'
          ? <AdminText en="Activate" ar="تفعيل" />
          : <AdminText en="Suspend" ar="إيقاف" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      tone={statusTarget?.to === 'ACTIVE' ? 'primary' : 'danger'}
      canConfirm={!statusSaving}
    >
      {statusServerError ? <p role="alert" style={{ color: '#b91c1c' }}>{statusServerError}</p> : null}
    </AdminConfirmDialog>
  </>
}
