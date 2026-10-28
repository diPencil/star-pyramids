'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ContentLanguageTabs, TranslatedInput, TranslatedTextarea } from '@/components/admin/content-language-tabs'
import { type CatalogueTranslations } from '@/lib/catalogue-translations'
import { useRouter } from 'next/navigation'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { toast } from '@/components/admin/admin-toaster'
import { invalidateCatalogueCache, dbSlugify } from '@/lib/catalogue-client'
import { invalidateToursCache } from '@/lib/tours-client'
import { useCurrentUser } from '@/lib/use-current-user'
import { destinationEditorRecord, validateDestinationWrite, type DestinationTourChange } from '@/lib/destination-write'
import type { Destination } from '@/data/types'
import { ImageField } from '@/components/admin/image-field'

const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean)
type AssociationTour = { slug: string; title: string; location: string; duration: string; image: string; category: string; destinationSlug: string | null; status: string }
const emptyDetail: Destination['detail'] = { heroImage: '', heroAlt: '', eyebrow: '', intro: '', facts: [], bestFor: [], experiences: [], rhythm: [], practical: [], tourSlugs: [] }

export default function DestinationEditorPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [editSlug, setEditSlug] = useState('')
  // DB-authoritative catalogue with no static fallback: a failed API read
  // renders loading/error here, never bootstrap rows as editor records.
  const { user } = useCurrentUser()
  const can = (permission: string) => Boolean(user && (user.roles.includes('SUPER_ADMIN') || user.permissions?.includes(permission)))
  const canSave = can(editSlug ? 'destinations.edit' : 'destinations.create')
  const canEditTours = can('tours.edit') && can('tours.view')
  const [catalogueLoading, setCatalogueLoading] = useState(true)
  const [catalogueError, setCatalogueError] = useState('')
  const [reload, setReload] = useState(0)
  const retryCatalogue = () => setReload(value => value + 1)
  const [liveTours, setLiveTours] = useState<AssociationTour[]>([])
  const [toursReady, setToursReady] = useState(false)
  const [tourError, setTourError] = useState('')
  // Stable record identity: the init effect below re-runs only when the
  // edited record itself (not list identities) changes.
  const [editing, setEditing] = useState<(Destination & { updatedAt: string }) | undefined>()
  const [detailDraft, setDetailDraft] = useState<Destination['detail']>(emptyDetail)
  const [uploading, setUploading] = useState(false)

  const [translations, setTranslations] = useState<CatalogueTranslations>({})
  const [title, setTitle] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [slug, setSlug] = useState('')
  const [image, setImage] = useState('')
  const [copy, setCopy] = useState('')
  const [copyAr, setCopyAr] = useState('')
  const [stay, setStay] = useState('')
  const [bestFor, setBestFor] = useState('')
  const [tourSlugs, setTourSlugs] = useState('')
  const [showInDestinations, setShowInDestinations] = useState(true)
  const [showInOneDayTours, setShowInOneDayTours] = useState(false)
  const [published, setPublished] = useState(true)
  const [order, setOrder] = useState('')
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
    let active = true
    setCatalogueLoading(true)
    setCatalogueError('')
    if (!editSlug) { setCatalogueLoading(false); return }
    void (async () => {
      try {
        const response = await fetch(`/api/destinations/${encodeURIComponent(editSlug)}?admin=1`, { credentials: 'same-origin', cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not load destination.')
        if (active) setEditing(destinationEditorRecord(body.destination))
      } catch (error) { if (active) setCatalogueError(error instanceof Error ? error.message : 'Could not load destination.') }
      finally { if (active) setCatalogueLoading(false) }
    })()
    return () => { active = false }
  }, [editSlug, reload])

  useEffect(() => {
    if (!canEditTours) return
    let active = true
    setToursReady(false)
    void (async () => {
      try {
        const response = await fetch('/api/tours?full=1&all=1', { credentials: 'same-origin', cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.tours)) throw new Error(body.error || 'Could not load tour associations.')
        const tours: AssociationTour[] = body.tours.filter((tour: AssociationTour) => tour.category === 'one-day-tours')
        if (active) {
          setLiveTours(tours)
          const linked = tours.filter(tour => tour.destinationSlug === editSlug).map(tour => tour.slug)
          setLinkedSlugs(linked); setInitialSlugs(linked); setToursReady(true); setTourError('')
        }
      } catch (error) { if (active) setTourError(error instanceof Error ? error.message : 'Could not load tour associations.') }
    })()
    return () => { active = false }
  }, [canEditTours, editSlug])

  useEffect(() => {
    if (catalogueLoading) return
    if (editing) {
      setDetailDraft(editing.detail)
      setTranslations(editing.translations ?? {})
      setTitle(editing.title)
      setNameAr(editing.nameAr ?? '')
      setSlug(editing.slug)
      setImage(editing.image)
      setCopy(editing.copy)
      setCopyAr(editing.copyAr ?? '')
      setStay(editing.detail.facts[0]?.value ?? 'Flexible')
      setBestFor(editing.detail.bestFor.join('\n'))
      setTourSlugs(editing.detail.tourSlugs.join(', '))
      setShowInDestinations(editing.showInDestinations !== false)
      setShowInOneDayTours(editing.showInOneDayTours === true)
      setPublished(editing.isPublished !== false)
      setOrder(editing.displayOrder === undefined ? '' : String(editing.displayOrder))
    }
    setReady(true)
  }, [editSlug, editing, catalogueLoading])

  const availableTours = useMemo(() => {
    const q = tourQuery.trim().toLowerCase()
    return liveTours.filter((t) => !linkedSlugs.includes(t.slug) && (!q || `${t.title} ${t.location} ${t.duration}`.toLowerCase().includes(q)))
  }, [liveTours, linkedSlugs, tourQuery])

  const linkedTours = useMemo(
    () => linkedSlugs.map((s) => liveTours.find((t) => t.slug === s)).filter((t): t is (typeof liveTours)[number] => Boolean(t)),
    [linkedSlugs, liveTours],
  )
  const saveDisabled = saving || uploading || !canSave || !ready || catalogueLoading || Boolean(catalogueError) || Boolean(editSlug && !editing)
  const updateDetailRow = (section: 'facts' | 'experiences' | 'rhythm' | 'practical', index: number, key: string, value: string) => {
    setDetailDraft(current => ({ ...current, [section]: current[section].map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  }

  const save = async () => {
    if (!canSave || saving || uploading || !ready || catalogueLoading || catalogueError || editSlug && !editing) return
    setError('')
    if (!title.trim()) { setError(ar ? 'اكتب اسم الوجهة.' : 'Enter the destination name.'); return }
    const finalSlug = editSlug || dbSlugify(slug.trim() ? slug : title)
    if (!/^[a-z0-9-]{1,80}$/.test(finalSlug)) { setError(ar ? 'الرابط غير صالح.' : 'Invalid slug.'); return }
    const parsedOrder = Number(order)
    if (order.trim() && (!Number.isInteger(parsedOrder) || parsedOrder < 0 || parsedOrder > 100000)) { setError('Display order must be a whole number from 0 to 100000.'); return }
    const tourChanges: DestinationTourChange[] = canEditTours && toursReady ? [
      ...linkedSlugs.filter(slug => !initialSlugs.includes(slug)).map(slug => ({ slug, expectedDestinationSlug: liveTours.find(tour => tour.slug === slug)?.destinationSlug ?? null, linked: true })),
      ...initialSlugs.filter(slug => !linkedSlugs.includes(slug)).map(slug => ({ slug, expectedDestinationSlug: editSlug, linked: false })),
    ] : []
    const body = {
      expectedUpdatedAt: editing?.updatedAt,
      tourChanges,
      translations,
      title: title.trim(),
      slug: finalSlug,
      image: image.trim(),
      copy: copy.trim(),
      nameAr: nameAr.trim() || null,
      copyAr: copyAr.trim() || null,
      showInOneDayTours,
      showInDestinations,
      isPublished: published,
      displayOrder: order.trim() === '' ? null : parsedOrder,
      detail: {
        ...detailDraft,
        heroImage: editing ? detailDraft.heroImage : detailDraft.heroImage || undefined,
        heroAlt: editing ? detailDraft.heroAlt : detailDraft.heroAlt || undefined,
        eyebrow: detailDraft.eyebrow,
        intro: editing ? detailDraft.intro : detailDraft.intro || undefined,
        facts: detailDraft.facts.length ? detailDraft.facts.map((fact, index) => index === 0 ? { ...fact, value: stay.trim() } : fact) : editing ? [] : [{ label: 'Suggested stay', value: stay.trim() }],
        bestFor: lines(bestFor),
        tourSlugs: tourSlugs.split(',').map((s) => s.trim()).filter(Boolean),
      },
    }
    try { validateDestinationWrite(body, !editSlug) } catch (error) { setError(error instanceof Error ? error.message : 'Check destination fields.'); return }
    // Destination record is DB-authoritative (POST for new, PUT for edit).
    if (saving) return
    setSaving(true)
    try {
      const url = editSlug
        ? `/api/destinations/${encodeURIComponent(editSlug)}`
        : '/api/destinations'
      const res = await fetch(url, {
        method: editSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to save destination.')
      }
      invalidateCatalogueCache()
      invalidateToursCache()
      toast.success(editSlug ? 'Destination saved.' : 'Destination created.', { dedupeKey: 'destination-editor-save' })
      router.push('/admin/destinations')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (ar ? 'تعذر حفظ الوجهة.' : 'Failed to save destination.'), { dedupeKey: 'destination-editor-save' })
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return <>
    <PageHead eyebrow="Catalogue" title={editSlug ? 'Edit destination' : 'New destination'} titleAr={editSlug ? 'تعديل الوجهة' : 'وجهة جديدة'} sub={ar ? 'تنشر في الوجهات والرئيسية' : 'Published to destinations and the homepage'} backHref="/admin/destinations" actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saveDisabled}><AdminText en="Save destination" ar="حفظ الوجهة" /></button>} />
    {!ready || catalogueLoading ? <Card title={<AdminText en="Loading" ar="جار التحميل" />}><p style={{ color: 'var(--sp-muted)' }}><AdminText en="Loading destination..." ar="جار تحميل الوجهة..." /></p></Card> : editSlug && catalogueError ? (
      <Card title={<AdminText en="Could not load destination" ar="تعذر تحميل الوجهة" />}><p style={{ color: 'var(--sp-muted)' }}>{catalogueError}</p><div style={{ display: 'flex', gap: 10, marginTop: 14 }}><button type="button" className="sp-btn primary" onClick={retryCatalogue}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></Card>
    ) : editSlug && !editing ? (
      <Card title={<AdminText en="Destination not found" ar="الوجهة غير موجودة" />}><p style={{ color: 'var(--sp-muted)' }}><AdminText en="The requested destination does not exist." ar="الوجهة المطلوبة غير موجودة." /></p></Card>
    ) : <><fieldset disabled={saving || !canSave} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <Card title={<AdminText en="Basic information" ar="البيانات الأساسية" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
        <div className="sp-form">
          <div className="sp-form">
            <label><AdminText en="Name " ar="الاسم " /><TranslatedInput field="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Siwa Oasis" /></label>

          </div>
          <div className="sp-form-2">
            <label><AdminText en="Slug" ar="الرابط" /><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="siwa-oasis" dir="ltr" readOnly={Boolean(editSlug)} /></label>
            <label><AdminText en="Suggested stay" ar="مدة الإقامة المقترحة" /><TranslatedInput field="stay" value={stay} onChange={(e) => setStay(e.target.value)} placeholder={ar ? 'مثال: 2-3 أيام' : 'e.g. 2-3 days'} /></label>
          </div>
        </div>
      </ContentLanguageTabs>
</Card>
      <Card title={<AdminText en="Content" ar="المحتوى" />}>
<ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
        <div className="sp-form">
          <label><AdminText en="Description " ar="الوصف " /><TranslatedTextarea field="copy" rows={3} value={copy} onChange={(e) => setCopy(e.target.value)} /></label>

          <label><AdminText en="Best for (one per line)" ar="مناسبة لـ (سطر لكل بند)" /><TranslatedTextarea field="bestFor" rows={3} value={bestFor} onChange={(e) => setBestFor(e.target.value)} /></label>
          <label><AdminText en="Linked tour slugs (comma separated)" ar="الرحلات المرتبطة (slugs مفصولة بفاصلة)" /><input value={tourSlugs} onChange={(e) => setTourSlugs(e.target.value)} placeholder="cairo-and-giza-pyramids" dir="ltr" /></label>
        </div>
      </ContentLanguageTabs>
</Card>
      <Card title={<AdminText en="Media" ar="الوسائط" />} sub={<AdminText en="Cover image" ar="صورة الغلاف" />}>
        <ImageField value={image} onChange={setImage} disabled={saving || uploading || !canSave} onUploadingChange={setUploading} />
        <p className="sp-builder-note">The cover and detail hero can be managed independently.</p>
        <ImageField value={detailDraft.heroImage} onChange={heroImage => setDetailDraft(current => ({ ...current, heroImage }))} disabled={saving || uploading || !canSave} onUploadingChange={setUploading} previewAlt="Destination hero" />
      </Card>
      <Card title="Destination detail content">
        <ContentLanguageTabs translations={translations} setTranslations={setTranslations}>
          <div className="sp-form">
            {(['heroAlt', 'eyebrow', 'intro'] as const).map(key => <label key={key}>{key === 'heroAlt' ? 'Hero image description' : key === 'eyebrow' ? 'Eyebrow' : 'Introduction'}<TranslatedTextarea field={`detail.${key}`} value={detailDraft[key]} onChange={event => setDetailDraft(current => ({ ...current, [key]: event.target.value }))} rows={key === 'intro' ? 3 : 1} /></label>)}
            {(['facts', 'experiences', 'rhythm', 'practical'] as const).map(section => <div key={section} className="sp-repeat-list"><strong>{section}</strong>{detailDraft[section].map((row, index) => <article className="sp-repeat-card" key={`${section}-${index}`}>
              {Object.entries(row).filter(([key]) => ({ facts: ['label', 'value'], experiences: ['title', 'copy', 'alt'], rhythm: ['label', 'title', 'copy'], practical: ['title', 'copy'] })[section].includes(key)).map(([key, value]) => <label key={key}>{key}<TranslatedTextarea field={`detail.${section}.${index}.${key}`} value={section === 'facts' && index === 0 && key === 'value' ? stay : String(value)} onChange={event => { if (section === 'facts' && index === 0 && key === 'value') setStay(event.target.value); else updateDetailRow(section, index, key, event.target.value) }} rows={key === 'copy' ? 3 : 1} /></label>)}
            </article>)}</div>)}
          </div>
        </ContentLanguageTabs>
      </Card>
      <Card title={<AdminText en="Publishing" ar="النشر" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /><span><AdminText en="Published" ar="منشور" /><small><AdminText en="Hidden destinations disappear from the website" ar="الوجهات المخفية تختفي من الموقع" /></small></span></label>
            <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} dir="ltr" /></label>
          </div>
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={showInDestinations} onChange={(e) => setShowInDestinations(e.target.checked)} /><span><AdminText en="Show on destinations page" ar="الظهور في صفحة الوجهات" /><small><AdminText en="Editorial landing pages and homepage" ar="صفحات الهبوط التحريرية والرئيسية" /></small></span></label>
            <label className="sp-check-row"><input type="checkbox" checked={showInOneDayTours} onChange={(e) => setShowInOneDayTours(e.target.checked)} /><span><AdminText en="Show in One Day Tours" ar="الظهور في رحلات اليوم الواحد" /><small><AdminText en="Discovery section on the One Day Tours page" ar="قسم الاستكشاف في صفحة رحلات اليوم الواحد" /></small></span></label>
          </div>
        </div>
      </Card>
      <Card title={<AdminText en="One Day Tours" ar="رحلات اليوم الواحد" />} sub={<AdminText en="This destination appears on One Day Tours with these tours" ar="تظهر هذه الوجهة في رحلات اليوم الواحد مع هذه الرحلات" />}>
        <p className="sp-builder-note">Tour changes are saved atomically with this destination. Published tours must be reassigned before unlinking. Listing visibility does not change tour associations.</p>
        {!canEditTours && <p className="sp-builder-note">Tour view and edit permissions are required to manage associations. Existing links will be preserved.</p>}
        {tourError && <p role="alert">{tourError} Existing links will be preserved.</p>}
        <fieldset disabled={!canEditTours || !toursReady} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="sp-form">
          {linkedTours.length ? <div className="sp-repeat-list">{linkedTours.map((tour) => <article className="sp-repeat-card" key={tour.slug}>
            <header><span>{tour.image ? <img src={tour.image} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} /> : '•'}</span><strong>{tour.title}</strong><button type="button" className="sp-icon-btn danger" onClick={() => setLinkedSlugs((current) => current.filter((s) => s !== tour.slug))} aria-label={ar ? `إزالة ${tour.title}` : `Remove ${tour.title}`} title={ar ? 'إزالة' : 'Remove'}><Trash2 size={16} /></button></header>
            <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{tour.slug} · {tour.duration}</small>
          </article>)}</div> : <p className="sp-builder-note"><AdminText en="No one-day tours linked yet. Without tours, this destination stays off the public One Day Tours page." ar="لا توجد رحلات يوم واحد مرتبطة بعد. بدون رحلات، تبقى هذه الوجهة خارج صفحة رحلات اليوم الواحد العامة." /></p>}
          <label><AdminText en="Add one-day tour" ar="إضافة رحلة يوم واحد" />
            <input value={tourQuery} onChange={(e) => setTourQuery(e.target.value)} placeholder={ar ? 'ابحث في الرحلات...' : 'Search tours...'} />
          </label>
          {tourQuery.trim() && (availableTours.length ? <div className="sp-repeat-list">{availableTours.slice(0, 6).map((tour) => <article className="sp-repeat-card" key={tour.slug}>
            <header><span><Plus size={15} /></span><strong>{tour.title}</strong><button type="button" onClick={() => { setLinkedSlugs((current) => [...current, tour.slug]); setTourQuery('') }} aria-label={ar ? `إضافة ${tour.title}` : `Add ${tour.title}`} title={ar ? 'إضافة' : 'Add'}><Plus size={16} /></button></header>
            <small style={{ color: 'var(--sp-muted)' }} dir="ltr">{tour.slug} · {tour.duration}</small>
          </article>)}</div> : <p style={{ color: 'var(--sp-muted)' }}><AdminText en="No matching tours." ar="لا توجد رحلات مطابقة." /></p>)}
        </div></fieldset>
      </Card>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saveDisabled}><AdminText en="Save destination" ar="حفظ الوجهة" /></button>
        {editSlug && <Link className="sp-btn" href={`/destinations/${editSlug}`}><ExternalLink size={16} /> <AdminText en="View destination" ar="عرض الوجهة" /></Link>}
      </div>
    </fieldset></>}
  </>
}
