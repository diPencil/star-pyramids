'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, MapPin, StickyNote, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { canTransitionEventRequest, eventActivityLabel, eventDisplayTitle, eventRequestStatusLabel, type EventRequestStatus, type StaffEventRequest } from '@/lib/event-request'
import { displayInternationalPhone, telLink } from '@/lib/phone'
import { countryDisplayName } from '@/data/countries'

const ACTIONS: { from: EventRequestStatus[]; to: EventRequestStatus; tone: 'primary' | 'danger' }[] = [
  { from: ['new'], to: 'reviewing', tone: 'primary' },
  { from: ['reviewing'], to: 'approved', tone: 'primary' },
  { from: ['reviewing'], to: 'rejected', tone: 'danger' },
  { from: ['new', 'reviewing'], to: 'cancelled', tone: 'danger' },
  { from: ['approved', 'rejected'], to: 'reviewing', tone: 'primary' },
]

const actionCopy: Record<EventRequestStatus, { en: string; ar: string }> = {
  new: { en: 'New', ar: 'جديد' },
  reviewing: { en: 'Start review', ar: 'بدء المراجعة' },
  approved: { en: 'Approve', ar: 'قبول' },
  rejected: { en: 'Reject', ar: 'رفض' },
  cancelled: { en: 'Cancel request', ar: 'إلغاء الطلب' },
}

const manageHint: Record<EventRequestStatus, { en: string; ar: string }> = {
  new: {
    en: 'This request is awaiting staff review. Start the review to move it forward, or cancel it if it should not proceed.',
    ar: 'هذا الطلب بانتظار مراجعة الإدارة. ابدأ المراجعة للمضي فيه، أو ألغه إذا كان يجب عدم إتمامه.',
  },
  reviewing: {
    en: 'This request is under staff review. Approve it, reject it, or cancel it from the available actions.',
    ar: 'هذا الطلب قيد مراجعة الإدارة. اقبله أو ارفضه أو ألغه من الإجراءات المتاحة.',
  },
  approved: {
    en: 'This request was approved. You can reopen it to reviewing if it needs another look.',
    ar: 'تم قبول هذا الطلب. يمكنك إعادته للمراجعة إذا احتاج نظرة أخرى.',
  },
  rejected: {
    en: 'This request was rejected. You can reopen it to reviewing if the decision should be reconsidered.',
    ar: 'تم رفض هذا الطلب. يمكنك إعادته للمراجعة إذا وجب إعادة النظر في القرار.',
  },
  cancelled: {
    en: 'This request was cancelled. Cancelled requests are terminal and accept no further transitions.',
    ar: 'تم إلغاء هذا الطلب. الطلبات الملغاة نهائية ولا تقبل أي انتقالات أخرى.',
  },
}

async function apiStaffDetail(reference: string): Promise<StaffEventRequest> {
  const res = await fetch(`/api/admin/event-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as StaffEventRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Event request not found.')
  return data
}

async function apiStaffMutate(reference: string, body: Record<string, unknown>): Promise<StaffEventRequest> {
  const res = await fetch(`/api/admin/event-requests/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as StaffEventRequest & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Could not update the request.')
  return data
}

export function EventRequestDetailContent({ requestId }: { requestId: string }) {
  const ar = useAdminLocale() === 'ar'
  const reference = decodeURIComponent(requestId)
  const [item, setItem] = useState<StaffEventRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState<EventRequestStatus | null>(null)
  const [actionError, setActionError] = useState('')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiStaffDetail(reference)
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
    return (
      <>
        <PageHead eyebrow="Events" title="Event request" titleAr="طلب فعالية" sub="Request detail" subAr="تفاصيل الطلب" />
        <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading the stored request…" ar="جارٍ تحميل الطلب المحفوظ…" /></p></Card>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Events" title="Event request" titleAr="طلب فعالية" sub="Request detail" subAr="تفاصيل الطلب" />
        <Card title={<AdminText en="Request not found" ar="الطلب غير موجود" />}>
          <p><AdminText en={loadError || 'This request does not exist.'} ar={loadError || 'هذا الطلب غير موجود.'} /></p>
          <p><Link className="sp-btn" href="/admin/event-requests"><AdminText en="Back to event requests" ar="عودة لطلبات الفعاليات" /></Link></p>
        </Card>
      </>
    )
  }

  const available = ACTIONS.filter((a) => a.from.includes(item.status))
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US')
  const title = eventDisplayTitle(item.eventSlug, item.eventTitle)
  const phoneDisplay = displayInternationalPhone(item.dialCode, item.contact.phone)
  const phoneHref = telLink(item.nationality, item.contact.phone)

  const runTransition = (to: EventRequestStatus) => {
    setActionError('')
    apiStaffMutate(item.reference, { status: to })
      .then((row) => { setItem(row); setPending(null) })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'Could not update the request.')
        setPending(null)
      })
  }

  const saveNote = () => {
    if (!note.trim() || savingNote) return
    setActionError('')
    setSavingNote(true)
    apiStaffMutate(item.reference, { note: note.trim() })
      .then((row) => { setItem(row); setNote('') })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'Could not save the note.')
      })
      .finally(() => setSavingNote(false))
  }

  return (
    <>
      <PageHead
        eyebrow="Events"
        title={item.reference}
        titleAr={item.reference}
        sub={`${title} · ${item.attendees} ${ar ? 'حضور' : 'attendees'}`}
        subAr={`${title} · ${item.attendees} حضور`}
        actions={<Link className="sp-btn" href="/admin/event-requests"><ArrowLeft size={16} /> <AdminText en="Back to all requests" ar="عودة لكل الطلبات" /></Link>}
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Request overview" ar="نظرة عامة على الطلب" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><span className={`sp-status is-${item.status}`}>{eventRequestStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Attendees" ar="الحضور" /></dt><dd><Users size={14} />{item.attendees}</dd></div>
              <div><dt><AdminText en="Submitted" ar="أُرسل" /></dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
              {item.account && <div><dt><AdminText en="Account" ar="الحساب" /></dt><dd>{item.account.name} <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{item.account.email}</small></dd></div>}
            </dl>
            {item.notes && <p className="evr-note"><span><AdminText en="Customer note" ar="ملاحظة العميل" /></span>{item.notes}</p>}
          </Card>
          <Card title={<AdminText en="Event" ar="الفعالية" />}>
            <div className="evr-event">
              <Link href={`/events/${item.eventSlug}`} className="evr-event-title">{title}</Link>
              <p><CalendarDays size={14} />{item.eventDate}</p>
              <p><MapPin size={14} />{item.eventLocation}</p>
            </div>
          </Card>
        </div>
        <div className="evr-side-col">
        <Card title={<AdminText en="Customer" ar="العميل" />}>
          <dl className="evr-kv evr-customer">
            <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{item.contact.name}</dd></div>
            <div><dt><AdminText en="Nationality" ar="الجنسية" /></dt><dd>{countryDisplayName(item.nationality, ar ? 'ar' : 'en') || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
            <div><dt><AdminText en="Email" ar="البريد" /></dt><dd><a dir="ltr" href={`mailto:${item.contact.email}`}>{item.contact.email}</a></dd></div>
            <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd><a dir="ltr" href={phoneHref}>{phoneDisplay}</a></dd></div>
          </dl>
        </Card>
        <Card title={<AdminText en="Request management" ar="إدارة الطلب" />}>
          <div className="evr-manage">
            <p className="evr-manage-status"><AdminText en="Current status" ar="الحالة الحالية" /> <span className={`sp-status is-${item.status}`}>{eventRequestStatusLabel(item.status, ar)}</span></p>
            <p className="evr-manage-hint">{ar ? manageHint[item.status].ar : manageHint[item.status].en}</p>
            {available.length ? (
              <div className="evr-actions">
                {available.map((a) => (
                  <button key={a.to} type="button" className={`sp-btn ${a.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => setPending(a.to)}>
                    <AdminText en={actionCopy[a.to].en} ar={actionCopy[a.to].ar} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="evr-manage-hint"><AdminText en="No further transitions. Cancelled requests are terminal." ar="لا توجد انتقالات أخرى. الطلبات الملغاة نهائية." /></p>
            )}
            {actionError && <p className="evr-manage-hint" role="alert">{actionError}</p>}
          </div>
        </Card>
        <Card title={<AdminText en="Internal note" ar="ملاحظة داخلية" />}>
          <div className="evr-manage">
            <p className="evr-manage-hint"><StickyNote size={14} /> <AdminText en="Staff-only. Never visible to the customer." ar="للفريق فقط. لا تظهر للعميل أبدًا." /></p>
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={ar ? 'اكتب ملاحظة داخلية…' : 'Write an internal note…'}
              aria-label={ar ? 'ملاحظة داخلية' : 'Internal note'}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <div className="evr-actions">
              <button type="button" className="sp-btn primary" disabled={!note.trim() || savingNote} onClick={saveNote}>
                <AdminText en={savingNote ? 'Saving…' : 'Save internal note'} ar={savingNote ? 'جارٍ الحفظ…' : 'حفظ الملاحظة الداخلية'} />
              </button>
            </div>
          </div>
        </Card>
      </div>
      </div>
      <Card title={<AdminText en="Activity" ar="سجل النشاط" />}>
        {item.activity.length ? (
          <ol className="evr-timeline">
            {item.activity.map((a, i) => (
              <li key={`${a.at}-${i}`}>
                <span className="evr-dot" aria-hidden="true" />
                <div>
                  <strong>{eventActivityLabel(a.action, ar)}{a.internal ? (ar ? ' · داخلية' : ' · Internal') : ''}</strong>
                  <small>{a.by === 'customer' ? (ar ? 'العميل' : 'Customer') : (ar ? 'الفريق' : 'Staff')} · {new Date(a.at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {new Date(a.at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</small>
                  {a.note && <small className="evr-note-inline">{a.note}</small>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p><AdminText en="No activity yet." ar="لا يوجد سجل بعد." /></p>
        )}
      </Card>
      <AdminConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => { if (pending && canTransitionEventRequest(item.status, pending)) runTransition(pending) }}
        title={<AdminText en={pending ? `Move to ${actionCopy[pending].en}?` : 'Confirm'} ar={pending ? `نقل إلى ${actionCopy[pending].ar}؟` : 'تأكيد'} />}
        description={<AdminText en={`Updates the stored record ${item.reference}.`} ar={`يحدّث السجل المحفوظ ${item.reference}.`} />}
        confirmLabel={<AdminText en="Confirm" ar="تأكيد" />}
        cancelLabel={<AdminText en="Keep" ar="تراجع" />}
        tone={pending === 'rejected' || pending === 'cancelled' ? 'danger' : 'primary'}
      />
    </>
  )
}
