'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CalendarDays, FlaskConical, MapPin, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { canTransitionEventRequest, eventRequestStatusLabel, transitionEventRequest, useEventRequest, type EventRequestStatus } from '@/lib/event-request'

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
  approved: { en: 'Approve (prototype)', ar: 'قبول مبدئي' },
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
    en: 'This request was approved as a prototype decision. You can reopen it to reviewing if it needs another look.',
    ar: 'تم قبول هذا الطلب كقرار تجريبي. يمكنك إعادته للمراجعة إذا احتاج نظرة أخرى.',
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

export function EventRequestDetailContent({ requestId }: { requestId: string }) {
  const ar = useAdminLocale() === 'ar'
  const item = useEventRequest(decodeURIComponent(requestId))
  const [pending, setPending] = useState<EventRequestStatus | null>(null)

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Events" title="Event request" titleAr="طلب فعالية" sub="Request detail" subAr="تفاصيل الطلب" />
        <Card title={<AdminText en="Request not found" ar="الطلب غير موجود" />}>
          <p><AdminText en="This local request is not on this browser. It may have been removed or saved elsewhere." ar="هذا الطلب المحلي غير موجود على هذا المتصفح. ربما تم حذفه أو حفظه في مكان آخر." /></p>
          <p><Link className="sp-btn" href="/admin/event-requests"><AdminText en="Back to event requests" ar="عودة لطلبات الفعاليات" /></Link></p>
        </Card>
      </>
    )
  }

  const available = ACTIONS.filter((a) => a.from.includes(item.status))
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US')

  return (
    <>
      <PageHead
        eyebrow="Events"
        title={item.localRef}
        titleAr={item.localRef}
        sub={`${item.eventTitle} · ${item.attendees} ${ar ? 'حضور' : 'attendees'}`}
        subAr={`${item.eventTitle} · ${item.attendees} حضور`}
        actions={<Link className="sp-btn" href="/admin/event-requests"><ArrowLeft size={16} /> <AdminText en="Back to all requests" ar="عودة لكل الطلبات" /></Link>}
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Request overview" ar="نظرة عامة على الطلب" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.localRef}</code><span className="evr-local-tag"><AdminText en="Browser-local" ar="محلي على هذا المتصفح" /></span></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><span className={`sp-status is-${item.status}`}>{eventRequestStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Attendees" ar="الحضور" /></dt><dd><Users size={14} />{item.attendees}</dd></div>
              <div><dt><AdminText en="Submitted" ar="أُرسل" /></dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
            </dl>
            {item.note && <p className="evr-note"><span><AdminText en="Customer note" ar="ملاحظة العميل" /></span>{item.note}</p>}
          </Card>
          <Card title={<AdminText en="Event" ar="الفعالية" />}>
            <div className="evr-event">
              <Link href={`/events/${item.eventSlug}`} className="evr-event-title">{item.eventTitle}</Link>
              <p><CalendarDays size={14} />{item.eventDate}</p>
              <p><MapPin size={14} />{item.eventLocation}</p>
            </div>
          </Card>
        </div>
        <div className="evr-side-col">
        <Card title={<AdminText en="Customer" ar="العميل" />}>
          <dl className="evr-kv evr-customer">
            <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{item.name}</dd></div>
            <div><dt><AdminText en="Nationality" ar="الجنسية" /></dt><dd>{item.nationality || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
            <div><dt><AdminText en="Email" ar="البريد" /></dt><dd><a dir="ltr" href={`mailto:${item.email}`}>{item.email}</a></dd></div>
            <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd><a dir="ltr" href={`tel:${`${item.dialCode} ${item.phone}`.replace(/\s/g, '')}`}>{item.dialCode} {item.phone}</a></dd></div>
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
            <p className="evr-proto" role="note"><FlaskConical size={15} /><span><strong><AdminText en="Prototype workflow" ar="سير عمل تجريبي" /></strong><AdminText en="Status changes are stored in this browser only. Approval does not issue a real event ticket." ar="تُحفظ تغييرات الحالة في هذا المتصفح فقط. القبول لا يُصدر تذكرة فعالية حقيقية." /></span></p>
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
                  <strong>{a.action}</strong>
                  <small>{a.by === 'admin' ? (ar ? 'الإدارة' : 'Staff') : (ar ? 'العميل' : 'Customer')} · {new Date(a.at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {new Date(a.at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</small>
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
        onConfirm={() => { if (pending && canTransitionEventRequest(item.status, pending)) transitionEventRequest(item.localRef, pending, 'admin'); setPending(null) }}
        title={<AdminText en={pending ? `Move to ${actionCopy[pending].en}?` : 'Confirm'} ar={pending ? `نقل إلى ${actionCopy[pending].ar}؟` : 'تأكيد'} />}
        description={<AdminText en={`Updates the same local record ${item.localRef}. The customer view on this browser reflects it immediately.`} ar={`يحدّث نفس السجل المحلي ${item.localRef}. وتنعكس على عرض العميل في هذا المتصفح فورًا.`} />}
        confirmLabel={<AdminText en="Confirm" ar="تأكيد" />}
        cancelLabel={<AdminText en="Keep" ar="تراجع" />}
        tone={pending === 'rejected' || pending === 'cancelled' ? 'danger' : 'primary'}
      />
    </>
  )
}
