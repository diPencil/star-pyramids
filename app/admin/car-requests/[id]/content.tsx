'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, Ban, CarFront, Check, CheckCircle2, Copy, ExternalLink, Mail, MapPin, MessageCircle, Pencil, Phone, Play, RotateCcw, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { AdminEmpty, AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { SharedSelect } from '@/components/shared-select'
import { CancelRequestDialog, ConfirmRequestDialog, ReopenRequestDialog, StartReviewDialog, cancelReasonText } from '@/components/admin/car-request-dialogs'
import { useHiddenCars, useLiveCollection } from '@/lib/admin-store'
import { cars } from '@/data/content'
import { phoneHref, whatsappHref } from '@/data/company'
import {
  allowedActions,
  commitAssignment,
  commitNote,
  commitStore,
  getEffectiveRequest,
  resetRequestOps,
  useCarRequestOps,
  OPS_TEXT_MAX,
  type CancelReasonId,
  type OpsActivity,
} from '@/lib/car-request-ops'

function ActivityLabels({ activity }: { activity: OpsActivity }) {
  switch (activity.kind) {
    case 'fixture-loaded':
      return <AdminText en="Demo fixture loaded — not a customer submission" ar="تم تحميل بيانات تجريبية — ليست طلب عميل" />
    case 'review-started':
      return <AdminText en="Review started (local demo)" ar="بدء المراجعة (تجريبي محلي)" />
    case 'assigned-vehicle-changed':
      return <AdminText en={`Assigned vehicle changed to ${activity.note ?? ''}`} ar={`تغيير المركبة المخصصة إلى ${activity.note ?? ''}`} />
    case 'note-added':
      return <AdminText en="Internal note added" ar="إضافة ملاحظة داخلية" />
    case 'note-edited':
      return <AdminText en="Internal note edited" ar="تعديل ملاحظة داخلية" />
    case 'cancelled':
      return <AdminText en="Request cancelled (local demo)" ar="إلغاء الطلب (تجريبي محلي)" />
    case 'reopened':
      return <AdminText en="Request reopened to Reviewing" ar="إعادة فتح الطلب إلى قيد المراجعة" />
    case 'confirmed':
      return <AdminText en="Request confirmed (demo state only)" ar="تأكيد الطلب (حالة تجريبية فقط)" />
  }
}

function formatActivityTime(at: string, fixture: boolean | undefined, ar: boolean): string {
  if (fixture) return at
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return at
  return date.toLocaleString(ar ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

export function CarRequestDetailContent({ requestId }: { requestId: string }) {
  const ar = useAdminLocale() === 'ar'
  const ref = decodeURIComponent(requestId).toUpperCase()
  const opsStore = useCarRequestOps()
  const request = getEffectiveRequest(ref, opsStore)
  const liveCars = useLiveCollection('cars', cars, { includeHidden: true })
  const hiddenCars = useHiddenCars()

  const [dialog, setDialog] = useState<'start-review' | 'confirm' | 'cancel' | 'reopen' | 'reset' | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [copied, setCopied] = useState<'email' | 'phone' | null>(null)

  const assignedCar = useMemo(
    () => (request ? liveCars.find((car) => car.slug === request.assignedVehicleSlug) : undefined),
    [request, liveCars],
  )

  if (!request) {
    return <>
      <PageHead eyebrow="Rentals" title="Car Request" titleAr="طلب سيارة" actions={<Link className="sp-btn" href="/admin/car-requests"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>} />
      <AdminEmpty title={<AdminText en="Request not found" ar="الطلب غير موجود" />} copy={<AdminText en="This demo reference does not exist." ar="هذا المرجع التجريبي غير موجود." />} />
    </>
  }

  const actions = allowedActions(request.status)
  const confirmBlocked = request.status === 'reviewing' && !assignedCar

  const copyContact = async (kind: 'email' | 'phone', value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 2000)
    } catch {
      // Clipboard unavailable; the value stays visible for manual copy.
    }
  }

  const saveNote = () => {
    if (!noteDraft.trim()) return
    if (commitNote(request.ref, noteDraft)) setNoteDraft('')
  }

  const saveEditedNote = () => {
    if (!editingNoteId || !editingText.trim()) return
    if (commitNote(request.ref, editingText, editingNoteId)) {
      setEditingNoteId(null)
      setEditingText('')
    }
  }

  return <>
    <PageHead
      eyebrow="Rentals"
      title={request.ref}
      sub={`${request.customerName} · ${request.tripType}`}
      actions={<>
        <Link className="sp-btn" href="/admin/car-requests"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>
        <Link className="sp-btn" href="/admin/cars"><CarFront size={16} /> <AdminText en="Fleet" ar="الأسطول" /></Link>
      </>}
    />

    <Card title={<AdminText en="Request workflow" ar="سير عمل الطلب" />} sub={<AdminText en="Local demo transitions — nothing is sent, reserved, or charged" ar="تحولات تجريبية محلية — لا يتم إرسال أو حجز أو خصم أي شيء" />}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {actions.includes('start-review') && (
          <button type="button" className="sp-btn primary" onClick={() => setDialog('start-review')}><Play size={16} /> <AdminText en="Start review" ar="بدء المراجعة" /></button>
        )}
        {actions.includes('confirm') && (
          <button type="button" className="sp-btn primary" onClick={() => setDialog('confirm')} disabled={confirmBlocked}><CheckCircle2 size={16} /> <AdminText en="Confirm request" ar="تأكيد الطلب" /></button>
        )}
        {actions.includes('cancel') && (
          <button type="button" className="sp-btn" onClick={() => setDialog('cancel')}><Ban size={16} /> <AdminText en="Cancel request" ar="إلغاء الطلب" /></button>
        )}
        {actions.includes('reopen') && (
          <button type="button" className="sp-btn" onClick={() => setDialog('reopen')}><RotateCcw size={16} /> <AdminText en="Reopen request" ar="إعادة فتح الطلب" /></button>
        )}
        {request.status === 'confirmed' && (
          <span style={{ color: 'var(--sp-muted)', fontSize: 13 }}><AdminText en="Confirmed is terminal in this demo — no further workflow actions." ar="التأكيد نهائي في هذه النسخة التجريبية — لا توجد إجراءات أخرى." /></span>
        )}
      </div>
      {confirmBlocked && (
        <p role="alert" style={{ margin: '12px 0 0', color: '#b91c1c', fontSize: 13 }}>
          <AdminText en="Select an assigned vehicle below before confirming." ar="اختر مركبة مخصصة أدناه قبل التأكيد." />
        </p>
      )}
      {request.status === 'cancelled' && request.cancelReasonId && (
        <p style={{ margin: '12px 0 0', fontSize: 13 }}>
          <AdminText en="Cancellation reason: " ar="سبب الإلغاء: " />
          <strong>{cancelReasonText(request.cancelReasonId, ar)}{request.cancelNote ? ` — ${request.cancelNote}` : ''}</strong>
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <button type="button" className="sp-delete-btn" onClick={() => setDialog('reset')}><AdminText en="Reset demo state" ar="إعادة تعيين الحالة التجريبية" /></button>
      </div>
    </Card>

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Request overview" ar="نظرة عامة على الطلب" />} sub={<AdminText en="Demo fixture — not a customer submission" ar="بيانات تجريبية — ليست طلب عميل" />}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <Avatar name={request.customerName} size={52} />
          <div><h3 style={{ margin: 0 }} dir="ltr">{request.ref}</h3><small style={{ color: 'var(--sp-muted)' }}>{request.tripType} · <AdminText en="Demo status" ar="حالة تجريبية" /></small><div style={{ marginTop: 6 }}><StatusPill status={request.status} /></div></div>
        </div>
        <div className="sp-detail-grid">
          <div><small><AdminText en="Demo reference" ar="المرجع التجريبي" /></small><strong dir="ltr">{request.ref}</strong></div>
          <div><small><AdminText en="Trip type" ar="نوع الرحلة" /></small><strong>{request.tripType}</strong></div>
          <div><small><AdminText en="Requested vehicle" ar="المركبة المطلوبة" /></small><strong>{request.vehicleName}</strong></div>
          <div><small><AdminText en="Vehicle slug" ar="معرف المركبة" /></small><strong>{request.vehicleSlug}</strong></div>
          <div><small><AdminText en="Passengers" ar="الركاب" /></small><strong>{request.passengers}</strong></div>
          <div><small><AdminText en="Received (demo)" ar="الاستلام (تجريبي)" /></small><strong dir="ltr">{request.receivedOn}</strong></div>
        </div>
        <p style={{ margin: 0, color: 'var(--sp-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
          <AdminText
            en="Requested vehicle is a customer preference only. It does not confirm availability, assignment, rate, or booking."
            ar="المركبة المطلوبة هي تفضيل عميل فقط، ولا تؤكد التوافر أو التخصيص أو السعر أو الحجز."
          />
        </p>
      </Card>

      <Card title={<AdminText en="Customer" ar="العميل" />} sub={<AdminText en="Demo contact details" ar="بيانات تواصل تجريبية" />}>
        <div className="sp-detail-grid">
          <div><small><AdminText en="Full name" ar="الاسم الكامل" /></small><strong>{request.customerName}</strong></div>
          <div><small><AdminText en="Email" ar="البريد" /></small><strong dir="ltr">{request.customerEmail}</strong></div>
          <div><small><AdminText en="Phone" ar="الهاتف" /></small><strong dir="ltr">{request.customerPhone}</strong></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="sp-btn" href={`mailto:${request.customerEmail}`}><Mail size={15} /> <AdminText en="Email" ar="بريد" /></a>
          <a className="sp-btn" href={phoneHref(request.customerPhone)}><Phone size={15} /> <AdminText en="Call" ar="اتصال" /></a>
          <a className="sp-btn" href={whatsappHref(request.customerPhone)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> <AdminText en="WhatsApp" ar="واتساب" /></a>
          <button type="button" className="sp-btn" onClick={() => copyContact('email', request.customerEmail)}>{copied === 'email' ? <Check size={15} /> : <Copy size={15} />} <AdminText en={copied === 'email' ? 'Copied' : 'Copy email'} ar={copied === 'email' ? 'تم النسخ' : 'نسخ البريد'} /></button>
          <button type="button" className="sp-btn" onClick={() => copyContact('phone', request.customerPhone)}>{copied === 'phone' ? <Check size={15} /> : <Copy size={15} />} <AdminText en={copied === 'phone' ? 'Copied' : 'Copy phone'} ar={copied === 'phone' ? 'تم النسخ' : 'نسخ الهاتف'} /></button>
        </div>
        <p style={{ margin: '10px 0 0', color: 'var(--sp-muted)', fontSize: 12 }}>
          <AdminText en="Shortcuts only open your mail, phone, or WhatsApp app. Nothing is sent automatically." ar="هذه اختصارات تفتح فقط تطبيق البريد أو الهاتف أو واتساب. لا يتم إرسال أي شيء تلقائيًا." />
        </p>
        <div style={{ marginTop: 10 }}>
          <Link className="sp-btn" href="/admin/customers"><Users size={16} /> <AdminText en="Open customers" ar="فتح العملاء" /></Link>
        </div>
      </Card>
    </div>

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Assigned vehicle" ar="المركبة المخصصة" />} sub={<AdminText en="Admin demo selection — availability has not been checked" ar="اختيار تجريبي للإدارة — لم يتم التحقق من التوافر" />}>
        <div className="sp-form" style={{ marginBottom: 12 }}>
          <label><AdminText en="Assigned vehicle" ar="المركبة المخصصة" />
            <SharedSelect
              value={request.assignedVehicleSlug}
              disabled={request.status === 'confirmed'}
              onChange={(next) => { if (next) commitAssignment(request.ref, next) }}
              locale={ar ? 'ar' : 'en'}
              label={ar ? 'المركبة المخصصة' : 'Assigned vehicle'}
              popupWidth="trigger"
              options={liveCars.map((car) => ({ value: car.slug, label: `${car.title} · ${car.slug}${hiddenCars.includes(car.slug) ? (ar ? ' · مخفي من الموقع' : ' · Hidden from website') : ''}` }))}
            />
          </label>
        </div>
        <div className="sp-detail-grid">
          <div><small><AdminText en="Requested (preference)" ar="المطلوبة (تفضيل)" /></small><strong>{request.vehicleName}</strong></div>
          <div><small><AdminText en="Assigned (demo)" ar="المخصصة (تجريبي)" /></small><strong>{assignedCar ? assignedCar.title : <AdminText en="Not in fleet" ar="ليست في الأسطول" />}</strong></div>
        </div>
        {!assignedCar && (
          <p role="alert" style={{ margin: '0 0 10px', color: '#b91c1c', fontSize: 13 }}>
            <AdminText en="The assigned vehicle is no longer in the fleet. Choose another vehicle to confirm." ar="المركبة المخصصة لم تعد في الأسطول. اختر مركبة أخرى للتأكيد." />
          </p>
        )}
        <p style={{ margin: 0, color: 'var(--sp-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
          <AdminText
            en="Demo assignment — availability has not been checked. Changing it only updates local demo state."
            ar="تخصيص تجريبي — لم يتم التحقق من التوافر. تغييره يحدّث الحالة التجريبية المحلية فقط."
          />
        </p>
      </Card>

      <Card title={<AdminText en="Journey" ar="الرحلة" />} sub={<AdminText en="Requested route and preferred dates" ar="المسار المطلوب والتواريخ المفضلة" />}>
        <div className="sp-detail-grid">
          <div><small><AdminText en="Pickup" ar="الاستلام" /></small><strong><MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {request.pickup}</strong></div>
          <div><small><AdminText en="Drop-off" ar="التسليم" /></small><strong><MapPin size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {request.dropoff}</strong></div>
          <div><small><AdminText en="Preferred pickup date" ar="تاريخ الاستلام المفضل" /></small><strong dir="ltr">{request.preferredPickupDate}</strong></div>
          <div><small><AdminText en="Preferred return date" ar="تاريخ العودة المفضل" /></small><strong dir="ltr">{request.tripType === 'Round Trip' && request.preferredReturnDate ? request.preferredReturnDate : '—'}</strong></div>
        </div>
      </Card>
    </div>

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Internal notes" ar="ملاحظات داخلية" />} sub={<AdminText en="Staff-only demo notes — never shown to customers" ar="ملاحظات تجريبية للموظفين فقط — لا تظهر للعملاء أبدًا" />}>
        {request.internalNotes.length ? (
          <div className="sp-detail-list" style={{ marginBottom: 12 }}>
            {request.internalNotes.map((note) => (
              <div key={note.id}>
                {editingNoteId === note.id ? (
                  <span style={{ display: 'grid', gap: 8, width: '100%' }}>
                    <textarea rows={2} value={editingText} onChange={(event) => setEditingText(event.target.value)} maxLength={OPS_TEXT_MAX} aria-label={ar ? 'تعديل الملاحظة' : 'Edit note'} style={{ width: '100%', minHeight: 64, padding: 10, border: '1px solid var(--sp-border)', borderRadius: 10, font: 'inherit', fontSize: 13 }} />
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="sp-btn primary" onClick={saveEditedNote} disabled={!editingText.trim()}><AdminText en="Save" ar="حفظ" /></button>
                      <button type="button" className="sp-btn" onClick={() => { setEditingNoteId(null); setEditingText('') }}><AdminText en="Back" ar="رجوع" /></button>
                    </span>
                  </span>
                ) : (
                  <>
                    <span><small style={{ color: 'var(--sp-muted)' }}>{note.text}</small></span>
                    <button type="button" className="sp-table-action" onClick={() => { setEditingNoteId(note.id); setEditingText(note.text) }} aria-label={ar ? 'تعديل الملاحظة' : 'Edit note'} title={ar ? 'تعديل الملاحظة' : 'Edit note'}><Pencil size={18} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--sp-muted)', fontSize: 13 }}><AdminText en="No internal notes yet." ar="لا توجد ملاحظات داخلية بعد." /></p>
        )}
        <div className="sp-form">
          <label><AdminText en="Add a note" ar="إضافة ملاحظة" />
            <textarea rows={2} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={OPS_TEXT_MAX} placeholder={ar ? 'اكتب ملاحظة داخلية...' : 'Write an internal note...'} />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" className="sp-btn primary" onClick={saveNote} disabled={!noteDraft.trim()}><AdminText en="Add note" ar="إضافة ملاحظة" /></button>
        </div>
      </Card>

      <Card title={<AdminText en="Additional request" ar="طلب إضافي" />} sub={<AdminText en="Notes from the demo enquiry" ar="ملاحظات من الاستفسار التجريبي" />}>
        {request.notes
          ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7 }}>{request.notes}</p>
          : <p style={{ margin: 0, color: 'var(--sp-muted)' }}><AdminText en="No additional notes" ar="لا توجد ملاحظات إضافية" /></p>}
        <div style={{ marginTop: 14 }}>
          <Link className="sp-btn" href="/rent-car" target="_blank" rel="noreferrer"><ExternalLink size={15} /> <AdminText en="View rent-car page" ar="عرض صفحة تأجير السيارات" /></Link>
        </div>
      </Card>
    </div>

    <Card title={<AdminText en="Activity" ar="النشاط" />} sub={<AdminText en="Fixture seed plus local demo events" ar="بذرة تجريبية بالإضافة إلى أحداث تجريبية محلية" />}>
      <ol className="sp-timeline">
        {request.activity.map((entry) => (
          <li key={entry.id} className={entry.fixture ? 'is-fixture' : entry.kind === 'confirmed' || entry.kind === 'cancelled' ? 'is-key' : ''}>
            <span className="sp-timeline-dot" aria-hidden="true" />
            <div>
              <strong><ActivityLabels activity={entry} /></strong>
              {entry.note && entry.kind !== 'assigned-vehicle-changed' && entry.kind !== 'cancelled' && (
                <small dir="auto">{entry.note}</small>
              )}
              {entry.kind === 'cancelled' && entry.note && (
                <small dir="auto">{cancelReasonText(entry.note as CancelReasonId, ar)}{entry.detail ? ` — ${entry.detail}` : ''}</small>
              )}
              <span className="sp-timeline-meta">
                {entry.fixture
                  ? <AdminText en={`Demo fixture · ${formatActivityTime(entry.at, true, ar)}`} ar={`بيانات تجريبية · ${formatActivityTime(entry.at, true, ar)}`} />
                  : <AdminText en={`Local demo · ${formatActivityTime(entry.at, false, ar)}`} ar={`تجريبي محلي · ${formatActivityTime(entry.at, false, ar)}`} />}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </Card>

    <StartReviewDialog requestRef={request.ref} open={dialog === 'start-review'} onClose={() => setDialog(null)} />
    <ConfirmRequestDialog
      requestRef={request.ref}
      summary={{
        customer: request.customerName,
        assignedVehicle: assignedCar ? `${assignedCar.title} · ${assignedCar.slug}` : request.assignedVehicleSlug,
        tripType: request.tripType,
        pickup: request.pickup,
        dropoff: request.dropoff,
        pickupDate: request.preferredPickupDate,
        returnDate: request.preferredReturnDate,
        passengers: request.passengers,
      }}
      open={dialog === 'confirm'}
      onClose={() => setDialog(null)}
    />
    <CancelRequestDialog requestRef={request.ref} customerName={request.customerName} open={dialog === 'cancel'} onClose={() => setDialog(null)} />
    <ReopenRequestDialog requestRef={request.ref} open={dialog === 'reopen'} onClose={() => setDialog(null)} />
    <AdminConfirmDialog
      open={dialog === 'reset'}
      onClose={() => setDialog(null)}
      onConfirm={() => { commitStore(resetRequestOps(opsStore, request.ref)); setDialog(null) }}
      title={<AdminText en={`Reset demo state for ${request.ref}?`} ar={`إعادة تعيين الحالة التجريبية لـ ${request.ref}؟`} />}
      description={<AdminText en="Clears local status, assignment, notes, and activity for this request." ar="يمسح الحالة المحلية والتخصيص والملاحظات والنشاط لهذا الطلب." />}
      confirmLabel={<AdminText en="Reset demo state" ar="إعادة تعيين" />}
      demoNote={<AdminText en="Demo fixture rows are never modified — only the local overlay is cleared." ar="صفوف البيانات التجريبية لا تتعدل أبدًا — يُمسح الغطاء المحلي فقط." />}
    />
  </>
}
