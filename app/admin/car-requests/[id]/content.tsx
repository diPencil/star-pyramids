'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarDays, CarFront, FlaskConical, Mail, MapPin, MessageCircle, Phone, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { AdminEmpty, AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { useDbCars } from '@/lib/events-cars-client'
import { cars } from '@/data/content'
import { phoneHref, whatsappHref } from '@/data/company'
import { SharedSelect } from '@/components/shared-select'
import {
  canTransitionCarRequest,
  carActivityLabel,
  carRequestStatusLabel,
  fleetVehicleTitle,
  type CarRequestStatus,
  type StaffCarRequest,
} from '@/lib/car-request'

const ACTIONS: { from: CarRequestStatus[]; to: CarRequestStatus; tone: 'primary' | 'danger' }[] = [
  { from: ['new'], to: 'reviewing', tone: 'primary' },
  { from: ['new'], to: 'cancelled', tone: 'danger' },
  { from: ['reviewing'], to: 'confirmed', tone: 'primary' },
  { from: ['reviewing'], to: 'cancelled', tone: 'danger' },
  { from: ['cancelled'], to: 'reviewing', tone: 'primary' },
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
  'reviewing>confirmed': {
    title: { en: 'Confirm this request?', ar: 'تأكيد هذا الطلب؟' },
    confirm: { en: 'Confirm request', ar: 'تأكيد الطلب' },
    keep: { en: 'Keep reviewing', ar: 'مواصلة المراجعة' },
  },
  'reviewing>cancelled': {
    title: { en: 'Cancel this request?', ar: 'إلغاء هذا الطلب؟' },
    confirm: { en: 'Cancel request', ar: 'إلغاء الطلب' },
    keep: { en: 'Keep reviewing', ar: 'مواصلة المراجعة' },
  },
  'cancelled>reviewing': {
    title: { en: 'Reopen this request for review?', ar: 'إعادة فتح هذا الطلب للمراجعة؟' },
    confirm: { en: 'Reopen review', ar: 'إعادة فتح المراجعة' },
    keep: { en: 'Keep cancelled', ar: 'إبقاء ملغيًا' },
  },
}

const fallbackTransitionCopy: TransitionCopy = {
  title: { en: 'Apply this change?', ar: 'تطبيق هذا التغيير؟' },
  confirm: { en: 'Confirm', ar: 'تأكيد' },
  keep: { en: 'Keep', ar: 'تراجع' },
}

const manageHint: Record<CarRequestStatus, { en: string; ar: string }> = {
  new: {
    en: 'This request is awaiting staff review. Start the review to move it forward, or cancel it if it should not proceed.',
    ar: 'هذا الطلب بانتظار مراجعة الإدارة. ابدأ المراجعة للمضي فيه، أو ألغه إذا كان يجب عدم إتمامه.',
  },
  reviewing: {
    en: 'This request is under staff review. Assign a fleet vehicle, then confirm it — or cancel it from the available actions.',
    ar: 'هذا الطلب قيد مراجعة الإدارة. خصص مركبة من الأسطول ثم أكده — أو ألغه من الإجراءات المتاحة.',
  },
  confirmed: {
    en: 'This request is confirmed as an internal decision. It is not a booking confirmation and charges nothing. Confirmed requests are terminal.',
    ar: 'تم تأكيد هذا الطلب كقرار داخلي. وليست تأكيد حجز ولا تخصم أي مبلغ. الطلبات المؤكدة نهائية.',
  },
  cancelled: {
    en: 'This request was cancelled. You can reopen it to reviewing if the decision should be reconsidered.',
    ar: 'تم إلغاء هذا الطلب. يمكنك إعادته للمراجعة إذا وجب إعادة النظر في القرار.',
  },
}

export function CarRequestDetailContent({ requestId }: { requestId: string }) {
  const ar = useAdminLocale() === 'ar'
  const reference = decodeURIComponent(requestId).toUpperCase()
  const liveCars = useDbCars(cars)
  const [item, setItem] = useState<StaffCarRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState<CarRequestStatus | null>(null)
  const [mutating, setMutating] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetch(`/api/admin/car-requests/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) throw new Error(ar ? 'الطلب غير موجود.' : 'Car request not found.')
        const data = (await res.json()) as StaffCarRequest
        if (!cancelled) {
          setItem(data)
          setLoading(false)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'Car request not found.')
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference])

  const mutate = (body: Record<string, unknown>, onDone: () => void) => {
    setMutationError('')
    fetch(`/api/admin/car-requests/${encodeURIComponent(reference)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = (await res.json()) as StaffCarRequest & { error?: string }
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
        setAssigning(false)
      })
  }

  const confirmTransition = () => {
    if (mutating) return
    if (!pending || !item || !canTransitionCarRequest(item.status, pending)) {
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

  const saveAssignment = (slug: string) => {
    if (!slug || assigning) return
    setAssigning(true)
    mutate({ assignedVehicle: slug }, () => undefined)
  }

  if (loading) {
    return (
      <>
        <PageHead eyebrow="Rentals" title="Car request" titleAr="طلب سيارة" sub="Request detail" subAr="تفاصيل الطلب" backHref="/admin/car-requests" />
        <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}>
          <p role="status"><AdminText en="Loading car request…" ar="جارٍ تحميل طلب السيارة…" /></p>
        </Card>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Rentals" title="Car request" titleAr="طلب سيارة" sub="Request detail" subAr="تفاصيل الطلب" backHref="/admin/car-requests" />
        <Card title={<AdminText en="Request not found" ar="الطلب غير موجود" />}>
          <p>{loadError || <AdminText en="This request does not exist." ar="هذا الطلب غير موجود." />}</p>
        </Card>
      </>
    )
  }

  const available = ACTIONS.filter((a) => a.from.includes(item.status))
  const assignedCar = item.assignedVehicleSlug !== '' ? liveCars.find((car) => car.slug === item.assignedVehicleSlug) : undefined
  const requestedTitle = liveCars.find((car) => car.slug === item.vehicleSlug)?.title ?? item.vehicleSlug
  const confirmBlocked = item.status === 'reviewing' && item.assignedVehicleSlug === ''
  const copyFor = (to: CarRequestStatus): TransitionCopy =>
    transitionCopy[`${item.status}>${to}`] ?? fallbackTransitionCopy
  const dialogCopy = pending ? copyFor(pending) : fallbackTransitionCopy
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US')
  const dateText = item.preferredPickupDate && item.preferredReturnDate && item.preferredPickupDate !== item.preferredReturnDate
    ? `${item.preferredPickupDate} → ${item.preferredReturnDate}`
    : item.preferredPickupDate || ''

  return (
    <>
      <PageHead
        eyebrow="Rentals"
        title={item.reference}
        titleAr={item.reference}
        sub={`${item.contact.name} · ${item.tripType} · ${item.passengers} ${ar ? 'ركاب' : 'passengers'}`}
        subAr={`${item.contact.name} · ${item.tripType} · ${item.passengers} ركاب`}
        backHref="/admin/car-requests"
        actions={<>
          <Link className="sp-btn" href="/admin/cars"><CarFront size={16} /> <AdminText en="Fleet" ar="الأسطول" /></Link>
        </>}
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Request overview" ar="نظرة عامة على الطلب" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><span className={`sp-status is-${item.status}`}>{carRequestStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Created" ar="أُنشئ" /></dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
              <div><dt><AdminText en="Trip type" ar="نوع الرحلة" /></dt><dd>{item.tripType}</dd></div>
              <div><dt><AdminText en="Requested vehicle" ar="المركبة المطلوبة" /></dt><dd>{requestedTitle}</dd></div>
              <div><dt><AdminText en="Assigned vehicle" ar="المركبة المخصصة" /></dt><dd>{item.assignedVehicleSlug !== '' ? (assignedCar?.title ?? item.assignedVehicleSlug) : (ar ? 'لم تُخصص بعد' : 'Not assigned yet')}</dd></div>
            </dl>
            {item.notes && <p className="evr-note"><span><AdminText en="Customer note" ar="ملاحظة العميل" /></span>{item.notes}</p>}
            <p className="evr-note">
              <span><AdminText en="Preference only" ar="تفضيل فقط" /></span>
              <AdminText en="The requested vehicle is a customer preference only. It does not confirm availability, assignment, rate, or booking." ar="المركبة المطلوبة هي تفضيل عميل فقط، ولا تؤكد التوافر أو التخصيص أو السعر أو الحجز." />
            </p>
          </Card>
          <Card title={<AdminText en="Journey" ar="الرحلة" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Pickup" ar="الاستلام" /></dt><dd><MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {item.pickup}</dd></div>
              <div><dt><AdminText en="Drop-off" ar="التسليم" /></dt><dd><MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {item.dropoff}</dd></div>
              <div><dt><AdminText en="Preferred pickup date" ar="تاريخ الاستلام المفضل" /></dt><dd><CalendarDays size={14} /><span dir="ltr">{item.preferredPickupDate || (ar ? 'غير محدد' : 'Not set')}</span></dd></div>
              <div><dt><AdminText en="Preferred return date" ar="تاريخ العودة المفضل" /></dt><dd><span dir="ltr">{item.tripType === 'Round Trip' && item.preferredReturnDate ? item.preferredReturnDate : '—'}</span></dd></div>
              <div><dt><AdminText en="Passengers" ar="الركاب" /></dt><dd><Users size={14} />{item.passengers}</dd></div>
            </dl>
          </Card>
        </div>
        <div className="evr-side-col">
          <Card title={<AdminText en="Customer" ar="العميل" />}>
            <dl className="evr-kv evr-customer">
              <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{item.contact.name}</dd></div>
              <div><dt><AdminText en="Email" ar="البريد" /></dt><dd><a dir="ltr" href={`mailto:${item.contact.email}`}>{item.contact.email}</a></dd></div>
              <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd><a dir="ltr" href={phoneHref(item.contact.phone) || undefined}>{item.contact.phone}</a></dd></div>
            </dl>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="sp-btn" href={`mailto:${item.contact.email}`}><Mail size={15} /> <AdminText en="Email" ar="بريد" /></a>
              <a className="sp-btn" href={phoneHref(item.contact.phone)}><Phone size={15} /> <AdminText en="Call" ar="اتصال" /></a>
              <a className="sp-btn" href={whatsappHref(item.contact.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> <AdminText en="WhatsApp" ar="واتساب" /></a>
            </div>
            <p className="evr-note">
              <span><AdminText en="Ownership" ar="الملكية" /></span>
              {item.account
                ? (ar ? `حساب مسجل: ${item.account.email}` : `Registered account: ${item.account.email}`)
                : (ar ? 'زائر غير موثّق. لم يتم التحقق من ملكية أي حساب.' : 'Unverified guest. No account ownership verified.')}
            </p>
          </Card>
          <Card title={<AdminText en="Assigned vehicle" ar="المركبة المخصصة" />}>
            <div className="sp-form" style={{ marginBottom: 12 }}>
              <label><AdminText en="Assigned fleet vehicle" ar="مركبة الأسطول المخصصة" />
                <SharedSelect
                  value={item.assignedVehicleSlug}
                  disabled={item.status === 'confirmed' || item.status === 'cancelled' || assigning}
                  onChange={(next) => { if (next) saveAssignment(next) }}
                  locale={ar ? 'ar' : 'en'}
                  label={ar ? 'المركبة المخصصة' : 'Assigned vehicle'}
                  popupWidth="trigger"
                  options={[{ value: '', label: ar ? 'بدون تخصيص' : 'Not assigned' }, ...liveCars.map((car) => ({ value: car.slug, label: `${car.title} · ${car.slug}${car.isPublished === false ? (ar ? ' · مخفي من الموقع' : ' · Hidden from website') : ''}` }))]} />
              </label>
            </div>
            <p style={{ margin: 0, color: 'var(--sp-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
              <AdminText
                en="Assignment only — availability has not been checked. A vehicle must be assigned before confirming."
                ar="تخصيص فقط — لم يتم التحقق من التوافر. يجب تخصيص مركبة قبل التأكيد."
              />
            </p>
          </Card>
          <Card title={<AdminText en="Request management" ar="إدارة الطلب" />}>
            <div className="evr-manage">
              <p className="evr-manage-status"><AdminText en="Current status" ar="الحالة الحالية" /> <span className={`sp-status is-${item.status}`}>{carRequestStatusLabel(item.status, ar)}</span></p>
              <p className="evr-manage-hint">{ar ? manageHint[item.status].ar : manageHint[item.status].en}</p>
              {available.length ? (
                <div className="evr-actions">
                  {available.map((a) => (
                    <button
                      key={a.to}
                      type="button"
                      className={`sp-btn ${a.tone === 'danger' ? 'danger' : 'primary'}`}
                      onClick={() => setPending(a.to)}
                      disabled={mutating || (a.to === 'confirmed' && confirmBlocked)}
                    >
                      <AdminText en={copyFor(a.to).confirm.en} ar={copyFor(a.to).confirm.ar} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="evr-manage-hint"><AdminText en="No further transitions. Confirmed requests are terminal." ar="لا توجد انتقالات أخرى. الطلبات المؤكدة نهائية." /></p>
              )}
              {confirmBlocked && (
                <p role="alert" style={{ margin: '12px 0 0', color: '#b91c1c', fontSize: 13 }}>
                  <AdminText en="Select an assigned vehicle above before confirming." ar="اختر مركبة مخصصة أعلاه قبل التأكيد." />
                </p>
              )}
              <div className="sp-form" style={{ marginTop: 12 }}>
                <label><AdminText en="Internal note (staff only, never shown to the customer)" ar="ملاحظة داخلية (للإدارة فقط، لا تظهر للعميل أبدًا)" /><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={ar ? 'اكتب ملاحظة داخلية…' : 'Write an internal note…'} disabled={noteSaving} /></label>
                <div><button type="button" className="sp-btn" onClick={saveNote} disabled={noteSaving || note.trim() === ''}>{noteSaving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save internal note" ar="حفظ ملاحظة داخلية" />}</button></div>
              </div>
              {mutationError && <p role="alert" style={{ color: '#b91c1c' }}>{mutationError}</p>}
              <p className="evr-proto" role="note"><FlaskConical size={15} /><span><strong><AdminText en="Live workflow" ar="سير عمل فعلي" /></strong><AdminText en="Status changes are stored in the database and visible to the customer immediately. Confirmation is an internal decision, not a booking confirmation." ar="تُحفظ تغييرات الحالة في قاعدة البيانات وتظهر للعميل فورًا. التأكيد قرار داخلي وليست تأكيد حجز." /></span></p>
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
                  <strong>{carActivityLabel(a.action, ar)}{a.internal ? (ar ? ' · داخلية' : ' · Internal') : ''}</strong>
                  <small>{a.by === 'staff' ? (ar ? 'الإدارة' : 'Staff') : a.by === 'system' ? (ar ? 'النظام' : 'System') : (ar ? 'العميل' : 'Customer')} · {new Date(a.at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {new Date(a.at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })}</small>
                  {a.note && <small className="evr-note-inline">{a.action === 'Assigned vehicle updated' ? fleetVehicleTitle(liveCars, a.note) : a.note}</small>}
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
        tone={pending === 'cancelled' ? 'danger' : 'primary'}
      />
    </>
  )
}
