'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Eye, Plus, ShieldCheck, Ticket, X } from 'lucide-react'
import { LocaleProvider, useLocale } from '@/components/locale'
import { AccountShell, CustomerConfirmDialog, CustomerPagination, EmptyState } from './account-portal'
import { usePagination } from '@/components/admin/admin-pagination'
import { useLiveEvents } from '@/lib/admin-store'
import { events } from '@/data/content'
import { cancelEventRequest, eventRequestStatusLabel, useEventRequest, useEventRequests, type EventRequestStatus } from '@/lib/event-request'

function StatusBadge({ status }: { status: Parameters<typeof eventRequestStatusLabel>[0] }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'approved' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{eventRequestStatusLabel(status, ar)}</span>
}

export function EventRequestsSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const requests = useEventRequests()
  const liveEvents = useLiveEvents(events)
  const [filter, setFilter] = useState<'all' | EventRequestStatus>('all')
  const eventImage = (slug: string) => liveEvents.find((e) => e.slug === slug)?.image || '/placeholder.jpg'
  const viewLabel = ar ? 'عرض الطلب' : 'View request'
  const visible = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
  const paging = usePagination(visible)
  const filters = ['all', 'new', 'reviewing', 'approved', 'rejected', 'cancelled'] as const
  return (
    <section className="customer-account-block customer-full-block">
      <div className="customer-filterbar">
        <div role="tablist" aria-label={ar ? 'فلترة طلبات الفعاليات' : 'Filter event requests'}>
          {filters.map((status) => (
            <button type="button" key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>
              {status === 'all' ? (ar ? 'الكل' : 'All') : eventRequestStatusLabel(status, ar)}
            </button>
          ))}
        </div>
        <Link href="/events"><Plus size={16} />{ar ? 'تصفح الفعاليات' : 'Browse events'}</Link>
      </div>
      {visible.length ? (
        <>
          <div className="customer-table-wrap"><table className="customer-table">
            <thead><tr><th>#</th><th>{ar ? 'الفعالية' : 'Event'}</th><th>{ar ? 'الموعد' : 'Date'}</th><th>{ar ? 'الحضور' : 'Attendees'}</th><th>{ar ? 'أُرسل' : 'Submitted'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead>
            <tbody>{paging.pageRows.map((r, index) => {
              const detailHref = `/account/event-requests/detail?ref=${encodeURIComponent(r.localRef)}`
              return <tr key={r.localRef}>
                <td className="customer-row-number">{paging.from + index}</td>
                <td><span className="customer-trip-cell"><img src={eventImage(r.eventSlug)} alt="" loading="lazy" onError={(e) => { if (!e.currentTarget.src.endsWith('/placeholder.jpg')) e.currentTarget.src = '/placeholder.jpg' }} /><span><strong><Link href={detailHref}>{r.eventTitle}</Link></strong><small><span dir="ltr">{r.localRef}</span> · {r.eventLocation}</small></span></span></td>
                <td><span dir="ltr">{r.eventDate}</span></td>
                <td>{r.attendees}</td>
                <td><span dir="ltr">{new Date(r.createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span></td>
                <td><StatusBadge status={r.status} /></td>
                <td><span className="customer-table-actions"><Link href={detailHref} aria-label={viewLabel} title={viewLabel}><Eye size={16} /></Link></span></td>
              </tr>
            })}</tbody>
          </table></div>
          <CustomerPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />
          <div style={{ padding: '0 18px 18px' }}>
            <p className="car-request-notice" role="note"><ShieldCheck size={15} /><span>{ar ? 'طلبات مبدئية قيد المراجعة محفوظة محليًا على هذا المتصفح فقط. وهي ليست تذاكر مؤكدة.' : 'Preliminary requests pending review, saved locally on this browser only. They are not confirmed tickets.'}</span></p>
          </div>
        </>
      ) : (
        <EmptyState Icon={Ticket} title={requests.length ? (ar ? 'لا توجد طلبات في هذه الحالة' : 'No requests in this view') : (ar ? 'لا توجد طلبات فعاليات بعد' : 'No event requests yet')} copy={requests.length ? (ar ? 'جرب حالة مختلفة من الفلتر بالأعلى.' : 'Try a different status from the filter above.') : (ar ? 'اختر فعالية وأرسل طلب حضور وسيظهر هنا.' : 'Pick an event, send an attendance request, and it will appear here.')} href="/events" action={ar ? 'استكشف الفعاليات' : 'Explore events'} />
      )}
    </section>
  )
}

export function EventRequestDetailSection({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const item = useEventRequest(reference)
  const [cancelling, setCancelling] = useState(false)
  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Ticket size={20} />
        <span>
          <strong>{ar ? 'طلب الفعالية غير موجود' : 'Event request not found'}</strong>
          <small>{ar ? 'ربما تم حذفه أو أنه محفوظ في متصفح مختلف.' : 'It may have been removed or saved in a different browser.'}</small>
        </span>
        <Link href="/account/event-requests">{ar ? 'عودة لطلبات الفعاليات' : 'Back to event requests'}</Link>
      </div>
    )
  }
  const cancellable = item.status === 'new' || item.status === 'reviewing'
  return (
    <div className="customer-account-block">
      <header>
        <div>
          <span>{ar ? 'تفاصيل طلب الفعالية' : 'Event request detail'}</span>
          <h2>{item.eventTitle}</h2>
        </div>
        <StatusBadge status={item.status} />
      </header>
      <dl className="customer-detail-grid">
        <div><dt>{ar ? 'المرجع المحلي' : 'Local reference'}</dt><dd dir="ltr">{item.localRef}</dd></div>
        <div><dt>{ar ? 'الفعالية' : 'Event'}</dt><dd><Link href={`/events/${item.eventSlug}`}>{item.eventTitle}</Link></dd></div>
        <div><dt>{ar ? 'الموعد' : 'Date'}</dt><dd>{item.eventDate}</dd></div>
        <div><dt>{ar ? 'الموقع' : 'Location'}</dt><dd>{item.eventLocation}</dd></div>
        <div><dt>{ar ? 'الاسم' : 'Name'}</dt><dd>{item.name}</dd></div>
        <div><dt>{ar ? 'الهاتف' : 'Phone'}</dt><dd dir="ltr">{item.dialCode} {item.phone}</dd></div>
        <div><dt>{ar ? 'البريد' : 'Email'}</dt><dd dir="ltr">{item.email}</dd></div>
        <div><dt>{ar ? 'عدد الحضور' : 'Attendees'}</dt><dd>{item.attendees}</dd></div>
        <div><dt>{ar ? 'أُرسل في' : 'Submitted'}</dt><dd>{new Date(item.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</dd></div>
        {item.note && <div className="full"><dt>{ar ? 'ملاحظات' : 'Notes'}</dt><dd>{item.note}</dd></div>}
      </dl>
      {item.activity.length > 0 && (
        <section className="customer-activity" aria-label={ar ? 'سجل الطلب' : 'Request activity'}>
          <h3>{ar ? 'سجل الطلب' : 'Activity'}</h3>
          <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</span><strong>{a.action}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
        </section>
      )}
      <div className="customer-detail-actions">
        <Link href="/account/event-requests" className="account-icon-action">{ar ? 'عودة للقائمة' : 'Back to list'}</Link>
        {cancellable && (
          <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{ar ? 'إلغاء الطلب' : 'Cancel request'}</button>
        )}
      </div>
      <CustomerConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => { cancelEventRequest(item.localRef); setCancelling(false) }}
        title={ar ? 'إلغاء طلب الفعالية؟' : 'Cancel this event request?'}
        copy={ar ? 'سيبقى هذا الطلب في سجلك بحالة ملغي.' : 'This request will remain in your history with a Cancelled status.'}
        confirmLabel={ar ? 'إلغاء الطلب' : 'Cancel request'}
        cancelLabel={ar ? 'أبقِ الطلب' : 'Keep request'}
      />
      <p className="customer-block-note">{ar ? 'مرجع محلي على هذا المتصفح فقط، وليس تذكرة رسمية.' : 'Browser-only reference. Not an official ticket.'}</p>
    </div>
  )
}

export function CustomerEventRequestsPage() {
  return <LocaleProvider><AccountShell section="event-requests"><EventRequestsSection /></AccountShell></LocaleProvider>
}

export function CustomerEventRequestDetailPage({ reference }: { reference: string }) {
  return (
    <LocaleProvider>
      <EventRequestDetailShell reference={reference} />
    </LocaleProvider>
  )
}

function EventRequestDetailShell({ reference }: { reference: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return (
    <AccountShell section="event-requests" headLeading={<Link href="/account/event-requests" className="account-icon-action">{ar ? 'عودة لطلبات الفعاليات' : 'Back to event requests'}</Link>}>
      <EventRequestDetailSection reference={reference} />
    </AccountShell>
  )
}
