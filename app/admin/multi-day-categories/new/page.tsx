'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { ImageField } from '@/components/admin/image-field'
import { getMultiDayToursForCategory, getToursByCategory, multiDayCategories } from '@/data/tours'
import { useDbCategories, invalidateCatalogueCache, dbSlugify } from '@/lib/catalogue-client'
import { useDbTours } from '@/lib/tours-client'

const multiBase = getToursByCategory('multi-days-tours')

export default function CategoryEditorPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [editSlug, setEditSlug] = useState('')
  const liveCategories = useDbCategories(multiDayCategories)
  const liveTours = useDbTours(multiBase)
  // Stable record identity: the init effect below re-runs only when the
  // edited record itself (not list identities) changes.
  const editing = useMemo(
    () => (editSlug ? liveCategories.find((c) => c.slug === editSlug) : undefined),
    [liveCategories, editSlug],
  )

  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [slug, setSlug] = useState('')
  const [copy, setCopy] = useState('')
  const [copyAr, setCopyAr] = useState('')
  const [image, setImage] = useState('')
  const [published, setPublished] = useState(true)
  const [order, setOrder] = useState('99')
  const [linkedSlugs, setLinkedSlugs] = useState<string[]>([])
  const [initialSlugs, setInitialSlugs] = useState<string[]>([])
  const [tourQuery, setTourQuery] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditSlug(new URLSearchParams(window.location.search).get('slug') ?? '')
  }, [])

  useEffect(() => {
    if (editSlug && liveCategories.length && !editing) { setReady(true); return }
    if (editing) {
      setName(editing.name)
      setNameAr(editing.nameAr)
      setSlug(editing.slug)
      setCopy(editing.copy)
      setCopyAr(editing.copyAr)
      setImage(editing.image)
      setPublished(editing.active)
      setOrder(String(editing.order))
      const linked = getMultiDayToursForCategory(liveTours, editing.slug).map((t) => t.slug)
      setLinkedSlugs(linked)
      setInitialSlugs(linked)
    } else if (!editSlug) {
      setOrder(String(Math.max(0, ...liveCategories.map((c) => c.order)) + 1))
    }
    setReady(true)
  }, [editSlug, editing, liveTours])

  const availableTours = useMemo(() => {
    const q = tourQuery.trim().toLowerCase()
    return liveTours.filter((t) => !linkedSlugs.includes(t.slug) && (!q || `${t.title} ${t.location} ${t.duration}`.toLowerCase().includes(q)))
  }, [liveTours, linkedSlugs, tourQuery])

  const linkedTours = useMemo(
    () => linkedSlugs.map((s) => liveTours.find((t) => t.slug === s)).filter((t): t is (typeof liveTours)[number] => Boolean(t)),
    [linkedSlugs, liveTours],
  )

  const save = async () => {
    setError('')
    if (!name.trim() || !nameAr.trim()) { setError(ar ? 'اكتب اسم الفئة بالإنجليزية والعربية.' : 'Enter the category name in English and Arabic.'); return }
    const finalSlug = editSlug || dbSlugify(slug.trim() ? `${slug}` : name)
    if (!/^[a-z0-9-]{1,80}$/.test(finalSlug)) { setError(ar ? 'الرابط غير صالح. استخدم حروفا إنجليزية صغيرة وأرقاما وشرطات.' : 'Invalid slug. Use lowercase letters, numbers, and hyphens.'); return }
    const parsedOrder = Number(order)
    const body = {
      slug: finalSlug,
      name: name.trim(),
      nameAr: nameAr.trim(),
      copy: copy.trim() || name.trim(),
      copyAr: copyAr.trim() || nameAr.trim(),
      image: image.trim(),
      order: Number.isFinite(parsedOrder) ? parsedOrder : 999,
      active: published,
    }
    // Category record is DB-authoritative (POST for new, PUT for edit).
    if (saving) return
    setSaving(true)
    try {
      const url = editSlug
        ? `/api/multi-day-categories/${encodeURIComponent(editSlug)}`
        : '/api/multi-day-categories'
      const res = await fetch(url, {
        method: editSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to save category.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category.')
      setSaving(false)
      return
    }
    // Tour assignments stay DB-authoritative alongside the record.
    try {
      const failures: string[] = []
      const putSlugs = async (tourSlug: string, categorySlugs: string[]) => {
        try {
          const res = await fetch(`/api/tours/${encodeURIComponent(tourSlug)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categorySlugs }),
            credentials: 'same-origin',
          })
          if (!res.ok) failures.push(tourSlug)
        } catch {
          failures.push(tourSlug)
        }
      }
      for (const tourSlug of linkedSlugs) {
        const base = liveTours.find((t) => t.slug === tourSlug)
        if (!base || base.category !== 'multi-days-tours') continue
        await putSlugs(tourSlug, Array.from(new Set([...(base.categorySlugs ?? []), finalSlug])))
      }
      for (const tourSlug of initialSlugs.filter((s) => !linkedSlugs.includes(s))) {
        const base = liveTours.find((t) => t.slug === tourSlug)
        if (!base) continue
        await putSlugs(tourSlug, (base.categorySlugs ?? []).filter((s) => s !== finalSlug))
      }
      if (failures.length) {
        setError(ar ? `تعذر حفظ ارتباط الرحلات في قاعدة البيانات: ${failures.join(', ')}` : `Could not save tour links to the database: ${failures.join(', ')}`)
        return
      }
      invalidateCatalogueCache()
      router.push('/admin/multi-day-categories')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHead eyebrow="Catalogue" title={editSlug ? 'Edit category' : 'New category'} titleAr={editSlug ? 'تعديل الفئة' : 'فئة جديدة'} sub={ar ? 'تظهر في صفحة رحلات متعددة الأيام وصفحتها عند النشر' : 'Visible on the Multi Days landing and its category page when published'} backHref="/admin/multi-day-categories" actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saving}><AdminText en="Save category" ar="حفظ الفئة" /></button>} />
    {!ready ? <Card title={<AdminText en="Loading" ar="جار التحميل" />}><p style={{ color: 'var(--sp-muted)' }}><AdminText en="Loading category..." ar="جار تحميل الفئة..." /></p></Card> : editSlug && !editing ? (
      <Card title={<AdminText en="Category not found" ar="الفئة غير موجودة" />}><p style={{ color: 'var(--sp-muted)' }}><AdminText en="The requested category does not exist." ar="الفئة المطلوبة غير موجودة." /></p></Card>
    ) : <>
      <Card title={<AdminText en="Basic information" ar="البيانات الأساسية" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label><AdminText en="Name (EN)" ar="الاسم (EN)" /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Honeymoon" /></label>
            <label><AdminText en="Name (AR)" ar="الاسم (AR)" /><input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="شهر العسل" /></label>
          </div>
          <label><AdminText en="Slug" ar="الرابط" /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="honeymoon" dir="ltr" readOnly={Boolean(editSlug)} /></label>
        </div>
      </Card>
      <Card title={<AdminText en="Content" ar="المحتوى" />}>
        <div className="sp-form">
          <label><AdminText en="Short description (EN)" ar="وصف قصير (EN)" /><textarea rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
          <label><AdminText en="Short description (AR)" ar="وصف قصير (AR)" /><textarea rows={3} value={copyAr} onChange={(e) => setCopyAr(e.target.value)} /></label>
        </div>
      </Card>
      <Card title={<AdminText en="Media" ar="الوسائط" />} sub={<AdminText en="Cover image" ar="صورة الغلاف" />}>
        <ImageField value={image} onChange={setImage} />
      </Card>
      <Card title={<AdminText en="Publishing" ar="النشر" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /><span><AdminText en="Published" ar="منشور" /><small><AdminText en="Hidden categories disappear from the website" ar="الفئات المخفية تختفي من الموقع" /></small></span></label>
            <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} dir="ltr" /></label>
          </div>
        </div>
      </Card>
      <Card title={<AdminText en="Linked multi day tours" ar="الرحلات متعددة الأيام المرتبطة" />} sub={<AdminText en="These tours appear on the public category page" ar="هذه الرحلات تظهر في صفحة الفئة العامة" />}>
        <div className="sp-form">
          {linkedTours.length ? <div className="sp-repeat-list">{linkedTours.map((tour) => <article className="sp-repeat-card" key={tour.slug}>
            <header><span>{tour.image ? <img src={tour.image} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} /> : '•'}</span><strong>{tour.title}</strong><button type="button" className="sp-icon-btn danger" onClick={() => setLinkedSlugs((current) => current.filter((s) => s !== tour.slug))} aria-label={ar ? `إزالة ${tour.title}` : `Remove ${tour.title}`} title={ar ? 'إزالة' : 'Remove'}><Trash2 size={16} /></button></header>
            <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{tour.slug} · {tour.duration}</small>
          </article>)}</div> : <p className="sp-builder-note"><AdminText en="No tours linked yet. Link tours below; the category stays off the public landing until it has tours." ar="لا توجد رحلات مرتبطة بعد. اربط الرحلات أدناه؛ تبقى الفئة خارج صفحة الهبوط العامة حتى يكون لها رحلات." /></p>}
          <label><AdminText en="Add tour" ar="إضافة رحلة" />
            <input value={tourQuery} onChange={(e) => setTourQuery(e.target.value)} placeholder={ar ? 'ابحث في الرحلات...' : 'Search tours...'} />
          </label>
          {tourQuery.trim() && (availableTours.length ? <div className="sp-repeat-list">{availableTours.slice(0, 6).map((tour) => <article className="sp-repeat-card" key={tour.slug}>
            <header><span><Plus size={15} /></span><strong>{tour.title}</strong><button type="button" onClick={() => { setLinkedSlugs((current) => [...current, tour.slug]); setTourQuery('') }} aria-label={ar ? `إضافة ${tour.title}` : `Add ${tour.title}`} title={ar ? 'إضافة' : 'Add'}><Plus size={16} /></button></header>
            <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{tour.slug} · {tour.duration}</small>
          </article>)}</div> : <p style={{ color: 'var(--sp-muted)' }}><AdminText en="No matching tours." ar="لا توجد رحلات مطابقة." /></p>)}
        </div>
      </Card>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}><AdminText en="Save category" ar="حفظ الفئة" /></button>
        {editSlug && <Link className="sp-btn" href={`/egypt-tours/multi-days-tours/${editSlug}`}><ExternalLink size={16} /> <AdminText en="View public category" ar="عرض الفئة العامة" /></Link>}
      </div>
    </>}
  </>
}
