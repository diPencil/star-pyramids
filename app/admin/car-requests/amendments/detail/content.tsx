'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { AdminEmpty, AdminTableWrap, AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { readCarPreview } from '@/lib/car-request'
import { useLiveCollection } from '@/lib/admin-store'
import { cars } from '@/data/content'
import {
  AMENDABLE_FIELD_COPY,
  AMENDMENT_STATUS_COPY,
  amendmentFieldValue,
  decideAmendment,
  useAmendments,
  type AmendableField,
  type AmendmentStatus,
  type CarRequestAmendment,
} from '@/lib/car-request-amendments'

/**
 * Staff review of a customer change request (browser-local demo).
 *
 * Cross-role bridge, documented honestly: amendments and the original SP-*
 * preview are readable here ONLY because admin and customer share this
 * browser's storage in the prototype. The backend will supply real mapping.
 * Decisions write ONLY the amendments key — never customer previews,
 * fixtures, or ops. Approval takes effect through the isolated customer
 * adapter (`getCustomerEffectiveCarRequest`).
 */

const PILL_CLASS: Record<AmendmentStatus, string> = {
  draft: 'is-draft',
  pending: 'is-pending',
  approved: 'is-confirmed',
  rejected: 'is-cancelled',
}

function AmendmentPill({ status }: { status: AmendmentStatus }) {
  const copy = AMENDMENT_STATUS_COPY[status]
  return <span className={`sp-pill ${PILL_CLASS[status]}`}><AdminText en={copy.en} ar={copy.ar} /></span>
}

function vehicleTitleOf(liveCars: { slug: string; title: string }[], slug: string): string {
  return liveCars.find((car) => car.slug === slug)?.title ?? slug
}

function fieldText(field: AmendableField, value: string, vehicleTitle: (slug: string) => string): string {
  if (field === 'vehicle') return vehicleTitle(value)
  return value
}

export function AmendmentReviewContent({ amendmentRef }: { amendmentRef: string }) {
  const ar = useAdminLocale() === 'ar'
  const ref = decodeURIComponent(amendmentRef).toUpperCase()
  const amendments = useAmendments()
  const liveCars = useLiveCollection('cars', cars, { includeHidden: true })
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState('')

  const titleOf = (slug: string) => vehicleTitleOf(liveCars, slug)
  const amendment: CarRequestAmendment | null = amendments.find((entry) => entry.amendmentRef === ref) ?? null
  const stored = typeof window === 'undefined' ? null : readCarPreview()
  const original = stored && amendment && stored.localRef === amendment.requestRef ? stored.draft : null

  if (!amendment) {
    return <>
      <PageHead eyebrow="Rentals" title="Change request" titleAr="طلب تعديل" actions={<Link className="sp-btn" href="/admin/car-requests"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>} />
      <AdminEmpty title={<AdminText en="Change request not found" ar="طلب التعديل غير موجود" />} copy={<AdminText en="This demo amendment reference does not exist in this browser." ar="هذا المرجع التجريبي غير موجود في هذا المتصفح." />} />
    </>
  }

  const doApprove = () => {
    if (!('error' in decideAmendment(amendment.amendmentRef, { action: 'approve' }))) setDialog(null)
  }

  const doReject = () => {
    if (!reason.trim()) return
    if (!('error' in decideAmendment(amendment.amendmentRef, { action: 'reject', reason: reason.trim() }))) {
      setReason('')
      setDialog(null)
    }
  }

  const closeReject = () => {
    setReason('')
    setDialog(null)
  }

  return <>
    <PageHead
      eyebrow="Rentals"
      title={amendment.amendmentRef}
      sub={`${amendment.requestRef} · ${amendment.changedFields.length} changes`}
      actions={<>
        <Link className="sp-btn" href="/admin/car-requests"><ArrowLeft size={16} /> <AdminText en="Back" ar="رجوع" /></Link>
        {amendment.status === 'pending' && <>
          <button type="button" className="sp-btn primary" onClick={() => setDialog('approve')}><CheckCircle2 size={16} /> <AdminText en="Approve changes" ar="الموافقة على التعديلات" /></button>
          <button type="button" className="sp-btn dark" onClick={() => setDialog('reject')}><XCircle size={16} /> <AdminText en="Reject changes" ar="رفض التعديلات" /></button>
        </>}
      </>}
    />

    <div className="sp-grid-dash">
      <Card title={<AdminText en="Amendment overview" ar="نظرة عامة على التعديل" />} sub={<AdminText en="Local demo — same-browser customer proposal" ar="تجريبي محلي — مقترح عميل على نفس المتصفح" />}>
        <div className="sp-detail-grid">
          <div><small><AdminText en="Amendment ref" ar="مرجع التعديل" /></small><strong dir="ltr">{amendment.amendmentRef}</strong></div>
          <div><small><AdminText en="Original request" ar="الطلب الأصلي" /></small><strong dir="ltr">{amendment.requestRef}</strong></div>
          <div><small><AdminText en="Status" ar="الحالة" /></small><span><AmendmentPill status={amendment.status} /></span></div>
          <div><small><AdminText en="Changed fields" ar="الحقول المتغيرة" /></small><strong>{amendment.changedFields.length}</strong></div>
        </div>
        {amendment.note !== '' && (
          <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.7 }}><strong><AdminText en="Customer reason: " ar="سبب العميل: " /></strong><span dir="auto">{amendment.note}</span></p>
        )}
        {(amendment.status === 'approved' || amendment.status === 'rejected') && amendment.decisionReason && (
          <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.7 }}><strong><AdminText en="Decision reason: " ar="سبب القرار: " /></strong><span dir="auto">{amendment.decisionReason}</span></p>
        )}
        <p style={{ margin: 0, color: 'var(--sp-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
          <AdminText
            en="Approval only flips local demo state. The customer view recomputes through an isolated adapter; nothing is sent anywhere."
            ar="الموافقة تغيّر الحالة التجريبية المحلية فقط. يُعاد حساب عرض العميل عبر محوّل معزول، ولا يُرسل أي شيء إلى أي مكان."
          />
        </p>
      </Card>

      <Card title={<AdminText en="History" ar="السجل" />} sub={<AdminText en="Local customer/staff demo events" ar="أحداث تجريبية محلية للعميل/الموظف" />}>
        <ol className="sp-timeline">
          {amendment.history.map((entry) => (
            <li key={entry.id} className={entry.kind === 'approved' || entry.kind === 'rejected' ? 'is-key' : ''}>
              <span className="sp-timeline-dot" aria-hidden="true" />
              <div>
                <strong>
                  {entry.kind === 'created' && <AdminText en="Draft created" ar="أُنشئت المسودة" />}
                  {entry.kind === 'submitted' && <AdminText en="Submitted for review" ar="أُرسلت للمراجعة" />}
                  {entry.kind === 'approved' && <AdminText en="Approved" ar="تمت الموافقة" />}
                  {entry.kind === 'rejected' && <AdminText en="Rejected" ar="مرفوض" />}
                  {entry.kind === 'discarded' && <AdminText en="Discarded" ar="تم التجاهل" />}
                  {' · '}
                  {entry.by === 'customer'
                    ? <AdminText en="Customer (local)" ar="العميل (محلي)" />
                    : <AdminText en="Staff (demo)" ar="الموظف (تجريبي)" />}
                </strong>
                {entry.note && <small dir="auto">{entry.note}</small>}
                <span className="sp-timeline-meta"><AdminText en={`Local demo · ${entry.at}`} ar={`تجريبي محلي · ${entry.at}`} /></span>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>

    <Card
      title={<AdminText en="Current vs proposed" ar="الحالي مقابل المقترح" />}
      sub={original
        ? <AdminText en="Compared against the same-browser original preview" ar="مقارنة مع المعاينة الأصلية على نفس المتصفح" />
        : <AdminText en="Original preview absent in this browser — proposed values only" ar="المعاينة الأصلية غائبة عن هذا المتصفح — القيم المقترحة فقط" />}
    >
      <AdminTableWrap><table className="sp-table">
        <thead><tr><th><AdminText en="Field" ar="الحقل" /></th><th><AdminText en="Current" ar="الحالي" /></th><th><AdminText en="Requested change" ar="التعديل المطلوب" /></th></tr></thead>
        <tbody>
          {amendment.changedFields.map((field) => (
            <tr key={field}>
              <td><AdminText en={AMENDABLE_FIELD_COPY[field].en} ar={AMENDABLE_FIELD_COPY[field].ar} /></td>
              <td>{original ? <span dir="auto">{fieldText(field, amendmentFieldValue(field, original), titleOf)}</span> : <span style={{ color: 'var(--sp-muted)' }}>—</span>}</td>
              <td><strong dir="auto">{fieldText(field, amendmentFieldValue(field, amendment.proposed), titleOf)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table></AdminTableWrap>
    </Card>

    <AdminConfirmDialog
      open={dialog === 'approve'}
      onClose={() => setDialog(null)}
      onConfirm={doApprove}
      title={<AdminText en={`Approve ${amendment.amendmentRef}?`} ar={`الموافقة على ${amendment.amendmentRef}؟`} />}
      description={<AdminText en="The customer view will show the proposed values. The original stays stored untouched." ar="سيعرض العميل القيم المقترحة. يبقى الأصل مخزنًا دون مساس." />}
      confirmLabel={<AdminText en="Approve changes" ar="الموافقة على التعديلات" />}
      demoNote={<AdminText en="Demo workflow state only. No rental is created and nobody is notified." ar="حالة سير عمل تجريبية فقط. لا يُنشأ إيجار ولا يُشعر أحد." />}
    />
    <AdminConfirmDialog
      open={dialog === 'reject'}
      onClose={closeReject}
      onConfirm={doReject}
      canConfirm={reason.trim() !== ''}
      tone="danger"
      title={<AdminText en={`Reject ${amendment.amendmentRef}?`} ar={`رفض ${amendment.amendmentRef}؟`} />}
      description={<AdminText en="A rejection reason is required and stays visible in history." ar="سبب الرفض مطلوب ويبقى ظاهرًا في السجل." />}
      confirmLabel={<AdminText en="Reject changes" ar="رفض التعديلات" />}
      demoNote={<AdminText en="Demo workflow state only. The original request is unchanged." ar="حالة سير عمل تجريبية فقط. الطلب الأصلي لا يتغير." />}
    >
      <div className="sp-form" style={{ marginTop: 4 }}>
        <label><AdminText en="Rejection reason" ar="سبب الرفض" />
          <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={ar ? 'اشرح سبب الرفض...' : 'Explain the rejection...'} />
        </label>
      </div>
    </AdminConfirmDialog>
  </>
}
