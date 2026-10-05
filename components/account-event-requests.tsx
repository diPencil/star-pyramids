'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Eye, Plus, ShieldCheck, Ticket, X } from 'lucide-react'
import { LocaleProvider, useLocale } from '@/components/locale'
import { AccountShell, CustomerConfirmDialog, CustomerPagination, EmptyState } from './account-portal'
import { usePagination } from '@/components/admin/admin-pagination'
import { useLiveEvents } from '@/lib/admin-store'
import { events } from '@/data/content'
import { CUSTOMER_EVENT_CANCELLABLE_STATUSES, eventActivityLabel, eventDisplayTitle, eventRequestStatusLabel, type EventRequest, type EventRequestStatus } from '@/lib/event-request'
import { displayInternationalPhone } from '@/lib/phone'

function StatusBadge({ status }: { status: Parameters<typeof eventRequestStatusLabel>[0] }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const tone = status === 'new' ? 'request_received' : status === 'reviewing' ? 'reviewing' : status === 'approved' ? 'confirmed' : 'cancelled'
  return <span className={`customer-status ${tone}`}>{eventRequestStatusLabel(status, ar)}</span>
}

async function apiEventList(): Promise<EventRequest[]> {
  const res = await fetch('/api/account/event-requests', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load your event requests.')
  const data = (await res.json()) as { requests?: EventRequest[] }
  if (!Array.isArray(data.requests)) throw new Error('Could not load your event requests.')
  return data.requests
}

async function apiEventDetail(reference: string): Promise<EventRequest> {
  const res = await fetch(`/api/account/event-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as EventRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Event request not found.')
  return data
}

async function apiEventCancel(reference: string): Promise<EventRequest> {
  const res = await fetch(`/api/account/event-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'cancel' }),
  })
  const data = (await res.json()) as EventRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not cancel the request.')
  return data
}

export function EventRequestsSection() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const liveEvents = useLiveEvents(events)
  const [requests, setRequests] = useState<EventRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | EventRequestStatus>('all')
  const eventTitle = (slug: string, fallback: string) => liveEvents.find((e) => e.slug === slug)?.title ?? eventDisplayTitle(slug, fallback)
  const eventImage = (slug: string) => liveEvents.find((e) => e.slug === slug)?.image || '/placeholder.jpg'
  const viewLabel = ar ? 'عرض الطلب' : 'View request'
  const visible = filter === 'all' ? requests : requests.filter((r) => r.status === filter)
  const paging = usePagination(visible)
  const filters = ['all', 'new', 'reviewing', 'approved', 'rejected', 'cancelled'] as const

  // Load the customer's real requests once.
  useEffect(() => {
    let cancelled = false
    apiEventList()
      .then((rows) => { if (!cancelled) { setRequests(rows); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load your event requests.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <section className="customer-account-block customer-full-block"><div className="customer-empty" role="status"><h3>{ar ? 'جارٍ تحميل طلباتك…' : 'Loading your requests…'}</h3></div></section>
  }

  if (loadError && !requests.length) {
    return (
      <section className="customer-account-block customer-full-block">
        <div className="customer-empty">
          <h3>{ar ? 'تعذر تحميل الطلبات' : 'Could not load requests'}</h3>
          <p>{loadError}</p>
          <button type="button" className="account-icon-action" onClick={() => {
            setLoading(true)
            setLoadError('')
            apiEventList()
              .then((rows) => { setRequests(rows); setLoading(false) })
              .catch((error: unknown) => {
                setLoadError(error instanceof Error ? error.message : 'Could not load your event requests.')
                setLoading(false)
              })
          }}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>
        </div>
      </section>
    )
  }

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
              const detailHref = `/account/event-requests/detail?ref=${encodeURIComponent(r.reference)}`
              return <tr key={r.reference}>
                <td className="customer-row-number">{paging.from + index}</td>
                <td><span className="customer-trip-cell"><img src={eventImage(r.eventSlug)} alt="" loading="lazy" onError={(e) => { if (!e.currentTarget.src.endsWith('/placeholder.jpg')) e.currentTarget.src = '/placeholder.jpg' }} /><span><strong><Link href={detailHref}>{eventTitle(r.eventSlug, r.eventTitle)}</Link></strong><small><span dir="ltr">{r.reference}</span> · {r.eventLocation}</small></span></span></td>
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
            <p className="car-request-notice" role="note"><ShieldCheck size={15} /><span>{ar ? 'طلبات مبدئية قيد المراجعة. وهي ليست تذاكر مؤكدة.' : 'Preliminary requests pending review. They are not confirmed tickets.'}</span></p>
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
  const liveEvents = useLiveEvents(events)
  const [item, setItem] = useState<EventRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiEventDetail(reference)
      .then((row) => { if (!cancelled) { setItem(row); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Event request not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return <div className="customer-account-block"><div className="customer-empty" role="status"><h3>{ar ? 'جارٍ تحميل الطلب…' : 'Loading request…'}</h3></div></div>
  }

  if (!item) {
    return (
      <div className="customer-inline-empty">
        <Ticket size={20} />
        <span>
          <strong>{ar ? 'طلب الفعالية غير موجود' : 'Event request not found'}</strong>
          <small>{loadError || (ar ? 'تأكد من المرجع وحاول مجددًا.' : 'Check the reference and try again.')}</small>
        </span>
        <Link href="/account/event-requests">{ar ? 'عودة لطلبات الفعاليات' : 'Back to event requests'}</Link>
      </div>
    )
  }

  const title = liveEvents.find((e) => e.slug === item.eventSlug)?.title ?? eventDisplayTitle(item.eventSlug, item.eventTitle)
  const cancellable = (CUSTOMER_EVENT_CANCELLABLE_STATUSES as readonly string[]).includes(item.status)
  return (
    <div className="customer-account-block">
      <header>
        <div>
          <span>{ar ? 'تفاصيل طلب الفعالية' : 'Event request detail'}</span>
          <h2>{title}</h2>
        </div>
        <StatusBadge status={item.status} />
      </header>
      <dl className="customer-detail-grid">
        <div><dt>{ar ? 'المرجع' : 'Reference'}</dt><dd dir="ltr">{item.reference}</dd></div>
        <div><dt>{ar ? 'الفعالية' : 'Event'}</dt><dd><Link href={`/events/${item.eventSlug}`}>{title}</Link></dd></div>
        <div><dt>{ar ? 'الموعد' : 'Date'}</dt><dd>{item.eventDate}</dd></div>
        <div><dt>{ar ? 'الموقع' : 'Location'}</dt><dd>{item.eventLocation}</dd></div>
        <div><dt>{ar ? 'الاسم' : 'Name'}</dt><dd>{item.contact.name}</dd></div>
        <div><dt>{ar ? 'الهاتف' : 'Phone'}</dt><dd dir="ltr">{displayInternationalPhone(item.dialCode, item.contact.phone)}</dd></div>
        <div><dt>{ar ? 'البريد' : 'Email'}</dt><dd dir="ltr">{item.contact.email}</dd></div>
        <div><dt>{ar ? 'عدد الحضور' : 'Attendees'}</dt><dd>{item.attendees}</dd></div>
        <div><dt>{ar ? 'أُرسل في' : 'Submitted'}</dt><dd>{new Date(item.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</dd></div>
        {item.notes && <div className="full"><dt>{ar ? 'ملاحظات' : 'Notes'}</dt><dd>{item.notes}</dd></div>}
      </dl>
      {item.activity.length > 0 && (
        <section className="customer-activity" aria-label={ar ? 'سجل الطلب' : 'Request activity'}>
          <h3>{ar ? 'سجل الطلب' : 'Activity'}</h3>
          <ul>{item.activity.map((a, i) => <li key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</span><strong>{eventActivityLabel(a.action, ar)}</strong>{a.note && <small>{a.note}</small>}</li>)}</ul>
        </section>
      )}
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      <div className="customer-detail-actions">
        <Link href="/account/event-requests" className="account-icon-action">{ar ? 'عودة للقائمة' : 'Back to list'}</Link>
        {cancellable && (
          <button type="button" className="account-icon-action danger" onClick={() => setCancelling(true)}><X size={16} />{ar ? 'إلغاء الطلب' : 'Cancel request'}</button>
        )}
      </div>
      <CustomerConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        onConfirm={() => {
          setActionError('')
          apiEventCancel(item.reference)
            .then((row) => { setItem(row); setCancelling(false) })
            .catch((error: unknown) => {
              setActionError(error instanceof Error ? error.message : (ar ? 'تعذر إلغاء الطلب.' : 'Could not cancel the request.'))
              setCancelling(false)
            })
        }}
        title={ar ? 'إلغاء طلب الفعالية؟' : 'Cancel this event request?'}
        copy={ar ? 'سيبقى هذا الطلب في سجلك بحالة ملغي.' : 'This request will remain in your history with a Cancelled status.'}
        confirmLabel={ar ? 'إلغاء الطلب' : 'Cancel request'}
        cancelLabel={ar ? 'أبقِ الطلب' : 'Keep request'}
      />
      <p className="customer-block-note">{ar ? 'المرجع الرسمي الصادر عند الإرسال. وليس تذكرة.' : 'Official reference issued at submission. Not a ticket.'}</p>
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
