'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, MessageCircle, Pencil, Trash2, UserCheck, UserX, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableWrap, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { bookings } from '@/components/admin/admin-data'
import { conversations } from '@/components/admin/admin-data'
import { isCustomerActive, removeCustomItem, setCustomerActive, startImpersonation, useCustomerProfile, useLiveCollection, type AdminCustomer } from '@/lib/admin-store'

const NO_BASE: AdminCustomer[] = []

export function CustomerDetailContent({ customerKey }: { customerKey: string }) {
  const ar = useAdminLocale() === 'ar'
  const key = decodeURIComponent(customerKey)
  const customCustomers = useLiveCollection('customers', NO_BASE)
  const [deactivated, setDeactivated] = useState<string[]>([])

  const custom = key.startsWith('custom-') ? customCustomers.find((c) => c.slug === key) : undefined
  const name = custom ? custom.name : key
  const patch = useCustomerProfile(name)
  const customerBookings = useMemo(() => bookings.filter((b) => b.customer === name), [name])
  const messages = useMemo(() => conversations.filter((c) => c.name === name), [name])
  const active = custom ? isCustomerActive(custom) : !deactivated.includes(name)
  const spent = customerBookings.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.total, 0)
  const due = customerBookings.filter((b) => b.status === 'pending').reduce((s, b) => s + b.total, 0)

  const toggleActive = () => {
    if (custom) setCustomerActive(custom.slug, !isCustomerActive(custom))
    else setDeactivated((prev) => (prev.includes(name) ? prev.filter((k) => k !== name) : [...prev, name]))
  }

  if (!custom && customerBookings.length === 0) {
    return <>
      <PageHead eyebrow="CRM" title="Customer" titleAr="العميل" actions={<Link className="sp-btn" href="/admin/customers"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>} />
      <AdminEmpty title={<AdminText en="Customer not found" ar="العميل غير موجود" />} />
    </>
  }

  const email = custom?.email ?? patch.email ?? ''
  const avatar = custom?.avatar ?? patch.avatar

  return <>
    <PageHead
      eyebrow="CRM"
      title={name}
      sub={custom ? `${custom.username} · ${custom.phone}` : customerBookings[0]?.id ?? ''}
      actions={<>
        <Link className="sp-btn" href="/admin/customers"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>
        <Link className="sp-btn" href={`/admin/customers/${encodeURIComponent(key)}/edit`}><Pencil size={16} /> <AdminText en="Edit" ar="تعديل" /></Link>
        <button type="button" className="sp-btn primary" onClick={() => startImpersonation({ name, email: email || undefined, avatar })}><Users size={16} /> <AdminText en="Login as user" ar="الدخول بحسابه" /></button>
      </>}
    />
    <AdminStats items={[
      { label: <AdminText en="Total spent" ar="إجمالي الإنفاق" />, value: `$${spent.toLocaleString('en-US')}`, note: <AdminText en="Confirmed bookings" ar="حجوزات مؤكدة" />, icon: Users },
      { label: <AdminText en="Bookings" ar="الحجوزات" />, value: customerBookings.length, note: <AdminText en="Full history below" ar="السجل الكامل بالأسفل" />, icon: Users, tone: 'orange' },
      { label: <AdminText en="Amount due" ar="المستحق" />, value: `$${due.toLocaleString('en-US')}`, note: <AdminText en="Pending bookings" ar="حجوزات قيد الانتظار" />, icon: Users, tone: 'green' },
      { label: <AdminText en="Messages" ar="الرسائل" />, value: messages.length, note: <AdminText en="Chat threads" ar="محادثات" />, icon: MessageCircle, tone: 'violet' },
    ]} />

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Profile" ar="البيانات" />}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <Avatar name={name} src={avatar} size={64} online={active} />
          <div><h3 style={{ margin: 0 }}>{name}</h3><small style={{ color: 'var(--sp-muted)' }}>{custom ? custom.username : customerBookings[0]?.id}</small><div style={{ marginTop: 6 }}><StatusPill status={active ? (custom ? 'custom' : customerBookings[0]?.status ?? 'active') : 'inactive'} /></div></div>
        </div>
        <div className="sp-detail-grid">
          {custom ? <>
            <div><small><AdminText en="Email" ar="البريد" /></small><strong>{custom.email}</strong></div>
            <div><small><AdminText en="Phone" ar="الهاتف" /></small><strong>{custom.phone}</strong></div>
            <div><small><AdminText en="Country" ar="الدولة" /></small><strong>{custom.country}</strong></div>
            <div><small><AdminText en="Joined" ar="تاريخ التسجيل" /></small><strong>{custom.createdAt}</strong></div>
          </> : <>
            <div><small><AdminText en="Email" ar="البريد" /></small><strong>{patch.email ?? '—'}</strong></div>
            <div><small><AdminText en="Phone" ar="الهاتف" /></small><strong>{patch.phone ?? '—'}</strong></div>
            <div><small><AdminText en="Country" ar="الدولة" /></small><strong>{patch.country ?? '—'}</strong></div>
            <div><small><AdminText en="Channel" ar="القناة" /></small><strong>{customerBookings[0]?.channel}</strong></div>
            <div><small><AdminText en="Last travel date" ar="آخر تاريخ سفر" /></small><strong>{customerBookings[0]?.date}</strong></div>
            {patch.notes && <div><small><AdminText en="Staff notes" ar="ملاحظات الموظفين" /></small><strong>{patch.notes}</strong></div>}
          </>}
          <div><small><AdminText en="Status" ar="الحالة" /></small><strong>{active ? (ar ? 'نشط' : 'Active') : (ar ? 'معطل' : 'Inactive')}</strong></div>
        </div>
        <AdminTableActions>
          <AdminIconAction icon={active ? UserX : UserCheck} label={active ? (ar ? `تعطيل ${name}` : `Deactivate ${name}`) : (ar ? `تفعيل ${name}` : `Activate ${name}`)} tone={active ? 'danger' : 'success'} onClick={toggleActive} />
          {custom && <button type="button" className="sp-delete-btn" onClick={() => { removeCustomItem('customers', custom.slug); window.location.href = '/admin/customers' }}><Trash2 size={14} /> <AdminText en="Delete" ar="حذف" /></button>}
        </AdminTableActions>
      </Card>

      <Card title={<AdminText en="Messages" ar="الرسائل" />} sub={<AdminText en="Threads linked to this customer" ar="المحادثات المرتبطة بهذا العميل" />}>
        {messages.length ? <div className="sp-detail-list">{messages.map((m) => (
          <div key={m.id}><span><strong>{m.channel === 'whatsapp' ? 'WhatsApp' : 'Live Chat'}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{m.lastText}</small></span><Link className="sp-btn" href="/admin/inbox"><AdminText en="Open" ar="فتح" /></Link></div>
        ))}</div> : <p style={{ color: 'var(--sp-muted)' }}><AdminText en="No messages yet" ar="لا توجد رسائل بعد" /></p>}
      </Card>
    </div>

    <Card title={<AdminText en="Bookings history" ar="سجل الحجوزات" />} sub={<AdminText en="Every booking tied to this customer" ar="كل الحجوزات المرتبطة بهذا العميل" />}>
      {customerBookings.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Booking" ar="الحجز" /></th><th><AdminText en="Tour" ar="الرحلة" /></th><th><AdminText en="Date" ar="التاريخ" /></th><th><AdminText en="Guests" ar="الضيوف" /></th><th><AdminText en="Total" ar="الإجمالي" /></th><th><AdminText en="Payment" ar="الدفع" /></th><th><AdminText en="Status" ar="الحالة" /></th></tr></thead>
        <tbody>{customerBookings.map((b) => (
          <tr key={b.id}>
            <td><strong>{b.id}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{b.channel}</small></td>
            <td>{b.tour}</td><td>{b.date}</td><td>{b.guests}</td>            <td>${b.total.toLocaleString('en-US')}</td>
            <td>{b.status === 'confirmed'
              ? <span className="sp-pill is-confirmed"><AdminText en="Paid" ar="مدفوع" /></span>
              : b.status === 'pending'
                ? <span className="sp-pill is-pending"><AdminText en="Due" ar="مستحق" /></span>
                : <span style={{ color: 'var(--sp-muted)' }}>—</span>}</td>
            <td><StatusPill status={b.status} /></td>
          </tr>
        ))}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No bookings yet" ar="لا توجد حجوزات بعد" />} />}
    </Card>
  </>
}
