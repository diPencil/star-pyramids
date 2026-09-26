'use client'

import { useState } from 'react'
import { AdminConfirmDialog } from './admin-confirm-dialog'
import { AdminText } from './admin-ui'
import { useAdminLocale } from './admin-locale'
import { commitTransition, OPS_TEXT_MAX, type CancelReasonId } from '@/lib/car-request-ops'

/**
 * Guarded request-transition dialogs. List quick actions and the detail action
 * bar render these — never their own transition logic. Every confirm path
 * funnels through `commitTransition`, so guards live in exactly one place.
 */

const DEMO_STATE_NOTE = (
  <AdminText
    en="Demo workflow state only. Nothing is reserved, no availability is confirmed, no rental is created, no customer is notified, and nothing is sent to a server."
    ar="حالة سير عمل تجريبية فقط. لا يتم حجز أي مركبة، ولا تأكيد التوافر، ولا إنشاء إيجار، ولا إشعار العميل، ولا إرسال أي شيء إلى خادم."
  />
)

const CANCEL_REASON_COPY: { id: CancelReasonId; en: string; ar: string }[] = [
  { id: 'withdrawn', en: 'Customer withdrew request', ar: 'سحب العميل للطلب' },
  { id: 'dates-changed', en: 'Dates changed', ar: 'تغيرت التواريخ' },
  { id: 'vehicle-unavailable-demo', en: 'Vehicle unavailable (demo reason only)', ar: 'المركبة غير متاحة (سبب تجريبي فقط)' },
  { id: 'duplicate', en: 'Duplicate request', ar: 'طلب مكرر' },
  { id: 'other', en: 'Other (describe below)', ar: 'أخرى (اشرح أدناه)' },
]

export function cancelReasonText(id: CancelReasonId, ar: boolean): string {
  return (ar ? CANCEL_REASON_COPY.find((entry) => entry.id === id)?.ar : CANCEL_REASON_COPY.find((entry) => entry.id === id)?.en) ?? id
}

export function StartReviewDialog({ requestRef, open, onClose }: { requestRef: string | null; open: boolean; onClose: () => void }) {
  if (!requestRef) return null
  const ref = requestRef
  const confirm = () => {
    if (commitTransition(ref, 'start-review')) onClose()
  }
  return (
    <AdminConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title={<AdminText en={`Start review of ${ref}?`} ar={`بدء مراجعة ${ref}؟`} />}
      description={<AdminText en="Moves the request from New to Reviewing." ar="ينقل الطلب من جديدة إلى قيد المراجعة." />}
      confirmLabel={<AdminText en="Start review" ar="بدء المراجعة" />}
      demoNote={DEMO_STATE_NOTE}
    />
  )
}

export type ConfirmRequestSummary = {
  customer: string
  assignedVehicle: string
  tripType: string
  pickup: string
  dropoff: string
  pickupDate: string
  returnDate: string
  passengers: number
}

export function ConfirmRequestDialog({ requestRef, summary, open, onClose }: { requestRef: string | null; summary: ConfirmRequestSummary | null; open: boolean; onClose: () => void }) {
  if (!requestRef) return null
  const ref = requestRef
  const confirm = () => {
    if (commitTransition(ref, 'confirm')) onClose()
  }
  return (
    <AdminConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title={<AdminText en={`Confirm ${ref}?`} ar={`تأكيد ${ref}؟`} />}
      description={<AdminText en="Review the demo request before confirming." ar="راجع الطلب التجريبي قبل التأكيد." />}
      confirmLabel={<AdminText en="Confirm request" ar="تأكيد الطلب" />}
      demoNote={DEMO_STATE_NOTE}
    >
      {summary && (
        <div className="sp-detail-grid" style={{ marginTop: 4 }}>
          <div><small><AdminText en="Customer" ar="العميل" /></small><strong>{summary.customer}</strong></div>
          <div><small><AdminText en="Assigned vehicle" ar="المركبة المخصصة" /></small><strong>{summary.assignedVehicle}</strong></div>
          <div><small><AdminText en="Trip type" ar="نوع الرحلة" /></small><strong>{summary.tripType}</strong></div>
          <div><small><AdminText en="Passengers" ar="الركاب" /></small><strong>{summary.passengers}</strong></div>
          <div><small><AdminText en="Pickup" ar="الاستلام" /></small><strong>{summary.pickup}</strong></div>
          <div><small><AdminText en="Drop-off" ar="التسليم" /></small><strong>{summary.dropoff}</strong></div>
          <div><small><AdminText en="Preferred pickup date" ar="تاريخ الاستلام المفضل" /></small><strong dir="ltr">{summary.pickupDate}</strong></div>
          <div><small><AdminText en="Preferred return date" ar="تاريخ العودة المفضل" /></small><strong dir="ltr">{summary.tripType === 'Round Trip' && summary.returnDate ? summary.returnDate : '—'}</strong></div>
        </div>
      )}
    </AdminConfirmDialog>
  )
}

export function CancelRequestDialog({ requestRef, customerName, open, onClose }: { requestRef: string | null; customerName?: string; open: boolean; onClose: () => void }) {
  const ar = useAdminLocale() === 'ar'
  const [reasonId, setReasonId] = useState<CancelReasonId | ''>('')
  const [note, setNote] = useState('')
  if (!requestRef) return null
  const ref = requestRef
  const valid = reasonId !== '' && (reasonId !== 'other' || note.trim() !== '')
  const confirm = () => {
    if (!valid) return
    if (commitTransition(ref, 'cancel', { reasonId, reasonNote: note.trim() })) {
      setReasonId('')
      setNote('')
      onClose()
    }
  }
  const close = () => {
    setReasonId('')
    setNote('')
    onClose()
  }
  return (
    <AdminConfirmDialog
      open={open}
      onClose={close}
      onConfirm={confirm}
      canConfirm={valid}
      tone="danger"
      title={<AdminText en={`Cancel ${ref}?`} ar={`إلغاء ${ref}؟`} />}
      description={customerName
        ? <AdminText en={`${customerName} · a cancellation reason is required and will appear in the activity timeline.`} ar={`${customerName} · سبب الإلغاء مطلوب وسيظهر في سجل النشاط.`} />
        : <AdminText en="A cancellation reason is required and will appear in the activity timeline." ar="سبب الإلغاء مطلوب وسيظهر في سجل النشاط." />}
      confirmLabel={<AdminText en="Cancel request" ar="إلغاء الطلب" />}
      demoNote={DEMO_STATE_NOTE}
    >
      <div className="sp-form" style={{ marginTop: 4 }}>
        <label><AdminText en="Cancellation reason" ar="سبب الإلغاء" />
          <select value={reasonId} onChange={(event) => setReasonId(event.target.value as CancelReasonId | '')} aria-label={ar ? 'سبب الإلغاء' : 'Cancellation reason'}>
            <option value="">{ar ? 'اختر سببًا...' : 'Select a reason...'}</option>
            {CANCEL_REASON_COPY.map((entry) => <option key={entry.id} value={entry.id}>{ar ? entry.ar : entry.en}</option>)}
          </select>
        </label>
        {reasonId === 'other' && (
          <label><AdminText en="Describe the reason" ar="اشرح السبب" />
            <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={OPS_TEXT_MAX} placeholder={ar ? 'اكتب سبب الإلغاء...' : 'Describe the cancellation reason...'} />
          </label>
        )}
      </div>
    </AdminConfirmDialog>
  )
}

export function ReopenRequestDialog({ requestRef, open, onClose }: { requestRef: string | null; open: boolean; onClose: () => void }) {
  if (!requestRef) return null
  const ref = requestRef
  const confirm = () => {
    if (commitTransition(ref, 'reopen')) onClose()
  }
  return (
    <AdminConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      title={<AdminText en={`Reopen ${ref}?`} ar={`إعادة فتح ${ref}؟`} />}
      description={<AdminText en="Returns the request to Reviewing. It never goes back to New." ar="يعيد الطلب إلى قيد المراجعة، ولا يعود أبدًا إلى جديدة." />}
      confirmLabel={<AdminText en="Reopen request" ar="إعادة فتح الطلب" />}
      demoNote={DEMO_STATE_NOTE}
    />
  )
}
