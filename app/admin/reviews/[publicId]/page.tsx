'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, CircleAlert, Star } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Avatar, Card, StatusPill } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'

type ReviewDetail = {
  publicId: string
  tourSlug: string
  title: string | null
  rating: number
  text: string
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED'
  createdAt: string
  publishedAt: string | null
  updatedAt: string
  user: {
    publicId: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

export default function ReviewDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const ar = useAdminLocale() === 'ar'
  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState<{ action: 'publish' | 'reject' | 'pend' } | null>(null)

  useEffect(() => {
    let cancelled = false
    params.then(({ publicId }) => {
      fetch(`/api/admin/reviews/${encodeURIComponent(publicId)}`, { credentials: 'same-origin' })
        .then(async (res) => {
          const data = (await res.json()) as { review?: ReviewDetail; error?: string }
          if (!res.ok) throw new Error(data.error || 'Could not load review.')
          if (!cancelled && data.review) setReview(data.review)
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load review.')
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    })
    return () => { cancelled = true }
  }, [params])

  const userName = review ? [review.user.firstName, review.user.lastName].filter(Boolean).join(' ') || review.user.email : ''

  const moderate = (action: 'publish' | 'reject' | 'pend') => {
    if (!review) return
    fetch(`/api/admin/reviews/${encodeURIComponent(review.publicId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { review?: ReviewDetail; error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not update the review.')
        if (data.review) setReview(data.review)
        setError('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not update the review.')
      })
  }

  const confirmLabels: Record<'publish' | 'reject' | 'pend', { en: string; ar: string }> = {
    publish: { en: 'Publish this review?', ar: 'نشر هذا التقييم؟' },
    reject: { en: 'Reject this review?', ar: 'رفض هذا التقييم؟' },
    pend: { en: 'Return to pending?', ar: 'إعادة إلى قيد المراجعة؟' },
  }

  if (loading) {
    return <><PageHead eyebrow="Reputation" title="Review" titleAr="التقييم" sub="Loading…" subAr="جارٍ التحميل…" /></>
  }

  if (error && !review) {
    return (
      <>
        <PageHead eyebrow="Reputation" title="Review" titleAr="التقييم" sub="Not found" subAr="غير موجود" />
        <Card title={<AdminText en="Could not load review" ar="تعذر تحميل التقييم" />} children={<p>{error}</p>} />
      </>
    )
  }

  if (!review) return null

  const canPublish = review.status === 'PENDING' || review.status === 'REJECTED'
  const canReject = review.status === 'PENDING' || review.status === 'PUBLISHED'
  const canPend = review.status === 'PUBLISHED' || review.status === 'REJECTED'

  return (
    <>
      <PageHead
        eyebrow="Reputation"
        title="Review"
        titleAr="التقييم"
        sub={`Tour: ${review.tourSlug}`}
        subAr={`الرحلة: ${review.tourSlug}`}
        actions={
          <>
            <Link className="sp-btn" href="/admin/reviews"><ArrowLeft size={16} /><AdminText en="Back to reviews" ar="العودة للتقييمات" /></Link>
          </>
        }
      />
      <div className="sp-grid-dash">
        <Card title={<AdminText en="Review content" ar="محتوى التقييم" />}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <Avatar name={userName} src="" size={48} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{userName}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>{review.user.email}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                Submitted: {new Date(review.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>{review.tourSlug}</strong>
            <Link href={`/egypt-tours/${review.tourSlug}`} target="_blank" rel="noopener noreferrer" className="text-link" style={{ marginLeft: 12 }}>
              <AdminText en="View tour page" ar="عرض صفحة الرحلة" /> <ArrowRight size={14} />
            </Link>
          </div>
          {review.title && <p style={{ fontWeight: 600, marginBottom: 12 }}>"{review.title}"</p>}
          <div style={{ marginBottom: 16 }}>
            <span className="rev-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg key={n} width="20" height="20" viewBox="0 0 24 24" fill={n <= review.rating ? '#ffc531' : 'none'} stroke="#ffc531" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </span>
            <div><StatusPill status={review.status.toLowerCase()} /></div>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{review.text}</p>
        </Card>

        <Card title={<AdminText en="Moderation" ar="الإشراف" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StatusPill status={review.status.toLowerCase()} />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {review.status === 'PUBLISHED' && review.publishedAt
                  ? `${ar ? 'نشرت في' : 'Published'}: ${new Date(review.publishedAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}`
                  : review.status === 'PENDING'
                    ? ar ? 'قيد المراجعة' : 'Awaiting moderation'
                    : ar ? 'مرفوضة' : 'Rejected'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canPublish && (
                <button
                  className="sp-btn primary"
                  onClick={() => moderate('publish')}
                  disabled={confirmOpen !== null}
                >
                  <CheckCircle2 size={16} /> <AdminText en="Publish" ar="نشر" />
                </button>
              )}
              {canReject && (
                <button
                  className="sp-btn"
                  onClick={() => moderate('reject')}
                  disabled={confirmOpen !== null}
                >
                  <XCircle size={16} /> <AdminText en="Reject" ar="رفض" />
                </button>
              )}
              {canPend && (
                <button
                  className="sp-btn"
                  onClick={() => moderate('pend')}
                  disabled={confirmOpen !== null}
                >
                  <CircleAlert size={16} /> <AdminText en="Return to pending" ar="إعادة للمراجعة" />
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
      {confirmOpen && (
        <AdminConfirmDialog
          open={true}
          onClose={() => setConfirmOpen(null)}
          onConfirm={() => { moderate(confirmOpen.action); setConfirmOpen(null); }}
          title={confirmLabels[confirmOpen.action][ar ? 'ar' : 'en']}
          confirmLabel={<AdminText en="Confirm" ar="تأكيد" />}
          cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
          tone={confirmOpen.action === 'reject' ? 'danger' : 'primary'}
        />
      )}
    </>
  )
}