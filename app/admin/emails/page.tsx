'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Mail, MailOpen, Reply, Send, Settings2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'
import { useInquiries } from '@/lib/admin-store'
import { getSiteTimezone } from '@/components/locale'

const initialMails = [
  { id: '1', from: 'Anna Schmidt <anna@mail.de>', email: 'anna@mail.de', subject: 'Nile cruise quote for 4', time: '10:24', status: 'pending' },
  { id: '2', from: 'Website form <noreply@starpyramids.com>', email: 'noreply@starpyramids.com', subject: 'New Make-Your-Trip request', time: '09:12', status: 'pending' },
  { id: '3', from: 'accounts@starpyramids.com', email: 'accounts@starpyramids.com', subject: 'Invoice BK-9041 paid', time: 'Yesterday', status: 'confirmed' },
]

export default function EmailsPage() {
  const ar = useAdminLocale() === 'ar'
  const [mails, setMails] = useState(initialMails)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [readInquiries, setReadInquiries] = useState<string[]>([])
  const inquiries = useInquiries()
  const inquiryMails = inquiries
    .filter((inquiry) => inquiry.channel === 'email')
    .map((inquiry) => ({
      id: inquiry.id,
      from: `${inquiry.name} <${inquiry.contact}>`,
      email: inquiry.contact,
      subject: `Question about ${inquiry.tourTitle}`,
      time: new Date(inquiry.at).toLocaleString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: getSiteTimezone() }),
      status: readInquiries.includes(inquiry.id) ? 'confirmed' : 'pending',
    }))
  const base = [...inquiryMails, ...mails]
  const rows = useMemo(() => base.filter((mail) => status === 'all' || mail.status === status).filter((mail) => `${mail.from} ${mail.subject}`.toLowerCase().includes(query.trim().toLowerCase())), [base, query, status])
  const emailSort = useAdminTableSort(rows, {
    from: (mail) => mail.from,
    subject: (mail) => mail.subject,
    time: (mail) => mail.time,
    status: (mail) => mail.status,
  }, 'time', 'desc')
  const paging = usePagination(emailSort.sortedRows)
  const markRead = (id: string) => {
    setMails((current) => current.map((mail) => mail.id === id ? { ...mail, status: 'confirmed' } : mail))
    setReadInquiries((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  return <>
    <PageHead eyebrow="Mailbox" title="Email" titleAr="البريد" sub="Incoming enquiries and operational email connected to mailbox settings" subAr="الاستفسارات الواردة والبريد التشغيلي المرتبط بإعدادات الصندوق" />
    <AdminStats items={[
      { label: <AdminText en="Messages" ar="الرسائل" />, value: base.length, note: <AdminText en="Current inbox records" ar="سجلات الصندوق الحالية" />, icon: Mail },
      { label: <AdminText en="Needs review" ar="تحتاج مراجعة" />, value: base.filter((mail) => mail.status === 'pending').length, note: <AdminText en="Unread or pending reply" ar="غير مقروءة أو بانتظار الرد" />, icon: MailOpen, tone: 'orange' },
      { label: <AdminText en="Reviewed" ar="تمت مراجعتها" />, value: base.filter((mail) => mail.status === 'confirmed').length, note: <AdminText en="Handled messages" ar="رسائل تم التعامل معها" />, icon: CheckCircle2, tone: 'green' },
      { label: <AdminText en="Mailbox" ar="الصندوق" />, value: <AdminText en="Connected" ar="متصل" />, note: <AdminText en="Configured in Settings" ar="مضبوط في الإعدادات" />, icon: Settings2, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Incoming mail" ar="البريد الوارد" />} sub={<AdminText en={`${rows.length} of ${base.length} messages shown`} ar={`عرض ${rows.length} من ${base.length} رسائل`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بمرسل أو موضوع...' : 'Search sender or subject...'}>
        <select className="sp-filter-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label={ar ? 'فلترة حالة البريد' : 'Filter email status'}><option value="all">{ar ? 'كل البريد' : 'All mail'}</option><option value="pending">{ar ? 'تحتاج مراجعة' : 'Needs review'}</option><option value="confirmed">{ar ? 'تمت مراجعتها' : 'Reviewed'}</option></select>
      </AdminTableTools>
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="From" ar="من" />} column="from" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Subject" ar="الموضوع" />} column="subject" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Time" ar="الوقت" />} column="time" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={emailSort.sortKey} direction={emailSort.direction} onSort={emailSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((mail, index) => <tr key={mail.id}><td className="sp-row-number">{paging.from + index}</td><td>{mail.from}</td><td><strong>{mail.subject}</strong></td><td>{mail.time}</td><td><StatusPill status={mail.status} /></td><td><AdminTableActions><AdminIconAction icon={MailOpen} label={ar ? `تعليم ${mail.subject} كمراجعة` : `Mark ${mail.subject} as reviewed`} tone="success" disabled={mail.status === 'confirmed'} onClick={() => markRead(mail.id)} /><AdminIconAction icon={Reply} label={ar ? `الرد على ${mail.email}` : `Reply to ${mail.email}`} href={`mailto:${mail.email}?subject=Re%3A%20${encodeURIComponent(mail.subject)}`} /></AdminTableActions></td></tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No email found" ar="لا يوجد بريد" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
  </>
}
