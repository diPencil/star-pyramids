'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Circle, Eye, Heart, MessageCircle, Pencil, UserCheck, UserX, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { mutateCustomerStatus, useDbCustomerDetail } from '@/lib/admin-customers-client'
import { startImpersonation } from '@/lib/admin-store'

const accountStatusMeta = {
  ACTIVE: { en: 'Active', ar: 'نشط', color: '#22c55e' },
  PENDING: { en: 'Pending', ar: 'بانتظار التفعيل', color: '#f59e0b' },
  SUSPENDED: { en: 'Suspended', ar: 'موقوف', color: '#ef4444' },
} as const

function formatDate(value: string, ar: boolean): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString('en-US')}`
}

export function CustomerDetailContent({ customerKey }: { customerKey: string }) {
  const ar = useAdminLocale() === 'ar'
  const key = decodeURIComponent(customerKey)
  const { data: customer, canManage, loading, error, retry, refresh } = useDbCustomerDetail(key)
  const [confirming, setConfirming] = useState<null | 'ACTIVE' | 'SUSPENDED'>(null)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [successNote, setSuccessNote] = useState('')

  const submitStatus = async () => {
    if (!confirming) return
    setSaving(true)
    setServerError('')
    try {
      await mutateCustomerStatus(key, confirming)
      setConfirming(null)
      setSuccessNote(confirming === 'ACTIVE'
        ? (ar ? 'تم تفعيل العميل.' : 'Customer activated.')
        : (ar ? 'تم إيقاف العميل.' : 'Customer suspended.'))
      refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : (ar ? 'تعذر تحديث الحالة.' : 'Could not update status.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <>
      <PageHead eyebrow="CRM" title="Customer" titleAr="العميل" backHref="/admin/customers" />
      <AdminEmpty title={<AdminText en="Loading customer…" ar="جارٍ تحميل العميل…" />} copy={<AdminText en="Reading the customer record." ar="تتم قراءة سجل العميل." />} />
    </>
  }

  if (error || !customer) {
    return <>
      <PageHead eyebrow="CRM" title="Customer" titleAr="العميل" backHref="/admin/customers" />
      <AdminEmpty title={<AdminText en={error ? 'Could not load customer' : 'Customer not found'} ar={error ? 'تعذر تحميل العميل' : 'العميل غير موجود'} />} copy={error ? <AdminText en={error} ar={error} /> : undefined} />
      {error ? <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div> : null}
    </>
  }

  const status = accountStatusMeta[customer.status] ?? accountStatusMeta.ACTIVE
  const suspended = customer.status === 'SUSPENDED'
  const requestsCount = customer.tripRequests.length + customer.carRequests.length + customer.eventRequests.length
  const name = customer.displayName

  return <>
    <PageHead
      eyebrow="CRM"
      title={name}
      titleAr={name}
      sub={`${customer.email}${customer.username ? ` · ${customer.username}` : ''}`}
      backHref="/admin/customers"
      actions={<>
        {canManage ? <Link className="sp-btn" href={`/admin/customers/${encodeURIComponent(key)}/edit`}><Pencil size={15} /> <AdminText en="Edit" ar="تعديل" /></Link> : null}
        {canManage ? <button type="button" className="sp-btn dark" onClick={() => startImpersonation({ publicId: key, name, email: customer.email })}><Eye size={15} /> <AdminText en="View as customer" ar="عرض كعميل" /></button> : null}
      </>}
    />
    {successNote ? <p role="status" style={{ color: '#15803d', margin: '0 0 12px' }}>{successNote}</p> : null}

    <AdminStats items={[
      { label: <AdminText en="Total spent" ar="إجمالي الإنفاق" />, value: `$${customer.totalSpent.toLocaleString('en-US')}`, note: <AdminText en="All bookings" ar="كل الحجوزات" />, icon: Users },
      { label: <AdminText en="Bookings" ar="الحجوزات" />, value: customer.bookingsCount, note: <AdminText en="Full history below" ar="السجل الكامل بالأسفل" />, icon: Users, tone: 'orange' },
      { label: <AdminText en="Requests" ar="الطلبات" />, value: requestsCount, note: <AdminText en="Trip, car and event" ar="رحلات وسيارات وفعاليات" />, icon: Users, tone: 'green' },
      { label: <AdminText en="Messages" ar="الرسائل" />, value: customer.conversations.length, note: <AdminText en="Support threads" ar="محادثات الدعم" />, icon: MessageCircle, tone: 'violet' },
    ]} />

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Profile" ar="البيانات" />}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <Avatar name={name} size={64} online={customer.status === 'ACTIVE'} />
          <div><h3 style={{ margin: 0 }}>{name}</h3><small style={{ color: 'var(--sp-muted)' }} dir="ltr">{customer.email}</small><div style={{ marginTop: 6 }}><span className="sp-inline-meta"><Circle size={8} fill={status.color} color={status.color} />{ar ? status.ar : status.en}</span></div></div>
        </div>
        <div className="sp-detail-grid">
          <div><small><AdminText en="Email" ar="البريد" /></small><strong dir="ltr">{customer.email}</strong></div>
          <div><small><AdminText en="Phone" ar="الهاتف" /></small><strong dir="ltr">{customer.phone ?? '-'}</strong></div>
          <div><small><AdminText en="Country" ar="الدولة" /></small><strong>{customer.countryCode ?? '-'}</strong></div>
          <div><small><AdminText en="Username" ar="اسم المستخدم" /></small><strong dir="ltr">{customer.username ?? '-'}</strong></div>
          <div><small><AdminText en="Joined" ar="تاريخ التسجيل" /></small><strong>{formatDate(customer.createdAt, ar)}</strong></div>
          <div><small><AdminText en="Last login" ar="آخر دخول" /></small><strong>{customer.lastLoginAt ? formatDate(customer.lastLoginAt, ar) : '-'}</strong></div>
          <div><small><AdminText en="Status" ar="الحالة" /></small><strong>{ar ? status.ar : status.en}</strong></div>
        </div>
        {canManage ? <AdminTableActions>
          <AdminIconAction icon={suspended ? UserCheck : UserX} label={suspended ? (ar ? `تفعيل ${name}` : `Activate ${name}`) : (ar ? `إيقاف ${name}` : `Suspend ${name}`)} tone={suspended ? 'success' : 'danger'} onClick={() => { setServerError(''); setConfirming(suspended ? 'ACTIVE' : 'SUSPENDED') }} />
        </AdminTableActions> : null}
      </Card>

      <Card title={<AdminText en="Messages" ar="الرسائل" />} sub={<AdminText en="Support threads linked to this customer" ar="محادثات الدعم المرتبطة بهذا العميل" />}>
        {customer.conversations.length ? <div className="sp-detail-list">{customer.conversations.map((thread) => (
          <div key={thread.reference}><span><strong>{thread.subject || thread.reference}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{thread.messageCount} <AdminText en="messages" ar="رسائل" /> · {thread.status}</small></span><Link className="sp-btn" href="/admin/inbox"><AdminText en="Open" ar="فتح" /></Link></div>
        ))}</div> : <p style={{ color: 'var(--sp-muted)' }}><AdminText en="No messages yet" ar="لا توجد رسائل بعد" /></p>}
      </Card>
    </div>

    <Card title={<AdminText en="Bookings history" ar="سجل الحجوزات" />} sub={<AdminText en="Every booking tied to this customer account" ar="كل الحجوزات المرتبطة بحساب هذا العميل" />}>
      {customer.bookings.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Booking" ar="الحجز" /></th><th><AdminText en="Tours" ar="الرحلات" /></th><th><AdminText en="Guests" ar="الضيوف" /></th><th><AdminText en="Total" ar="الإجمالي" /></th><th><AdminText en="Payment" ar="الدفع" /></th><th><AdminText en="Status" ar="الحالة" /></th></tr></thead>
        <tbody>{customer.bookings.map((booking) => (
          <tr key={booking.reference}>
            <td><Link href={`/admin/bookings/${encodeURIComponent(booking.reference)}`}><strong dir="ltr">{booking.reference}</strong></Link><br /><small style={{ color: 'var(--sp-muted)' }}>{formatDate(booking.createdAt, ar)}</small></td>
            <td>{booking.items.map((item) => item.tourTitle).join(' · ') || '-'}</td>
            <td>{booking.items.reduce((sum, item) => sum + item.guests, 0)}</td>
            <td>{formatMoney(booking.total, booking.currency)}</td>
            <td>{booking.paymentStatus === 'PAID'
              ? <span className="sp-pill is-confirmed"><AdminText en="Paid" ar="مدفوع" /></span>
              : booking.paymentStatus === 'PENDING'
                ? <span className="sp-pill is-pending"><AdminText en="Due" ar="مستحق" /></span>
                : <span style={{ color: 'var(--sp-muted)' }}>{booking.paymentStatus}</span>}</td>
            <td><StatusPill status={booking.status} /></td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No bookings yet" ar="لا توجد حجوزات بعد" />} />}
    </Card>

    <Card title={<AdminText en="Trip requests" ar="طلبات الرحلات" />} sub={<AdminText en="Custom trip requests from this account" ar="طلبات الرحلات المخصصة من هذا الحساب" />}>
      {customer.tripRequests.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Reference" ar="المرجع" /></th><th><AdminText en="Request" ar="الطلب" /></th><th><AdminText en="Status" ar="الحالة" /></th><th><AdminText en="Date" ar="التاريخ" /></th></tr></thead>
        <tbody>{customer.tripRequests.map((request) => (
          <tr key={request.reference}>
            <td><Link href={`/admin/trip-requests/detail?ref=${encodeURIComponent(request.reference)}`}><strong dir="ltr">{request.reference}</strong></Link></td>
            <td>{request.title}</td><td>{request.status}</td><td>{formatDate(request.createdAt, ar)}</td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No trip requests" ar="لا توجد طلبات رحلات" />} />}
    </Card>

    <Card title={<AdminText en="Car requests" ar="طلبات السيارات" />} sub={<AdminText en="Car rental requests from this account" ar="طلبات تأجير السيارات من هذا الحساب" />}>
      {customer.carRequests.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Reference" ar="المرجع" /></th><th><AdminText en="Vehicle" ar="السيارة" /></th><th><AdminText en="Type" ar="النوع" /></th><th><AdminText en="Status" ar="الحالة" /></th></tr></thead>
        <tbody>{customer.carRequests.map((request) => (
          <tr key={request.reference}>
            <td><Link href={`/admin/car-requests/${encodeURIComponent(request.reference)}`}><strong dir="ltr">{request.reference}</strong></Link></td>
            <td dir="ltr">{request.vehicleSlug}</td><td>{request.tripType}</td><td>{request.status}</td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No car requests" ar="لا توجد طلبات سيارات" />} />}
    </Card>

    <Card title={<AdminText en="Event requests" ar="طلبات الفعاليات" />} sub={<AdminText en="Event requests from this account" ar="طلبات الفعاليات من هذا الحساب" />}>
      {customer.eventRequests.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Reference" ar="المرجع" /></th><th><AdminText en="Event" ar="الفعالية" /></th><th><AdminText en="Status" ar="الحالة" /></th><th><AdminText en="Date" ar="التاريخ" /></th></tr></thead>
        <tbody>{customer.eventRequests.map((request) => (
          <tr key={request.reference}>
            <td><Link href={`/admin/event-requests/detail?ref=${encodeURIComponent(request.reference)}`}><strong dir="ltr">{request.reference}</strong></Link></td>
            <td>{request.title}</td><td>{request.status}</td><td>{formatDate(request.createdAt, ar)}</td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No event requests" ar="لا توجد طلبات فعاليات" />} />}
    </Card>

    <Card title={<AdminText en="Payments" ar="المدفوعات" />} sub={<AdminText en="Money records on this customer's bookings" ar="سجلات الأموال على حجوزات هذا العميل" />}>
      {customer.payments.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Payment" ar="الدفعة" /></th><th><AdminText en="Booking" ar="الحجز" /></th><th><AdminText en="Amount" ar="المبلغ" /></th><th><AdminText en="Paid" ar="المدفوع" /></th><th><AdminText en="Status" ar="الحالة" /></th></tr></thead>
        <tbody>{customer.payments.map((payment) => (
          <tr key={payment.reference}>
            <td><Link href={`/admin/payments/${encodeURIComponent(payment.reference)}`}><strong dir="ltr">{payment.reference}</strong></Link></td>
            <td><strong dir="ltr">{payment.bookingReference}</strong></td>
            <td>{formatMoney(payment.amount, payment.currency)}</td>
            <td>{formatMoney(payment.amountPaid, payment.currency)}</td>
            <td>{payment.status}</td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No payments yet" ar="لا توجد مدفوعات بعد" />} />}
    </Card>

    <Card title={<AdminText en="Favorites" ar="المفضلة" />} sub={<AdminText en="Saved catalogue items" ar="العناصر المحفوظة من الكتالوج" />}>
      {customer.favorites.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Type" ar="النوع" /></th><th><AdminText en="Item" ar="العنصر" /></th><th><AdminText en="Saved" ar="تاريخ الحفظ" /></th></tr></thead>
        <tbody>{customer.favorites.map((favorite, index) => (
          <tr key={`${favorite.itemType}-${favorite.itemSlug}-${index}`}>
            <td>{favorite.itemType}</td><td dir="ltr">{favorite.itemSlug}</td><td>{formatDate(favorite.createdAt, ar)}</td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No favorites yet" ar="لا توجد عناصر محفوظة بعد" />} />}
      <p style={{ color: 'var(--sp-muted)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}><Heart size={14} /><AdminText en="Titles and prices resolve live from the catalogue." ar="تُعرض العناوين والأسعار مباشرة من الكتالوج." /></p>
    </Card>

    <AdminConfirmDialog
      open={confirming !== null}
      onClose={() => { if (!saving) setConfirming(null) }}
      onConfirm={() => void submitStatus()}
      title={confirming === 'ACTIVE'
        ? <AdminText en="Activate this customer?" ar="تفعيل هذا العميل؟" />
        : <AdminText en="Suspend this customer?" ar="إيقاف هذا العميل؟" />}
      description={confirming === 'ACTIVE'
        ? <AdminText en="They will be able to sign in again." ar="سيتمكن من تسجيل الدخول مجددًا." />
        : <AdminText en="They will be signed out everywhere and blocked from signing in." ar="سيتم تسجيل خروجه من كل مكان ومنعه من الدخول." />}
      confirmLabel={saving
        ? <AdminText en="Working…" ar="جارٍ التنفيذ…" />
        : confirming === 'ACTIVE'
          ? <AdminText en="Activate" ar="تفعيل" />
          : <AdminText en="Suspend" ar="إيقاف" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      tone={confirming === 'ACTIVE' ? 'primary' : 'danger'}
      canConfirm={!saving}
    >
      {serverError ? <p role="alert" style={{ color: '#b91c1c' }}>{serverError}</p> : null}
    </AdminConfirmDialog>
  </>
}
