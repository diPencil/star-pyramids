'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CarFront, Check, Clock3, Eye, FlaskConical, History, Pencil, Trash2, X } from 'lucide-react'
import { useLocale } from '@/components/locale'
import { cars } from '@/data/content'
import type { Car } from '@/data/types'
import { useLiveCollection } from '@/lib/admin-store'
import {
  hasCarErrors,
  readCarPreview,
  validateCarRequest,
  type CarRequestDraft,
  type CarRequestPreview,
} from '@/lib/car-request'
import {
  AMENDABLE_FIELD_COPY,
  AMENDMENT_STATUS_COPY,
  amendmentFieldValue,
  diffCarDrafts,
  discardAmendmentDraft,
  findAmendment,
  pendingAmendmentFor,
  saveAmendment,
  submitAmendment,
  useAmendments,
  type AmendableField,
  type AmendmentActor,
  type AmendmentStatus,
  type CarRequestAmendment,
} from '@/lib/car-request-amendments'

/**
 * Customer change-request workflow UI (Phase E.5). Self-contained: imports
 * only libs, data, locale, and icons — never admin fixtures or ops — so the
 * account portal can consume it without import cycles.
 *
 * Model recap: the original SP-* preview is immutable. This UI edits a
 * PROPOSED draft, reviews the before/after diff, then stores an amendment
 * (draft → pending → approved/rejected) under its own key. Approval never
 * rewrites the original; `getCustomerEffectiveCarRequest` computes the view.
 */

export function AmendmentStatusChip({ status }: { status: AmendmentStatus }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  return <span className="customer-status local"><Clock3 size={13} />{ar ? AMENDMENT_STATUS_COPY[status].ar : AMENDMENT_STATUS_COPY[status].en}</span>
}

/** Subtle list indicator when an original request carries draft/pending work. */
export function RequestAmendmentBadge({ requestRef }: { requestRef: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const amendments = useAmendments()
  const pending = amendments.some((entry) => entry.requestRef === requestRef && entry.status === 'pending')
  const draft = !pending && amendments.some((entry) => entry.requestRef === requestRef && entry.status === 'draft')
  if (!pending && !draft) return null
  return (
    <span className="customer-status local" style={{ marginInlineStart: 8 }}>
      <History size={13} />
      {pending ? (ar ? 'تم طلب تعديل' : 'Change requested') : (ar ? 'مسودة تعديل' : 'Draft change')}
    </span>
  )
}

function ChangedSummary({ amendment, ar }: { amendment: CarRequestAmendment; ar: boolean }) {
  const labels = amendment.changedFields.map((field) => (ar ? AMENDABLE_FIELD_COPY[field].ar : AMENDABLE_FIELD_COPY[field].en))
  return <>{labels.join(' · ')}</>
}

function ChangeEmpty({ title, copy, href, action }: { title: string; copy: string; href: string; action: string }) {
  return <div className="customer-empty"><span><CarFront size={24} /></span><h3>{title}</h3><p>{copy}</p><Link href={href}>{action} <ArrowRight size={15} /></Link></div>
}

function ChangeConfirmDialog({ open, title, copy, confirmLabel, onConfirm, onClose }: {
  open: boolean
  title: string
  copy: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const panelRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<Element | null>(null)
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement
    confirmRef.current?.focus()
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
        )
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="language-backdrop" role="presentation" onMouseDown={onClose}>
      <div ref={panelRef} className="language-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="language-modal-head">
          <h2>{title}</h2>
          <button type="button" className="language-close" onClick={onClose} aria-label={ar ? 'إغلاق الحوار' : 'Close dialog'}><X size={18} /></button>
        </div>
        <p style={{ margin: '12px 0 0', color: '#667085', fontSize: 13, lineHeight: 1.7 }}>{copy}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 18 }}>
          <button type="button" className="account-icon-action" onClick={onClose}>{ar ? 'تراجع' : 'Keep it'}</button>
          <button ref={confirmRef} type="button" className="account-icon-action danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function vehicleTitleOf(liveCars: { slug: string; title: string }[], slug: string): string {
  return liveCars.find((car) => car.slug === slug)?.title ?? slug
}

function diffDisplayValue(field: AmendableField, draft: CarRequestDraft, vehicleTitle: (slug: string) => string, ar: boolean): string {
  if (field === 'vehicle') return vehicleTitle(draft.vehicleSlug)
  if (field === 'tripType') {
    if (draft.tripType === 'One Way') return ar ? 'ذهاب فقط' : 'One Way'
    if (draft.tripType === 'Round Trip') return ar ? 'ذهاب وعودة' : 'Round Trip'
    return ar ? 'لم يحدد' : 'Not set'
  }
  if (field === 'passengers') return ar && draft.passengers === 1 ? 'مسافر واحد' : ar && draft.passengers === 2 ? 'مسافران' : ar ? `${draft.passengers} مسافرين` : draft.passengers === 1 ? '1 passenger' : `${draft.passengers} passengers`
  return amendmentFieldValue(field, draft)
}

function DiffRows({ original, proposed, ar, vehicleTitle }: {
  original: CarRequestDraft
  proposed: CarRequestDraft
  ar: boolean
  vehicleTitle: (slug: string) => string
}) {
  const changed = diffCarDrafts(original, proposed)
  if (!changed.length) return null
  return (
    <div className="customer-detail-grid">
      {changed.map((field) => (
        <div key={field}>
          <small>{ar ? AMENDABLE_FIELD_COPY[field].ar : AMENDABLE_FIELD_COPY[field].en}</small>
          <strong>
            <span style={{ color: '#667085', textDecoration: 'line-through' }} dir="auto">{diffDisplayValue(field, original, vehicleTitle, ar)}</span>
            {' → '}
            <span dir="auto">{diffDisplayValue(field, proposed, vehicleTitle, ar)}</span>
          </strong>
        </div>
      ))}
    </div>
  )
}

type FormValues = {
  vehicleSlug: string
  tripType: CarRequestDraft['tripType']
  pickup: string
  dropoff: string
  pickupDate: string
  returnDate: string
  passengers: string
  fullName: string
  email: string
  phone: string
  notes: string
}

function valuesFromDraft(draft: CarRequestDraft): FormValues {
  return {
    vehicleSlug: draft.vehicleSlug,
    tripType: draft.tripType,
    pickup: draft.pickup,
    dropoff: draft.dropoff,
    pickupDate: draft.preferredPickupDate,
    returnDate: draft.preferredReturnDate,
    passengers: String(draft.passengers),
    fullName: draft.contact.fullName,
    email: draft.contact.email,
    phone: draft.contact.phone,
    notes: draft.notes,
  }
}

function valuesToDraft(values: FormValues, currency: CarRequestDraft['currency']): CarRequestDraft {
  const pax = values.passengers.trim()
  return {
    vehicleSlug: values.vehicleSlug,
    tripType: values.tripType,
    pickup: values.pickup.trim(),
    dropoff: values.dropoff.trim(),
    preferredPickupDate: values.pickupDate,
    preferredReturnDate: values.tripType === 'Round Trip' ? values.returnDate : '',
    passengers: pax === '' ? Number.NaN : Number(pax),
    notes: values.notes.trim(),
    contact: { fullName: values.fullName.trim(), email: values.email.trim(), phone: values.phone.trim() },
    currency,
  }
}

/** "Request changes" form + review. Original storage is only ever READ here. */
export function CarChangeContent({ requestRef, amendmentRef }: { requestRef: string; amendmentRef?: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const router = useRouter()
  const liveCars = useLiveCollection('cars', cars)

  // Browser storage is read in effects only, never during render: the server
  // has no localStorage, so render-time reads produce different HTML on the
  // server vs the client and break hydration. State starts empty (matching
  // SSR) and fills in after mount.
  const [original, setOriginal] = useState<CarRequestPreview | null>(null)
  const [existingAmendment, setExistingAmendment] = useState<CarRequestAmendment | null>(null)
  const [pending, setPending] = useState<CarRequestAmendment | null>(null)

  const [values, setValues] = useState<FormValues | null>(null)
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    const stored = readCarPreview()
    const found = stored && stored.localRef === requestRef ? stored : null
    setOriginal(found)
    const amend = amendmentRef ? findAmendment(amendmentRef) : null
    setExistingAmendment(amend)
    setPending(pendingAmendmentFor(requestRef))
    const draft = found?.draft ?? null
    if (!draft) return
    if (amendmentRef) {
      if (amend && amend.status === 'draft' && amend.requestRef === requestRef) {
        setValues(valuesFromDraft(amend.proposed))
        setNote(amend.note)
      }
      return
    }
    setValues(valuesFromDraft(draft))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestRef, amendmentRef])

  const originalDraft = original && original.localRef === requestRef ? original.draft : null

  if (!originalDraft) {
    return <ChangeEmpty title={ar ? 'طلب السيارة غير موجود' : 'Car request not found'} copy={ar ? 'ربما تم تجاهله أو أنه محفوظ في متصفح مختلف.' : 'It may have been discarded or saved in a different browser.'} href="/account/car-requests" action={ar ? 'عودة لطلبات السيارات' : 'Back to car requests'} />
  }
  if (amendmentRef && (!existingAmendment || existingAmendment.status !== 'draft' || existingAmendment.requestRef !== requestRef)) {
    return <ChangeEmpty title={ar ? 'مسودة التعديل غير موجودة' : 'Change draft not found'} copy={ar ? 'ربما تم إرسالها للمراجعة أو تجاهلها.' : 'It may have been submitted for review or discarded.'} href="/account/car-requests" action={ar ? 'عودة لطلبات السيارات' : 'Back to car requests'} />
  }
  if (!amendmentRef && pending) {
    return (
      <section className="customer-account-block">
        <header><div><span>{ar ? 'تعديل معلق' : 'Pending change'}</span><h2>{ar ? 'لديك تعديل قيد المراجعة' : 'You have a change under review'}</h2></div></header>
        <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.7 }}>{ar ? 'لا يمكنك بدء تعديل جديد حتى يتم البت في التعديل المعلق (تجريبيًا).' : 'You cannot start another change until the pending one is decided (demo).'}</p>
        <div className="customer-detail-actions">
          <Link href={`/account/car-requests/change/detail?ref=${encodeURIComponent(pending.amendmentRef)}`} className="account-icon-action primary"><Eye size={16} />{ar ? 'عرض التعديل المعلق' : 'View pending change'}</Link>
          <Link href={`/account/car-requests/detail?ref=${encodeURIComponent(requestRef)}`} className="account-icon-action">{ar ? 'عودة للطلب الأصلي' : 'Back to original request'}</Link>
        </div>
      </section>
    )
  }
  if (!values) return null

  const patch = (p: Partial<FormValues>) => {
    setValues((current) => (current ? { ...current, ...p } : current))
    setError('')
  }
  const proposed = valuesToDraft(values, originalDraft.currency)
  const changed = diffCarDrafts(originalDraft, proposed)

  const startReview = () => {
    const errs = validateCarRequest(proposed)
    if (!liveCars.some((car) => car.slug === values.vehicleSlug)) {
      setError(ar ? 'السيارة المطلوبة أصلًا لم تعد في الأسطول. اختر سيارة متاحة.' : 'The originally requested vehicle is no longer in the fleet. Choose an available vehicle.')
      setStep('edit')
      return
    }
    if (hasCarErrors(errs)) {
      setError(ar ? 'راجع الحقول الموضحة: تحقق من السيارة والتواريخ والركاب وبيانات التواصل.' : 'Review the highlighted fields: check the vehicle, dates, passengers, and contact details.')
      setStep('edit')
      return
    }
    if (!changed.length) {
      setError(ar ? 'لم تقترح أي تغيير بعد. عدّل حقلًا واحدًا على الأقل.' : 'No changes proposed yet. Change at least one field.')
      setStep('edit')
      return
    }
    setError('')
    setStep('review')
  }

  const persist = (status: 'draft' | 'pending') => {
    const result = saveAmendment({
      requestRef,
      proposed: { ...proposed, notes: proposed.notes.slice(0, 1000) },
      changedFields: changed,
      note,
      status,
      amendmentRef: existingAmendment?.amendmentRef,
    })
    if ('error' in result) {
      setError(ar ? 'تعذر حفظ التعديل. حاول مرة أخرى.' : 'Could not save the change request. Try again.')
      return
    }
    router.push(`/account/car-requests/change/detail?ref=${encodeURIComponent(result.amendment.amendmentRef)}`)
  }

  const titleOf = (slug: string) => vehicleTitleOf(liveCars, slug)
  // If the originally requested vehicle left the fleet, keep it selectable so
  // the form stays valid-viewable, but block submit until a fleet vehicle wins.
  const vehicleKnown = liveCars.some((car) => car.slug === values.vehicleSlug)
  const vehicleOptions: Car[] = vehicleKnown
    ? [...liveCars]
    : [{ slug: values.vehicleSlug, title: values.vehicleSlug, image: '', seats: '', transmission: '', dailyPrice: 0, copy: '' }, ...liveCars]

  return <>
    <section className="customer-account-block">
      <header><div><span>{ar ? 'الطلب الأصلي' : 'Original request'}</span><h2>{ar ? 'اطلب تعديلًا' : 'Request changes'}</h2></div><span className="customer-status local"><Clock3 size={13} />{ar ? 'معاينة محلية' : 'Local preview'}</span></header>
      <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.7 }}>{ar ? 'الأصل لا يتغير. أنت تقترح تعديلًا تتم مراجعته أولًا.' : 'The original stays unchanged. You are proposing a change for review first.'}</p>
      <p className="car-request-notice" role="note"><FlaskConical size={15} /><span dir="ltr">{requestRef}</span><span>{ar ? ' · التعديل يُحفظ في هذا المتصفح فقط.' : ' · Changes are saved in this browser only.'}</span></p>
    </section>

    {step === 'edit' ? (
      <section className="customer-account-block">
        <header><div><span>{ar ? 'التعديلات المقترحة' : 'Proposed changes'}</span><h2>{ar ? 'عدّل القيم' : 'Edit values'}</h2></div></header>
        <div className="sp-form">
          <div className="customer-form-grid" style={{ display: 'grid', gap: 12 }}>
            <label>{ar ? 'السيارة المفضلة' : 'Preferred vehicle'}
              <select value={values.vehicleSlug} onChange={(event) => patch({ vehicleSlug: event.target.value })} dir="ltr">
                {vehicleOptions.map((car) => <option key={car.slug} value={car.slug}>{car.title}</option>)}
              </select>
            </label>
            <label>{ar ? 'نوع الرحلة' : 'Trip type'}
              <select value={values.tripType} onChange={(event) => patch({ tripType: event.target.value as FormValues['tripType'] })}>
                <option value="One Way">{ar ? 'ذهاب فقط' : 'One Way'}</option>
                <option value="Round Trip">{ar ? 'ذهاب وعودة' : 'Round Trip'}</option>
              </select>
            </label>
            <label>{ar ? 'نقطة الانطلاق' : 'Pickup'}<input value={values.pickup} onChange={(event) => patch({ pickup: event.target.value })} /></label>
            <label>{ar ? 'الوجهة' : 'Drop-off'}<input value={values.dropoff} onChange={(event) => patch({ dropoff: event.target.value })} /></label>
            <label>{ar ? 'تاريخ الانطلاق' : 'Pick-up date'}<input type="date" dir="ltr" value={values.pickupDate} onChange={(event) => patch({ pickupDate: event.target.value })} /></label>
            {values.tripType === 'Round Trip' && <label>{ar ? 'تاريخ العودة' : 'Return date'}<input type="date" dir="ltr" value={values.returnDate} onChange={(event) => patch({ returnDate: event.target.value })} /></label>}
            <label>{ar ? 'المسافرون' : 'Passengers'}<input type="number" min={1} max={50} dir="ltr" value={values.passengers} onChange={(event) => patch({ passengers: event.target.value })} /></label>
            <label>{ar ? 'الاسم الكامل' : 'Full name'}<input value={values.fullName} onChange={(event) => patch({ fullName: event.target.value })} /></label>
            <label>{ar ? 'البريد الإلكتروني' : 'Email'}<input type="email" dir="ltr" value={values.email} onChange={(event) => patch({ email: event.target.value })} /></label>
            <label>{ar ? 'رقم الهاتف' : 'Phone'}<input type="tel" dir="ltr" value={values.phone} onChange={(event) => patch({ phone: event.target.value })} /></label>
            <label>{ar ? 'ملاحظات إضافية' : 'Additional notes'}<textarea rows={2} value={values.notes} maxLength={1000} onChange={(event) => patch({ notes: event.target.value })} /></label>
            <label>{ar ? 'سبب التعديل (اختياري)' : 'Reason for change (optional)'}<textarea rows={2} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder={ar ? 'اشرح باختصار سبب طلب التعديل...' : 'Briefly explain why you request this change...'} /></label>
          </div>
        </div>
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
        <div className="customer-detail-actions">
          <button type="button" className="account-icon-action primary" onClick={startReview}>{ar ? 'مراجعة التعديلات' : 'Review changes'} <ArrowRight size={15} /></button>
          <button type="button" className="account-icon-action" onClick={() => router.push('/account/car-requests')}><X size={16} />{ar ? 'إلغاء' : 'Cancel'}</button>
        </div>
      </section>
    ) : (
      <section className="customer-account-block">
        <header><div><span>{ar ? 'المراجعة' : 'Review'}</span><h2>{ar ? 'راجع التعديلات المطلوبة' : 'Review requested changes'}</h2></div></header>
        <DiffRows original={originalDraft} proposed={proposed} ar={ar} vehicleTitle={titleOf} />
        {note.trim() !== '' && <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.7 }}><strong>{ar ? 'سبب التعديل: ' : 'Reason: '}</strong><span dir="auto">{note.trim()}</span></p>}
        <p className="car-request-notice" role="note" style={{ marginTop: 12 }}><FlaskConical size={15} /><span>{ar ? 'معاينة تعديل تجريبية. لن يُرسل شيء إلى STAR PYRAMIDS.' : 'Demo change preview. Nothing will be sent to STAR PYRAMIDS.'}</span></p>
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
        <div className="customer-detail-actions">
          <button type="button" className="account-icon-action" onClick={() => setStep('edit')}>{ar ? 'عودة للتعديل' : 'Back to editing'}</button>
          <button type="button" className="account-icon-action" onClick={() => persist('draft')}>{ar ? 'حفظ مسودة' : 'Save draft'}</button>
          <button type="button" className="account-icon-action primary" onClick={() => persist('pending')}><Check size={15} />{ar ? 'حفظ معاينة التعديل' : 'Save change preview'}</button>
        </div>
      </section>
    )}
  </>
}

function historyLabel(kind: string, by: AmendmentActor, ar: boolean): string {
  const who = by === 'customer' ? (ar ? 'العميل (محلي)' : 'Customer (local)') : (ar ? 'الموظف (تجريبي)' : 'Staff (demo)')
  const what = kind === 'created' ? (ar ? 'أُنشئت المسودة' : 'Draft created')
    : kind === 'submitted' ? (ar ? 'أُرسلت للمراجعة' : 'Submitted for review')
    : kind === 'approved' ? (ar ? 'تمت الموافقة' : 'Approved')
    : kind === 'rejected' ? (ar ? 'مرفوض' : 'Rejected')
    : (ar ? 'تم التجاهل' : 'Discarded')
  return `${what} · ${who}`
}

/** Customer amendment detail: diff, note, history, and per-status actions. */
export function CarAmendmentDetailContent({ amendmentRef }: { amendmentRef: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const router = useRouter()
  const amendments = useAmendments()
  const liveCars = useLiveCollection('cars', cars)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const amendment = amendments.find((entry) => entry.amendmentRef === amendmentRef) ?? null
  // Same hydration rule as above: read browser storage in an effect so the
  // first client render matches SSR, then fill in the diff source.
  const [original, setOriginal] = useState<CarRequestPreview | null>(null)
  useEffect(() => {
    const key = amendment?.requestRef
    const stored = key ? readCarPreview() : null
    setOriginal(stored && key && stored.localRef === key ? stored : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amendment])
  if (!amendment) {
    return <ChangeEmpty title={ar ? 'طلب التعديل غير موجود' : 'Change request not found'} copy={ar ? 'ربما تم تجاهله أو أنه محفوظ في متصفح مختلف.' : 'It may have been discarded or saved in a different browser.'} href="/account/car-requests" action={ar ? 'عودة لطلبات السيارات' : 'Back to car requests'} />
  }

  const originalDraft = original && amendment && original.localRef === amendment.requestRef ? original.draft : null
  const titleOf = (slug: string) => vehicleTitleOf(liveCars, slug)

  const doSubmit = () => {
    setSubmitting(true)
    const result = submitAmendment(amendment.amendmentRef)
    setSubmitting(false)
    if ('error' in result) return
  }

  const doDiscard = () => {
    const result = discardAmendmentDraft(amendment.amendmentRef)
    setDiscardOpen(false)
    if (!('error' in result)) router.push('/account/car-requests')
  }

  return <>
    <section className="customer-account-block">
      <header><div><span>{ar ? 'طلب تعديل' : 'Change request'}</span><h2><span dir="ltr">{amendment.amendmentRef}</span></h2></div><AmendmentStatusChip status={amendment.status} /></header>
      <p className="car-request-notice" role="note"><FlaskConical size={15} /><span>{ar ? 'طلب التعديل محفوظ في هذا المتصفح فقط ولم يتم إرساله إلى STAR PYRAMIDS.' : 'This change request is saved in this browser only and has not been sent to STAR PYRAMIDS.'}</span></p>
      <div className="customer-detail-grid">
        <div><small>{ar ? 'الطلب الأصلي' : 'Original request'}</small><strong dir="ltr">{amendment.requestRef}</strong></div>
        <div><small>{ar ? 'الحالة' : 'Status'}</small><strong>{ar ? AMENDMENT_STATUS_COPY[amendment.status].ar : AMENDMENT_STATUS_COPY[amendment.status].en}</strong></div>
      </div>
      {amendment.status === 'pending' && (
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.7 }}>{ar ? 'بانتظار المراجعة (تجريبيًا). لا يمكن بدء تعديل آخر حتى يتم البت فيه.' : 'Waiting for review (demo). You cannot start another change until it is decided.'}</p>
      )}
      {(amendment.status === 'approved' || amendment.status === 'rejected') && amendment.decisionReason && (
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.7 }}><strong>{ar ? 'سبب القرار: ' : 'Decision reason: '}</strong><span dir="auto">{amendment.decisionReason}</span></p>
      )}
      {amendment.status === 'approved' && !amendment.decisionReason && (
        <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.7 }}>{ar ? 'تمت الموافقة على التعديلات وهي مطبقة على العرض الحالي للطلب.' : 'The changes were approved and now apply to the current request view.'}</p>
      )}
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'المقارنة' : 'Comparison'}</span><h2>{ar ? 'الحالي مقابل المطلوب' : 'Current vs requested'}</h2></div></header>
      {originalDraft
        ? <DiffRows original={originalDraft} proposed={amendment.proposed} ar={ar} vehicleTitle={titleOf} />
        : <p style={{ margin: 0, color: '#667085', fontSize: 12 }}>{ar ? 'الطلب الأصلي غير موجود في هذا المتصفح؛ تُعرض القيم المقترحة فقط.' : 'The original request is not in this browser; only proposed values are shown.'}</p>}
      {amendment.note !== '' && <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.7 }}><strong>{ar ? 'سبب التعديل: ' : 'Reason: '}</strong><span dir="auto">{amendment.note}</span></p>}
      {amendment.status === 'draft' && (
        <div className="customer-detail-actions">
          <Link href={`/account/car-requests/change?ref=${encodeURIComponent(amendment.requestRef)}&amendment=${encodeURIComponent(amendment.amendmentRef)}`} className="account-icon-action"><Pencil size={16} />{ar ? 'متابعة التعديل' : 'Continue editing'}</Link>
          <button type="button" className="account-icon-action primary" disabled={submitting} onClick={doSubmit}><Check size={15} />{ar ? 'إرسال للمراجعة' : 'Submit for review'}</button>
          <button type="button" className="account-icon-action danger" onClick={() => setDiscardOpen(true)}><Trash2 size={16} />{ar ? 'تجاهل المسودة' : 'Discard draft'}</button>
        </div>
      )}
    </section>

    <section className="customer-account-block">
      <header><div><span>{ar ? 'السجل' : 'History'}</span><h2>{ar ? 'سجل التعديل' : 'Change history'}</h2></div></header>
      <ol className="customer-timeline">
        {amendment.history.map((entry) => (
          <li key={entry.id} className="done"><span /><div><strong>{historyLabel(entry.kind, entry.by, ar)}</strong><small dir="ltr">{entry.at}</small>{entry.note && <small dir="auto">{entry.note}</small>}</div></li>
        ))}
      </ol>
      <div className="customer-detail-actions">
        <Link href={`/account/car-requests/detail?ref=${encodeURIComponent(amendment.requestRef)}`} className="account-icon-action">{ar ? 'عودة للطلب الأصلي' : 'Back to original request'}</Link>
      </div>
    </section>
    <ChangeConfirmDialog open={discardOpen} onClose={() => setDiscardOpen(false)} onConfirm={doDiscard} title={ar ? 'تجاهل مسودة التعديل؟' : 'Discard change draft?'} copy={ar ? 'سيؤدي هذا إلى إزالة مسودة التعديل فقط. الطلب الأصلي لن يتأثر.' : 'This removes only the change draft. The original request is untouched.'} confirmLabel={ar ? 'تجاهل المسودة' : 'Discard draft'} />
  </>
}

/** "Change requests" section embedded in the original request detail. */
export function RequestAmendmentsSection({ requestRef }: { requestRef: string }) {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const amendments = useAmendments()
  const list = amendments.filter((entry) => entry.requestRef === requestRef)
  return (
    <section className="customer-account-block">
      <header><div><span>{ar ? 'التعديلات' : 'Amendments'}</span><h2>{ar ? 'طلبات التعديل' : 'Change requests'}</h2></div><History size={20} /></header>
      {list.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map((entry) => (
            <div key={entry.amendmentRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', border: '1px solid #e7ebf2', borderRadius: 7, fontSize: 13 }}>
              <span>
                <strong dir="ltr">{entry.amendmentRef}</strong>
                <br />
                <small style={{ color: '#667085' }}><ChangedSummary amendment={entry} ar={ar} /></small>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <AmendmentStatusChip status={entry.status} />
                <Link className="account-icon-action" href={`/account/car-requests/change/detail?ref=${encodeURIComponent(entry.amendmentRef)}`}><Eye size={16} />{ar ? 'عرض' : 'View'}</Link>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#667085', fontSize: 12 }}>{ar ? 'لا توجد طلبات تعديل لهذا الطلب.' : 'No change requests for this request.'}</p>
      )}
    </section>
  )
}
