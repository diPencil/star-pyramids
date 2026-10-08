'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarDays, FlaskConical, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { destinations } from '@/data/content'
import { useDbDestinations } from '@/lib/catalogue-client'
import { countryByDialCode, countryDisplayName } from '@/data/countries'
import { displayInternationalPhone, telLink } from '@/lib/phone'
import { findTour } from '@/data/tours'
import {
  canTransitionTripRequest,
  tripActivityLabel,
  tripRequestStatusLabel,
  type StaffTripRequest,
  type TripRequestStatus,
} from '@/lib/trip-request'

const ACTIONS: { from: TripRequestStatus[]; to: TripRequestStatus; tone: 'primary' | 'danger' }[] = [
  { from: ['new'], to: 'reviewing', tone: 'primary' },
  { from: ['new'], to: 'cancelled', tone: 'danger' },
  { from: ['reviewing'], to: 'proposal_ready', tone: 'primary' },
  { from: ['reviewing'], to: 'rejected', tone: 'danger' },
  { from: ['reviewing'], to: 'cancelled', tone: 'danger' },
  { from: ['proposal_ready'], to: 'approved', tone: 'primary' },
  { from: ['proposal_ready'], to: 'rejected', tone: 'danger' },
  { from: ['proposal_ready'], to: 'cancelled', tone: 'danger' },
  { from: ['approved', 'rejected'], to: 'reviewing', tone: 'primary' },
]

type TransitionCopy = {
  title: { en: string; ar: string }
  confirm: { en: string; ar: string }
  keep: { en: string; ar: string }
}

/**
 * State/action-aware confirmation copy for every supported transition.
 * Keyed by `from>to`; the dialog falls back to neutral wording for any
 * future transition so copy never blocks lifecycle changes.
 */
const transitionCopy: Record<string, TransitionCopy> = {
  'new>reviewing': {
    title: { en: 'Start reviewing this request?', ar: 'بدء مراجعة هذا الطلب؟' },
    confirm: { en: 'Start review', ar: 'بدء المراجعة' },
    keep: { en: 'Keep as New', ar: 'إبقاء كجديد' },
  },
  'new>cancelled': {
    title: { en: 'Cancel this request?', ar: 'إلغاء هذا الطلب؟' },
    confirm: { en: 'Cancel request', ar: 'إلغاء الطلب' },
    keep: { en: 'Keep as New', ar: 'إبقاء كجديد' },
  },
  'reviewing>proposal_ready': {
    title: { en: 'Mark this proposal as ready?', ar: 'تحديد هذا العرض كجاهز؟' },
    confirm: { en: 'Mark ready', ar: 'تحديد كجاهز' },
    keep: { en: 'Keep reviewing', ar: 'مواصلة المراجعة' },
  },
  'reviewing>rejected': {
    title: { en: 'Reject this request?', ar: 'رفض هذا الطلب؟' },
    confirm: { en: 'Reject', ar: 'رفض' },
    keep: { en: 'Keep reviewing', ar: 'مواصلة المراجعة' },
  },
  'reviewing>cancelled': {
    title: { en: 'Cancel this request?', ar: 'إلغاء هذا الطلب؟' },
    confirm: { en: 'Cancel request', ar: 'إلغاء الطلب' },
    keep: { en: 'Keep reviewing', ar: 'مواصلة المراجعة' },
  },
  'proposal_ready>approved': {
    title: { en: 'Approve this request?', ar: 'الموافقة على هذا الطلب؟' },
    confirm: { en: 'Approve', ar: 'موافقة' },
    keep: { en: 'Keep proposal ready', ar: 'إبقاء العرض جاهزًا' },
  },
  'proposal_ready>rejected': {
    title: { en: 'Reject this request?', ar: 'رفض هذا الطلب؟' },
    confirm: { en: 'Reject', ar: 'رفض' },
    keep: { en: 'Keep proposal ready', ar: 'إبقاء العرض جاهزًا' },
  },
  'proposal_ready>cancelled': {
    title: { en: 'Cancel this request?', ar: 'إلغاء هذا الطلب؟' },
    confirm: { en: 'Cancel request', ar: 'إلغاء الطلب' },
    keep: { en: 'Keep proposal ready', ar: 'إبقاء العرض جاهزًا' },
  },
  'approved>reviewing': {
    title: { en: 'Reopen this request for review?', ar: 'إعادة فتح هذا الطلب للمراجعة؟' },
    confirm: { en: 'Reopen review', ar: 'إعادة فتح المراجعة' },
    keep: { en: 'Keep approved', ar: 'إبقاء معتمدًا' },
  },
  'rejected>reviewing': {
    title: { en: 'Reopen this request for review?', ar: 'إعادة فتح هذا الطلب للمراجعة؟' },
    confirm: { en: 'Reopen review', ar: 'إعادة فتح المراجعة' },
    keep: { en: 'Keep rejected', ar: 'إبقاء مرفوضًا' },
  },
}

const fallbackTransitionCopy: TransitionCopy = {
  title: { en: 'Apply this change?', ar: 'تطبيق هذا التغيير؟' },
  confirm: { en: 'Confirm', ar: 'تأكيد' },
  keep: { en: 'Keep', ar: 'تراجع' },
}

const manageHint: Record<TripRequestStatus, { en: string; ar: string }> = {
  new: {
    en: 'This request is awaiting staff review. Start the review to move it forward, or cancel it if it should not proceed.',
    ar: 'هذا الطلب بانتظار مراجعة الإدارة. ابدأ المراجعة للمضي فيه، أو ألغه إذا كان يجب عدم إتمامه.',
  },
  reviewing: {
    en: 'This request is under staff review. Mark the proposal ready, reject it, or cancel it from the available actions.',
    ar: 'هذا الطلب قيد مراجعة الإدارة. حدد العرض كجاهز أو ارفض الطلب أو ألغه من الإجراءات المتاحة.',
  },
  proposal_ready: {
    en: 'The proposal is marked ready. This is a workflow status only; no proposal document, quote, or payment link has been issued.',
    ar: 'تم تحديد العرض كجاهز. هذه حالة سير عمل فقط؛ لم يُصدر أي مستند عرض أو سعر أو رابط دفع.',
  },
  approved: {
    en: 'This request was approved as an internal decision. It is not a booking confirmation and charges nothing. You can reopen it to reviewing if it needs another look.',
    ar: 'تمت الموافقة على هذا الطلب كقرار داخلي. وليست تأكيد حجز ولا تخصم أي مبلغ. يمكنك إعادته للمراجعة إذا احتاج نظرة أخرى.',
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

const timeCopy: Record<string, { en: string; ar: string }> = {
  exact: { en: 'Exact time', ar: 'موعد محدد' },
  approx: { en: 'Approximate time', ar: 'موعد تقريبي' },
  unsure: { en: 'Not sure yet', ar: 'لم يحدد بعد' },
}

function routeOf(item: StaffTripRequest, dbDestinations: readonly { slug: string; title: string }[]): string {
  if (item.customTitle) return item.customTitle
  if (item.tourSlug) return findTour(item.tourSlug)?.title ?? item.tourSlug
  if (item.destinationSlug) return dbDestinations.find((d) => d.slug === item.destinationSlug)?.title ?? item.destinationSlug
  return ''
}

function dateOf(item: StaffTripRequest): string {
  if (item.preferredFrom && item.preferredTo && item.preferredFrom !== item.preferredTo) return `${item.preferredFrom} → ${item.preferredTo}`
  return item.preferredFrom || item.preferredTo || ''
}

export function TripRequestDetailContent({ requestId }: { requestId: string }) {
  const ar = useAdminLocale() === 'ar'
  const reference = decodeURIComponent(requestId)
  const [item, setItem] = useState<StaffTripRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState<TripRequestStatus | null>(null)
  const [mutating, setMutating] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const dbDestinations = useDbDestinations(destinations)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetch(`/api/admin/trip-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) throw new Error(ar ? 'الطلب غير موجود.' : 'Trip request not found.')
        const data = (await res.json()) as StaffTripRequest
        if (!cancelled) {
          setItem(data)
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Trip request not found.')
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference])

  const mutate = (body: Record<string, unknown>, onDone: () => void) => {
    setMutationError('')
    fetch(`/api/admin/trip-requests/${encodeURIComponent(reference)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = (await res.json()) as StaffTripRequest & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not save the change.')
        setItem(data)
        onDone()
      })
      .catch((error: unknown) => {
        setMutationError(error instanceof Error ? error.message : 'Could not save the change.')
      })
      .finally(() => {
        setMutating(false)
        setNoteSaving(false)
      })
  }

  const confirmTransition = () => {
    if (mutating) return
    if (!pending || !item || !canTransitionTripRequest(item.status, pending)) {
      setPending(null)
      return
    }
    setMutating(true)
    mutate({ status: pending }, () => setPending(null))
  }

  const saveNote = () => {
    if (note.trim() === '' || noteSaving) return
    setNoteSaving(true)
    mutate({ note: note.trim() }, () => setNote(''))
  }

  if (loading) {
    return (
      <>
        <PageHead eyebrow="Requests" title="Trip request" titleAr="طلب رحلة" sub="Request detail" subAr="تفاصيل الطلب" backHref="/admin/trip-requests" />
        <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}>
          <p role="status"><AdminText en="Loading trip request…" ar="جارٍ تحميل طلب الرحلة…" /></p>
        </Card>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Requests" title="Trip request" titleAr="طلب رحلة" sub="Request detail" subAr="تفاصيل الطلب" backHref="/admin/trip-requests" />
        <Card title={<AdminText en="Request not found" ar="الطلب غير موجود" />}>
          <p>{loadError || <AdminText en="This request does not exist." ar="هذا الطلب غير موجود." />}</p>
        </Card>
      </>
    )
  }

  const available = ACTIONS.filter((a) => a.from.includes(item.status))
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US')
  const travelers = item.adults + item.children + item.infants
  const copyFor = (to: TripRequestStatus): TransitionCopy =>
    transitionCopy[`${item.status}>${to}`] ?? fallbackTransitionCopy
  const dialogCopy = pending ? copyFor(pending) : fallbackTransitionCopy
  const phoneCountryCode = item.contact.dialCode ? countryByDialCode(item.contact.dialCode).code : undefined
  const phoneDisplay = displayInternationalPhone(item.contact.dialCode, item.contact.phone)
  const phoneHref = telLink(phoneCountryCode, item.contact.phone)

  return (
    <>
      <PageHead
        eyebrow="Requests"
        title={item.reference}
        titleAr={item.reference}
        sub={`${routeOf(item, dbDestinations) || (ar ? 'رحلة مخصصة' : 'Custom trip')} · ${travelers} ${ar ? 'مسافرين' : 'travelers'}`}
        subAr={`${routeOf(item, dbDestinations) || 'رحلة مخصصة'} · ${travelers} مسافرين`}
        backHref="/admin/trip-requests"
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Request overview" ar="نظرة عامة على الطلب" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Source" ar="المصدر" /></dt><dd>{item.source ? <span><AdminText en="Blog" ar="مدونة" /> - <Link href={`/blogs/${item.source.blogSlug}`}>{item.source.blogTitle}</Link></span> : (ar ? 'مباشر (الموقع)' : 'Direct (website)')}</dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><span className={`sp-status is-${item.status}`}>{tripRequestStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Created" ar="أُنشئ" /></dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
            </dl>
            {item.notes && <p className="evr-note"><span><AdminText en="Customer note" ar="ملاحظة العميل" /></span>{item.notes}</p>}
          </Card>
          <Card title={<AdminText en="Trip requirements" ar="تفاصيل الرحلة المطلوبة" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Route" ar="المسار" /></dt><dd>{routeOf(item, dbDestinations) || (ar ? 'رحلة مخصصة' : 'Custom trip')}</dd></div>
              <div><dt><AdminText en="Dates" ar="التواريخ" /></dt><dd><CalendarDays size={14} /><span dir="ltr">{dateOf(item) || (ar ? 'موعد مرن' : 'Flexible')}</span></dd></div>
              <div><dt><AdminText en="Date flexibility" ar="إيقاع المواعيد" /></dt><dd>{ar ? timeCopy[item.timeMode].ar : timeCopy[item.timeMode].en}</dd></div>
              <div><dt><AdminText en="Travelers" ar="المسافرون" /></dt><dd><Users size={14} />{ar ? `${item.adults} بالغ، ${item.children} أطفال، ${item.infants} رضع` : `${item.adults} adults, ${item.children} children, ${item.infants} infants`}</dd></div>
              <div><dt><AdminText en="Budget" ar="الميزانية" /></dt><dd><span dir="ltr">{item.budgetMin.toLocaleString('en-US')} - {item.budgetMax.toLocaleString('en-US')} {item.currency}</span></dd></div>
              <div><dt><AdminText en="Flight options" ar="خيارات الطيران" /></dt><dd>{item.flightOffer ? (ar ? 'مطلوبة' : 'Requested') : (ar ? 'غير مطلوبة' : 'Not requested')}</dd></div>
              {item.requestedAddOns.length > 0 && <div><dt><AdminText en="Add-ons" ar="إضافات" /></dt><dd>{item.requestedAddOns.join(ar ? '، ' : ', ')}</dd></div>}
            </dl>
          </Card>
        </div>
        <div className="evr-side-col">
          <Card title={<AdminText en="Customer" ar="العميل" />}>
            <dl className="evr-kv evr-customer">
              <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{item.contact.name}</dd></div>
              <div><dt><AdminText en="Nationality" ar="الجنسية" /></dt><dd>{countryDisplayName(item.contact.nationality, ar ? 'ar' : 'en') || (ar ? 'غير محدد' : 'Not specified')}</dd></div>
              <div><dt><AdminText en="Email" ar="البريد" /></dt><dd><a dir="ltr" href={`mailto:${item.contact.email}`}>{item.contact.email}</a></dd></div>
              <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd>{phoneDisplay ? <a dir="ltr" href={phoneHref || undefined}>{phoneDisplay}</a> : (ar ? 'غير محدد' : 'Not specified')}</dd></div>
            </dl>
            <p className="evr-note">
              <span><AdminText en="Ownership" ar="الملكية" /></span>
              {item.account
                ? (ar ? `حساب مسجل: ${item.account.email}` : `Registered account: ${item.account.email}`)
                : (ar ? 'زائر غير موثّق. لم يتم التحقق من ملكية أي حساب.' : 'Unverified guest. No account ownership verified.')}
            </p>
          </Card>
          <Card title={<AdminText en="Request management" ar="إدارة الطلب" />}>
            <div className="evr-manage">
              <p className="evr-manage-status"><AdminText en="Current status" ar="الحالة الحالية" /> <span className={`sp-status is-${item.status}`}>{tripRequestStatusLabel(item.status, ar)}</span></p>
              <p className="evr-manage-hint">{ar ? manageHint[item.status].ar : manageHint[item.status].en}</p>
              {available.length ? (
                <div className="evr-actions">
                  {available.map((a) => (
                    <button key={a.to} type="button" className={`sp-btn ${a.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => setPending(a.to)} disabled={mutating}>
                      <AdminText en={copyFor(a.to).confirm.en} ar={copyFor(a.to).confirm.ar} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="evr-manage-hint"><AdminText en="No further transitions. Cancelled requests are terminal." ar="لا توجد انتقالات أخرى. الطلبات الملغاة نهائية." /></p>
              )}
              <div className="sp-form" style={{ marginTop: 12 }}>
                <label><AdminText en="Internal note (staff only, never shown to the customer)" ar="ملاحظة داخلية (للإدارة فقط، لا تظهر للعميل أبدًا)" /><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={ar ? 'اكتب ملاحظة داخلية…' : 'Write an internal note…'} disabled={noteSaving} /></label>
                <div><button type="button" className="sp-btn" onClick={saveNote} disabled={noteSaving || note.trim() === ''}>{noteSaving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save internal note" ar="حفظ ملاحظة داخلية" />}</button></div>
              </div>
              {mutationError && <p role="alert" style={{ color: '#b91c1c' }}>{mutationError}</p>}
              <p className="evr-proto" role="note"><FlaskConical size={15} /><span><strong><AdminText en="Live workflow" ar="سير عمل فعلي" /></strong><AdminText en="Status changes are stored in the database and visible to the customer immediately. Approval is an internal decision, not a booking confirmation." ar="تُحفظ تغييرات الحالة في قاعدة البيانات وتظهر للعميل فورًا. الموافقة قرار داخلي وليست تأكيد حجز." /></span></p>
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
                  <strong>{tripActivityLabel(a.action, ar)}{a.internal ? (ar ? ' · داخلية' : ' · Internal') : ''}</strong>
                  <small>{a.by === 'staff' ? (ar ? 'الإدارة' : 'Staff') : a.by === 'system' ? (ar ? 'النظام' : 'System') : (ar ? 'العميل' : 'Customer')} · {new Date(a.at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {new Date(a.at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</small>
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
        onClose={() => { if (!mutating) setPending(null) }}
        onConfirm={confirmTransition}
        title={<AdminText en={dialogCopy.title.en} ar={dialogCopy.title.ar} />}
        description={<AdminText en={`Updates request ${item.reference}. The customer sees the new status immediately.`} ar={`يحدّث الطلب ${item.reference}. ويرى العميل الحالة الجديدة فورًا.`} />}
        confirmLabel={<AdminText en={dialogCopy.confirm.en} ar={dialogCopy.confirm.ar} />}
        cancelLabel={<AdminText en={dialogCopy.keep.en} ar={dialogCopy.keep.ar} />}
        tone={pending === 'rejected' || pending === 'cancelled' ? 'danger' : 'primary'}
      />
    </>
  )
}
