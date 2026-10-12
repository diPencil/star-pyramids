'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarDays, FileText, MapPin, StickyNote, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { useAdminCurrency } from '@/components/admin/admin-currency'
import { useCurrentUser } from '@/lib/use-current-user'
import { SharedSelect } from '@/components/shared-select'
import { bookingActivityLabel, bookingPaymentStatusLabel, bookingStatusLabel, canTransitionBooking, type BookingStatus, type StaffBooking } from '@/lib/booking'
import { documentTypeLabel, formatDocumentIssuedAt, staffDocumentPdfUrl, type DocumentListItem, type VerifiedPaymentOption } from '@/lib/documents'

/** Client-safe mirror of the server refund-event option (admin list endpoint). */
type RefundEventOption = {
  id: string
  paymentReference: string
  scope: 'full' | 'partial'
  amountCents: number | null
  method: string | null
  externalReference: string | null
  createdAt: string
  tracked: boolean
}

const ACTIONS: { from: BookingStatus[]; to: BookingStatus; tone: 'primary' | 'danger' }[] = [
  { from: ['pending'], to: 'confirmed', tone: 'primary' },
  { from: ['confirmed'], to: 'completed', tone: 'primary' },
  { from: ['pending', 'confirmed'], to: 'cancelled', tone: 'danger' },
]

const actionCopy: Record<BookingStatus, { en: string; ar: string }> = {
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  confirmed: { en: 'Confirm booking', ar: 'تأكيد الحجز' },
  completed: { en: 'Mark completed', ar: 'إتمام الحجز' },
  cancelled: { en: 'Cancel booking', ar: 'إلغاء الحجز' },
}

async function apiStaffDetail(reference: string): Promise<StaffBooking> {
  const res = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}`, { credentials: 'same-origin' })
  const data = (await res.json()) as StaffBooking & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Booking not found.')
  return data
}

async function apiStaffMutate(reference: string, body: Record<string, unknown>): Promise<StaffBooking> {
  const res = await fetch(`/api/admin/bookings/${encodeURIComponent(reference)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as StaffBooking & { error?: string; code?: string }
  if (!res.ok) {
    // Preserve the machine code so financial-review blocks render a
    // localized explanation instead of raw server English.
    const err = new Error(data.error || 'Could not update the booking.')
    if (data.code) (err as { code?: string }).code = data.code
    throw err
  }
  return data
}

/** Localized explanation for a document-issuance refusal (stable server code in). */
function issueFailureMessage(code: string | undefined, serverMessage: string, ar: boolean): string {
  switch (code) {
    case 'status-mismatch':
      return ar
        ? 'تأكيد الحجز يتطلب حجزًا مؤكدًا — أكّد الحجز أولًا ثم أصدر المستند.'
        : 'Booking confirmations need a confirmed booking — confirm it first, then issue.'
    case 'payment-not-on-booking':
      return ar
        ? 'هذه الدفعة تخص حجزًا آخر — اختر دفعة من هذا الحجز.'
        : 'That payment belongs to a different booking — pick a payment from this booking.'
    case 'no-verified-money':
      return ar
        ? 'لا توجد مبالغ محصلة على هذه الدفعة بعد — سجّل الدفعة أولًا.'
        : 'That payment has no verified money yet — record the payment first.'
    case 'unknown-payment':
      return ar
        ? 'الدفعة غير موجودة — أعد التحميل واختر دفعة من القائمة.'
        : 'Payment not found — reload and pick a payment from the list.'
    case 'not-issuable-yet':
      return ar
        ? 'هذا النوع من المستندات غير متاح بعد.'
        : 'This document type is not available yet.'
    case 'voucher-not-eligible':
      return ar
        ? 'القسائم تتطلب حجزًا مؤكدًا — أكّد الحجز أولًا ثم أصدر.'
        : 'Vouchers need a confirmed booking — confirm it first, then issue.'
    case 'unknown-refund-event':
      return ar
        ? 'حدث الاسترداد غير موجود — أعد التحميل واختر حدثًا من القائمة.'
        : 'Refund event not found — reload and pick an event from the list.'
    case 'refund-not-on-booking':
      return ar
        ? 'هذا الاسترداد يخص حجزًا آخر — اختر استردادًا من هذا الحجز.'
        : 'That refund belongs to a different booking — pick a refund from this booking.'
    case 'refund-not-tracked':
      return ar
        ? 'سُجّل هذا الاسترداد قبل تتبع الاستردادات لكل حدث — لا يمكن إصدار إشعار له.'
        : 'That refund was recorded before per-refund tracking and cannot be noted.'
    case 'duplicate-refund-note':
      return ar
        ? 'سبق إصدار إشعار لهذا الاسترداد.'
        : 'A note was already issued for this refund.'
    case 'duplicate-invoice':
      return ar
        ? 'سبق إصدار فاتورة لهذا الحجز.'
        : 'An invoice was already issued for this booking.'
    case 'duplicate-voucher':
      return ar
        ? 'سبق إصدار قسيمة لهذا الحجز.'
        : 'A voucher was already issued for this booking.'
    default:
      return serverMessage
  }
}

/** Localized explanation for a financial-review cancellation block. */
function financialReviewBlockMessage(ar: boolean): string {
  return ar
    ? 'هذا الحجز مرتبط بمدفوعات محصلة أو معلقة. سوّ الاسترداد أولاً — تم حظر الإلغاء التلقائي لحماية سجل المدفوعات.'
    : 'This booking has captured or in-flight payments. Settle the refund first — automatic cancellation is blocked to protect the payment history.'
}

export function BookingDetailContent({ reference }: { reference: string }) {
  const ar = useAdminLocale() === 'ar'
  // Display-only conversion of server USD amounts, like the storefront.
  const { formatUsd } = useAdminCurrency()
  const { user } = useCurrentUser()
  const canRecordPayment = user?.permissions?.includes('payments.edit') ?? false
  const canIssueDocs = user?.permissions?.includes('bookings.edit') ?? false
  const [item, setItem] = useState<StaffBooking | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [pending, setPending] = useState<BookingStatus | null>(null)
  const [actionError, setActionError] = useState('')
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [proofError, setProofError] = useState('')
  const [recordOpen, setRecordOpen] = useState(false)
  const [recAmount, setRecAmount] = useState('')
  const [recMethod, setRecMethod] = useState('bank_transfer')
  const [recNote, setRecNote] = useState('')
  const [recKey, setRecKey] = useState('')
  const [recSaving, setRecSaving] = useState(false)
  const [docs, setDocs] = useState<DocumentListItem[] | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState('')
  const [verifiedPayments, setVerifiedPayments] = useState<VerifiedPaymentOption[]>([])
  const [refundEvents, setRefundEvents] = useState<RefundEventOption[]>([])
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueType, setIssueType] = useState('BOOKING_REQUEST')
  const [issuePayment, setIssuePayment] = useState('')
  const [issueRefundEvent, setIssueRefundEvent] = useState('')
  const [issueKey, setIssueKey] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)
  const [issueError, setIssueError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    apiStaffDetail(reference)
      .then((row) => { if (!cancelled) { setItem(row); setLoading(false) } })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Booking not found.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [reference])

  // Issued documents ride along with the stored booking but live behind
  // their own read endpoint, so the list (and the receipt dialog's
  // verified-payment options) refreshes independently of transitions.
  const loadDocs = (bookingReference: string) => {
    setDocsLoading(true)
    setDocsError('')
    fetch(`/api/admin/bookings/${encodeURIComponent(bookingReference)}/documents`, { credentials: 'same-origin' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          documents?: DocumentListItem[]
          verifiedPayments?: VerifiedPaymentOption[]
          refundEvents?: RefundEventOption[]
          error?: string
        }
        if (!res.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : 'Could not load the documents.')
        setDocs(Array.isArray(data.documents) ? data.documents : [])
        setVerifiedPayments(Array.isArray(data.verifiedPayments) ? data.verifiedPayments : [])
        setRefundEvents(Array.isArray(data.refundEvents) ? data.refundEvents : [])
      })
      .catch((error: unknown) => {
        setDocsError(error instanceof Error ? error.message : 'Could not load the documents.')
      })
      .finally(() => setDocsLoading(false))
  }

  useEffect(() => {
    if (item?.reference) loadDocs(item.reference)
  }, [item?.reference])

  if (loading) {
    return (
      <>
        <PageHead eyebrow="Orders" title="Booking" titleAr="الحجز" sub="Booking detail" subAr="تفاصيل الحجز" backHref="/admin/bookings" />
        <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading the stored booking…" ar="جارٍ تحميل الحجز المحفوظ…" /></p></Card>
      </>
    )
  }

  if (!item) {
    return (
      <>
        <PageHead eyebrow="Orders" title="Booking" titleAr="الحجز" sub="Booking detail" subAr="تفاصيل الحجز" backHref="/admin/bookings" />
        <Card title={<AdminText en="Booking not found" ar="الحجز غير موجود" />}>
          <p><AdminText en={loadError || 'This booking does not exist.'} ar={loadError || 'هذا الحجز غير موجود.'} /></p>
        </Card>
      </>
    )
  }

  const available = ACTIONS.filter((a) => a.from.includes(item.status))
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(ar ? 'ar-EG' : 'en-US')
  const guests = item.lines.reduce((sum, line) => sum + line.adults + line.children + line.infants, 0)

  const openRecord = () => {
    setRecAmount('')
    setRecMethod('bank_transfer')
    setRecNote('')
    setRecKey(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
    setActionError('')
    setRecordOpen(true)
  }

  const submitRecord = () => {
    if (!item || recSaving) return
    setActionError('')
    setRecSaving(true)
    fetch('/api/admin/payments/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        bookingReference: item.reference,
        amount: Number(recAmount),
        currency: 'USD',
        method: recMethod,
        referenceNote: recNote,
        idempotencyKey: recKey,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(typeof data.error === 'string' && data.error ? data.error : 'Could not record the payment.')
        return apiStaffDetail(item.reference)
      })
      .then((row) => {
        setItem(row)
        setRecordOpen(false)
      })
      .catch((error: unknown) => {
        setActionError(error instanceof Error ? error.message : 'Could not record the payment.')
      })
      .finally(() => setRecSaving(false))
  }

  // Explicit document issuance. The idempotency key is minted once per
  // dialog session and kept across retries, so a double-click or a
  // retry after a network error returns the original document instead
  // of minting a duplicate. The server revalidates type, booking,
  // payment and key regardless of what the browser sends.
  const openIssue = () => {
    setIssueType('BOOKING_REQUEST')
    setIssuePayment(verifiedPayments[0]?.reference ?? '')
    setIssueRefundEvent(refundEvents.find((e) => e.tracked)?.id ?? refundEvents[0]?.id ?? '')
    setIssueKey(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)
    setIssueError('')
    setIssueOpen(true)
  }

  const selectedRefundEvent = refundEvents.find((e) => e.id === issueRefundEvent) ?? null

  const submitIssue = () => {
    if (!item || issueSaving) return
    setIssueError('')
    setIssueSaving(true)
    fetch(`/api/admin/bookings/${encodeURIComponent(item.reference)}/documents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        type: issueType,
        ...(issueType === 'PAYMENT_RECEIPT' ? { paymentReference: issuePayment } : {}),
        // A refund note anchors to one completed-refund event; the event
        // itself names its payment, which the server cross-checks.
        ...(issueType === 'REFUND_NOTE' && selectedRefundEvent
          ? { paymentReference: selectedRefundEvent.paymentReference, refundEventId: selectedRefundEvent.id }
          : {}),
        idempotencyKey: issueKey,
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
        if (!res.ok) {
          const err = new Error(typeof data.error === 'string' && data.error ? data.error : 'Could not issue the document.')
          if (data.code) (err as { code?: string }).code = data.code
          throw err
        }
        loadDocs(item.reference)
        setIssueOpen(false)
      })
      .catch((error: unknown) => {
        const code = (error as { code?: unknown } | null)?.code
        setIssueError(issueFailureMessage(
          typeof code === 'string' ? code : undefined,
          error instanceof Error ? error.message : 'Could not issue the document.',
          ar,
        ))
      })
      .finally(() => setIssueSaving(false))
  }

  const runTransition = (to: BookingStatus) => {
    setActionError('')
    apiStaffMutate(item.reference, { status: to })
      .then((row) => { setItem(row); setPending(null) })
      .catch((error: unknown) => {
        const code = (error as { code?: unknown } | null)?.code
        setActionError(code === 'BOOKING_FINANCIAL_REVIEW'
          ? financialReviewBlockMessage(ar)
          : (error instanceof Error ? error.message : 'Could not update the booking.'))
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

  // Proof-review acknowledgement: marks the submission reviewed only.
  // Actual money is recorded separately with “Record payment” — this
  // action never settles anything.
  const reviewProof = (proofReference: string) => {
    if (!item || reviewing) return
    setProofError('')
    setReviewing(proofReference)
    apiStaffMutate(item.reference, { proofReference })
      .then((row) => { setItem(row); setReviewing(null) })
      .catch((error: unknown) => {
        setProofError(error instanceof Error ? error.message : 'Could not review the proof.')
        setReviewing(null)
      })
  }

  const proofs = item.paymentProofs ?? []
  const pendingProofs = proofs.filter((proof) => !proof.reviewed)
  const proofMethodLabel = (method: string | null) =>
    method === 'bank_transfer'
      ? (ar ? 'تحويل بنكي' : 'Bank transfer')
      : method === 'cash'
        ? (ar ? 'نقدي' : 'Cash')
        : (ar ? 'دفع مباشر' : 'Offline')

  return (
    <>
      <PageHead
        eyebrow="Orders"
        title={item.reference}
        titleAr={item.reference}
        sub={`${item.lines[0]?.title ?? 'Booking'} · ${guests} ${ar ? 'ضيوف' : 'guests'}`}
        subAr={`${item.lines[0]?.title ?? 'الحجز'} · ${guests} ضيوف`}
        backHref="/admin/bookings"
      />
      <div className="evr-detail-grid">
        <div className="evr-main-col">
          <Card title={<AdminText en="Booking overview" ar="نظرة عامة على الحجز" />}>
            <dl className="evr-kv">
              <div><dt><AdminText en="Reference" ar="المرجع" /></dt><dd><code dir="ltr">{item.reference}</code></dd></div>
              <div><dt><AdminText en="Status" ar="الحالة" /></dt><dd><span className={`sp-status is-${item.status}`}>{bookingStatusLabel(item.status, ar)}</span></dd></div>
              <div><dt><AdminText en="Payment" ar="الدفع" /></dt><dd>{bookingPaymentStatusLabel(item.paymentStatus, ar)}</dd></div>
              {pendingProofs.length > 0 && (
                <div><dt><AdminText en="Proof review" ar="مراجعة الإثبات" /></dt><dd><strong role="status">{pendingProofs.length} {ar ? 'بانتظار المراجعة' : 'awaiting review'}</strong></dd></div>
              )}
              {item.paymentSummary && item.paymentSummary.latestReference && (
                <div><dt><AdminText en="Payment record" ar="سجل الدفع" /></dt><dd><Link href={`/admin/payments/${encodeURIComponent(item.paymentSummary.latestReference)}`}><code dir="ltr">{item.paymentSummary.latestReference}</code></Link><small style={{ color: 'var(--sp-muted)' }}>{formatUsd(item.paymentSummary.paidTotal)} paid · {item.paymentSummary.payments} attempt{item.paymentSummary.payments === 1 ? '' : 's'}</small></dd></div>
              )}
              {item.paymentSummary && !item.paymentSummary.latestReference && (
                <div><dt><AdminText en="Payment record" ar="سجل الدفع" /></dt><dd><small style={{ color: 'var(--sp-muted)' }}>{ar ? 'لا يوجد سجل دفع - غير مدفوع' : 'No payment record - unpaid'}</small></dd></div>
              )}
              <div><dt><AdminText en="Guests" ar="الضيوف" /></dt><dd><Users size={14} />{guests}</dd></div>
              <div><dt><AdminText en="Subtotal" ar="المجموع الفرعي" /></dt><dd>{formatUsd(item.subtotal)}</dd></div>
              {item.discount > 0 && <div><dt><AdminText en="Deal savings" ar="توفير العروض" /></dt><dd>−{formatUsd(item.discount)}</dd></div>}
              <div><dt><AdminText en="Total" ar="الإجمالي" /></dt><dd><strong>{formatUsd(item.total)}</strong></dd></div>
              <div><dt><AdminText en="Submitted" ar="أُرسل" /></dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
              <div><dt><AdminText en="Last updated" ar="آخر تحديث" /></dt><dd>{fmtDateTime(item.updatedAt)}</dd></div>
              {item.account && <div><dt><AdminText en="Account" ar="الحساب" /></dt><dd>{item.account.name} <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{item.account.email}</small></dd></div>}
            </dl>
            {item.notes && <p className="evr-note"><span><AdminText en="Customer note" ar="ملاحظة العميل" /></span>{item.notes}</p>}
          </Card>
          <Card title={<AdminText en="Booked trips" ar="الرحلات المحجوزة" />}>
            {item.lines.map((line) => (
              <div key={line.key} className="evr-event">
                <Link href={`/egypt-tours/${line.tourSlug}`} className="evr-event-title">{line.title}</Link>
                <p><CalendarDays size={14} />{line.date || (ar ? 'التاريخ مفتوح' : 'Open date')}</p>
                <p><MapPin size={14} />{line.adults} {ar ? 'بالغين' : 'adults'}{line.children > 0 && ` · ${line.children} ${ar ? 'أطفال' : 'children'}`}{line.infants > 0 && ` · ${line.infants} ${ar ? 'رضع' : 'infants'}`}</p>
                <p><small dir="ltr">{formatUsd(line.adultUnit)} per adult{line.children > 0 && ` · ${formatUsd(line.childUnit)} per child`}{line.addons.length > 0 && ` · ${line.addons.join(', ')} (+${formatUsd(line.addonTotal)})`}</small></p>
                <p><strong>{formatUsd(line.total)}</strong></p>
              </div>
            ))}
          </Card>
        </div>
        <div className="evr-side-col">
          <Card title={<AdminText en="Customer" ar="العميل" />}>
            <dl className="evr-kv evr-customer">
              <div><dt><AdminText en="Name" ar="الاسم" /></dt><dd>{item.contact.name}</dd></div>
              <div><dt><AdminText en="Email" ar="البريد" /></dt><dd><a dir="ltr" href={`mailto:${item.contact.email}`}>{item.contact.email}</a></dd></div>
              <div><dt><AdminText en="Phone" ar="الهاتف" /></dt><dd><a dir="ltr" href={`tel:${item.contact.phone.replace(/\s/g, '')}`}>{item.contact.phone}</a></dd></div>
            </dl>
          </Card>
          <Card title={<AdminText en="Payment proofs" ar="إثباتات الدفع" />}>
            <div className="evr-manage">
              {proofs.length === 0 ? (
                <p className="evr-manage-hint"><AdminText en="No customer references submitted yet." ar="لا توجد مراجع مرسلة من العميل بعد." /></p>
              ) : (
                <>
                  {pendingProofs.length > 0 && (
                    <p className="evr-manage-hint" role="status">
                      <AdminText
                        en={`${pendingProofs.length} reference${pendingProofs.length === 1 ? '' : 's'} awaiting review. Verify first, then record actually received money with “Record payment” — a submission never marks anything paid.`}
                        ar={`${pendingProofs.length} ${pendingProofs.length === 1 ? 'مرجع بانتظار' : 'مراجع بانتظار'} المراجعة. تحقق أولًا ثم سجّل المبالغ المستلمة فعلًا عبر «تسجيل دفعة» — فالإرسال لا يعلّم أي مبلغ كمدفوع.`}
                      />
                    </p>
                  )}
                  {proofs.map((proof) => (
                    <div key={proof.reference} className="evr-event">
                      <span className="evr-event-title"><code dir="ltr">{proof.reference}</code></span>
                      <p>{proofMethodLabel(proof.method)} · {new Date(proof.submittedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US')} · {proof.reviewed ? (ar ? 'تمت المراجعة' : 'Reviewed') : (ar ? 'بانتظار المراجعة' : 'Awaiting review')}</p>
                      {!proof.reviewed && (
                        <p><button
                          type="button"
                          className="sp-btn"
                          disabled={reviewing !== null}
                          onClick={() => reviewProof(proof.reference)}
                        >
                          <AdminText en={reviewing === proof.reference ? 'Reviewing…' : 'Mark reviewed'} ar={reviewing === proof.reference ? 'جارٍ المراجعة…' : 'تعليم كمراجَع'} />
                        </button></p>
                      )}
                    </div>
                  ))}
                  {proofError && <p className="evr-manage-hint" role="alert">{proofError}</p>}
                </>
              )}
            </div>
          </Card>
          <Card title={<AdminText en="Booking management" ar="إدارة الحجز" />}>
            <div className="evr-manage">
              {available.length ? (
                <div className="evr-actions">
                  {available.map((a) => (
                    <button key={a.to} type="button" className={`sp-btn ${a.tone === 'danger' ? 'danger' : 'primary'}`} onClick={() => setPending(a.to)}>
                      <AdminText en={actionCopy[a.to].en} ar={actionCopy[a.to].ar} />
                    </button>
                  ))}
                  {canRecordPayment && (item.status === 'pending' || item.status === 'confirmed') && (
                    <button type="button" className="sp-btn" onClick={openRecord}>
                      <AdminText en="Record payment" ar="تسجيل دفعة" />
                    </button>
                  )}
                </div>
              ) : (
                <p className="evr-manage-hint"><AdminText en="No further transitions. Completed and cancelled bookings are terminal." ar="لا توجد انتقالات أخرى. الحجوزات المكتملة والملغاة نهائية." /></p>
              )}
              {actionError && <p className="evr-manage-hint" role="alert">{actionError}</p>}
            </div>
          </Card>
          <Card title={<AdminText en="Documents" ar="المستندات" />}>
            <div className="evr-manage">
              <p className="evr-manage-hint"><AdminText en="Issued documents with PDF download. Issuance is explicit and audited — nothing is created automatically." ar="المستندات الصادرة مع تنزيل PDF. الإصدار يدوي وموثق — لا يُنشأ شيء تلقائيًا." /></p>
              {docsLoading && <p className="evr-manage-hint"><AdminText en="Loading documents…" ar="جارٍ تحميل المستندات…" /></p>}
              {docsError && <p className="evr-manage-hint" role="alert">{docsError}</p>}
              {docs !== null && docs.length === 0 && !docsLoading && !docsError && (
                <p className="evr-manage-hint"><AdminText en="No documents issued yet." ar="لم تُصدر مستندات بعد." /></p>
              )}
              {(docs ?? []).map((doc) => (
                <div key={doc.id} className="evr-event">
                  <span className="evr-event-title"><FileText size={14} /> {documentTypeLabel(doc.type, ar ? 'ar' : 'en')} <code dir="ltr">{doc.number}</code></span>
                  <p>{formatDocumentIssuedAt(doc.issuedAt, ar ? 'ar' : 'en')} · {formatUsd(doc.amountCents / 100)}{doc.paymentReference ? (<> · <code dir="ltr">{doc.paymentReference}</code></>) : ''}</p>
                  <p><a className="sp-btn" href={staffDocumentPdfUrl(item.reference, doc.id)}><AdminText en="Download PDF" ar="تنزيل PDF" /></a></p>
                </div>
              ))}
              {canIssueDocs && (
                <div className="evr-actions">
                  <button type="button" className="sp-btn primary" onClick={openIssue}>
                    <AdminText en="Issue document" ar="إصدار مستند" />
                  </button>
                </div>
              )}
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
                  <strong>{bookingActivityLabel(a.action, ar)}{a.internal ? (ar ? ' · داخلية' : ' · Internal') : ''}</strong>
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
        onConfirm={() => { if (pending && canTransitionBooking(item.status, pending)) runTransition(pending) }}
        title={<AdminText en={pending ? `Move to ${actionCopy[pending].en}?` : 'Confirm'} ar={pending ? `نقل إلى ${actionCopy[pending].ar}؟` : 'تأكيد'} />}
        description={<AdminText en={`Updates the stored record ${item.reference}.`} ar={`يحدّث السجل المحفوظ ${item.reference}.`} />}
        confirmLabel={<AdminText en="Confirm" ar="تأكيد" />}
        cancelLabel={<AdminText en="Keep" ar="تراجع" />}
        tone={pending === 'cancelled' ? 'danger' : 'primary'}
      />
      <AdminConfirmDialog
        open={recordOpen}
        onClose={() => { if (!recSaving) setRecordOpen(false) }}
        onConfirm={submitRecord}
        title={<AdminText en="Record offline payment" ar="تسجيل دفعة نقدية" />}
        description={<AdminText
          en={`Remaining balance ${formatUsd(Math.max(0, item.total - (item.paymentSummary?.paidTotal ?? 0)))} · stored in USD, no conversion applied.`}
          ar={`الرصيد المتبقي ${formatUsd(Math.max(0, item.total - (item.paymentSummary?.paidTotal ?? 0)))} · يُحفظ بالدولار دون تحويل.`}
        />}
        confirmLabel={<AdminText en={recSaving ? 'Recording…' : 'Record as paid'} ar={recSaving ? 'جارٍ التسجيل…' : 'تسجيل كمدفوع'} />}
        cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
        tone="primary"
        canConfirm={!recSaving && Number(recAmount) > 0}
      >
        <div className="sp-form">
          <label><AdminText en="Received amount (USD)" ar="المبلغ المستلم (دولار)" /><input
            type="number" min="0" step="0.01" dir="ltr" value={recAmount}
            onChange={(e) => setRecAmount(e.target.value)} placeholder="0.00"
          /></label>
          <label><AdminText en="Method" ar="الطريقة" /><SharedSelect
            value={recMethod} onChange={setRecMethod} locale={ar ? 'ar' : 'en'}
            label={ar ? 'طريقة الدفع' : 'Payment method'}
            options={[
              { value: 'bank_transfer', label: ar ? 'تحويل بنكي' : 'Bank transfer' },
              { value: 'cash', label: ar ? 'نقدي' : 'Cash' },
            ]}
          /></label>
          <label><AdminText en="Bank / receipt reference (optional)" ar="مرجع البنك / الإيصال (اختياري)" /><input
            type="text" dir="ltr" value={recNote} maxLength={255}
            onChange={(e) => setRecNote(e.target.value)} placeholder="REF-…"
          /></label>
        </div>
      </AdminConfirmDialog>
      <AdminConfirmDialog
        open={issueOpen}
        onClose={() => { if (!issueSaving) setIssueOpen(false) }}
        onConfirm={submitIssue}
        title={<AdminText en="Issue document" ar="إصدار مستند" />}
        description={<AdminText
          en={`Creates an official document for ${item.reference} with a frozen financial snapshot. Audited; safe to retry — the same request never issues twice.`}
          ar={`ينشئ مستندًا رسميًا لـ ${item.reference} مع لقطة مالية ثابتة. موثق وآمن لإعادة المحاولة — نفس الطلب لا يُصدر مرتين.`}
        />}
        confirmLabel={<AdminText en={issueSaving ? 'Issuing…' : 'Issue document'} ar={issueSaving ? 'جارٍ الإصدار…' : 'إصدار المستند'} />}
        cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
        tone="primary"
        canConfirm={!issueSaving
          && (issueType !== 'PAYMENT_RECEIPT' || (verifiedPayments.length > 0 && issuePayment !== ''))
          && (issueType !== 'REFUND_NOTE' || (selectedRefundEvent !== null && selectedRefundEvent.tracked))}
      >
        <div className="sp-form">
          <label><AdminText en="Document type" ar="نوع المستند" /><SharedSelect
            value={issueType} onChange={setIssueType} locale={ar ? 'ar' : 'en'}
            label={ar ? 'نوع المستند' : 'Document type'}
            options={[
              { value: 'BOOKING_REQUEST', label: documentTypeLabel('BOOKING_REQUEST', ar ? 'ar' : 'en') },
              { value: 'BOOKING_CONFIRMATION', label: documentTypeLabel('BOOKING_CONFIRMATION', ar ? 'ar' : 'en') },
              { value: 'PAYMENT_RECEIPT', label: documentTypeLabel('PAYMENT_RECEIPT', ar ? 'ar' : 'en') },
              { value: 'INVOICE', label: documentTypeLabel('INVOICE', ar ? 'ar' : 'en') },
              { value: 'BOOKING_VOUCHER', label: documentTypeLabel('BOOKING_VOUCHER', ar ? 'ar' : 'en') },
              { value: 'REFUND_NOTE', label: documentTypeLabel('REFUND_NOTE', ar ? 'ar' : 'en') },
            ]}
          /></label>
          {issueType === 'PAYMENT_RECEIPT' && (verifiedPayments.length > 0 ? (
            <label><AdminText en="Payment to receipt" ar="الدفعة المراد توثيقها" /><SharedSelect
              value={issuePayment} onChange={setIssuePayment} locale={ar ? 'ar' : 'en'}
              label={ar ? 'الدفعة المراد توثيقها' : 'Payment to receipt'}
              options={verifiedPayments.map((p) => ({
                value: p.reference,
                label: `${p.reference} — ${formatUsd(p.amountPaidCents / 100)}${p.paidAt ? ` · ${formatDocumentIssuedAt(p.paidAt, ar ? 'ar' : 'en')}` : ''}`,
              }))}
            /></label>
          ) : (
            <p className="evr-manage-hint" role="status"><AdminText en="No verified payments on this booking yet — record a payment first." ar="لا توجد مدفوعات محصلة على هذا الحجز بعد — سجّل دفعة أولًا." /></p>
          ))}
          {issueType === 'BOOKING_CONFIRMATION' && item.status !== 'confirmed' && item.status !== 'completed' && (
            <p className="evr-manage-hint" role="status"><AdminText en="Confirmations need a confirmed booking — confirm it first, then issue." ar="التأكيد يتطلب حجزًا مؤكدًا — أكّد الحجز أولًا ثم أصدر." /></p>
          )}
          {issueType === 'INVOICE' && (
            <p className="evr-manage-hint" role="status"><AdminText en="Commercial invoice for the frozen booking total. May be issued before any payment; the balance updates as money is recorded. One invoice per booking." ar="فاتورة تجارية بإجمالي الحجز الثابت. يمكن إصدارها قبل أي دفعة؛ ويتحدث الرصيد مع تسجيل المدفوعات. فاتورة واحدة لكل حجز." /></p>
          )}
          {issueType === 'BOOKING_VOUCHER' && (item.status === 'confirmed' || item.status === 'completed' ? (
            <p className="evr-manage-hint" role="status"><AdminText en="Premium travel voucher with a verification QR. Carries no prices and never proves payment. One voucher per booking." ar="قسيمة سفر مميزة برمز تحقق. لا تحمل أسعارًا ولا تثبت الدفع أبدًا. قسيمة واحدة لكل حجز." /></p>
          ) : (
            <p className="evr-manage-hint" role="status"><AdminText en="Vouchers need a confirmed booking — confirm it first, then issue." ar="القسائم تتطلب حجزًا مؤكدًا — أكّد الحجز أولًا ثم أصدر." /></p>
          ))}
          {issueType === 'REFUND_NOTE' && (refundEvents.length > 0 ? (
            <>
              <label><AdminText en="Completed refund to note" ar="الاسترداد المكتمل المراد توثيقه" /><SharedSelect
                value={issueRefundEvent} onChange={setIssueRefundEvent} locale={ar ? 'ar' : 'en'}
                label={ar ? 'الاسترداد المكتمل المراد توثيقه' : 'Completed refund to note'}
                options={refundEvents.map((e) => ({
                  value: e.id,
                  label: e.tracked
                    ? `${e.paymentReference} — ${formatUsd((e.amountCents ?? 0) / 100)} · ${e.scope === 'full' ? (ar ? 'كامل' : 'full') : (ar ? 'جزئي' : 'partial')} · ${formatDocumentIssuedAt(e.createdAt, ar ? 'ar' : 'en')}`
                    : `${e.paymentReference} — ${ar ? 'غير مؤهل (سُجّل قبل التتبع)' : 'not eligible (recorded before tracking)'} · ${formatDocumentIssuedAt(e.createdAt, ar ? 'ar' : 'en')}`,
                }))}
              /></label>
              {selectedRefundEvent && !selectedRefundEvent.tracked && (
                <p className="evr-manage-hint" role="status"><AdminText en="That refund was recorded before per-refund tracking and cannot be noted." ar="سُجّل هذا الاسترداد قبل تتبع الاستردادات لكل حدث — لا يمكن إصدار إشعار له." /></p>
              )}
            </>
          ) : (
            <p className="evr-manage-hint" role="status"><AdminText en="No completed refunds on this booking yet — record a refund first." ar="لا توجد استردادات مكتملة على هذا الحجز بعد — سجّل استردادًا أولًا." /></p>
          ))}
          {issueError && <p className="evr-manage-hint" role="alert">{issueError}</p>}
        </div>
      </AdminConfirmDialog>
    </>
  )
}
