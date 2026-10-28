'use client'

import Link from 'next/link'
import { CreationTimeline } from '@/components/admin/creation-timeline'
import { useEffect, useMemo, useState } from 'react'
import { DestinationSectionsEditor, DestinationCoverEditor } from '@/components/admin/destination-sections-editor'
import { DestinationBuilderPreview } from '@/components/admin/destination-builder-preview'
import { decodeTourJson } from '@/lib/tour-json'
import { destinationBuilderRecord, destinationBuilderTranslations } from '@/lib/destination-builder'
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
import type { Destination, Tour } from '@/data/types'

type AssociationTour = { slug: string; title: string; location: string; duration: string; image: string; category: string; destinationSlug: string | null; status: string }
const emptyDetail: Destination['detail'] = { heroImage: '', heroAlt: '', eyebrow: '', intro: '', facts: [], bestFor: [], experiences: [], rhythm: [], practical: [], tourSlugs: [] }

export default function DestinationEditorPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [editSlug, setEditSlug] = useState('')
  const [identityReady, setIdentityReady] = useState(false)
  // DB-authoritative catalogue with no static fallback: a failed API read
  // renders loading/error here, never bootstrap rows as editor records.
  const { user } = useCurrentUser()
  const can = (permission: string) => Boolean(user && (user.roles.includes('SUPER_ADMIN') || user.permissions?.includes(permission)))
  const canSave = can(editSlug ? 'destinations.edit' : 'destinations.create')
  const canViewTours = can('tours.view')
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
  const [uploads, setUploads] = useState<Record<string, boolean>>({})
  const uploading = Object.values(uploads).some(Boolean)
  const onUpload = (key: string, active: boolean) => setUploads(current => ({ ...current, [key]: active }))
  const [previewTours, setPreviewTours] = useState<Tour[]>([])

  const [translations, setTranslations] = useState<CatalogueTranslations>({})
  const [title, setTitle] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [slug, setSlug] = useState('')
  const [image, setImage] = useState('')
  const [copy, setCopy] = useState('')
  const [copyAr, setCopyAr] = useState('')
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
    setIdentityReady(true)
  }, [])

  useEffect(() => {
    if (!identityReady) return
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
  }, [identityReady, editSlug, reload])

  useEffect(() => {
    if (!canViewTours) return
    let active = true
    setToursReady(false)
    void (async () => {
      try {
        const response = await fetch('/api/tours?full=1&all=1', { credentials: 'same-origin', cache: 'no-store' })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.tours)) throw new Error(body.error || 'Could not load tour associations.')
        const tours: AssociationTour[] = body.tours.filter((tour: AssociationTour) => tour.category === 'one-day-tours')
        if (active) {
          setPreviewTours(body.tours.map((row: Record<string, unknown>) => decodeTourJson(row)) as Tour[])
          setLiveTours(tours)
          const linked = tours.filter(tour => tour.destinationSlug === editSlug).map(tour => tour.slug)
          setLinkedSlugs(linked); setInitialSlugs(linked); setToursReady(true); setTourError('')
        }
      } catch (error) { if (active) setTourError(error instanceof Error ? error.message : 'Could not load tour associations.') }
    })()
    return () => { active = false }
  }, [canViewTours, editSlug])

  useEffect(() => {
    if (!identityReady || catalogueLoading) return
    if (editing) {
      setDetailDraft(editing.detail)
      setTranslations(destinationBuilderTranslations(editing))
      setTitle(editing.title)
      setNameAr(editing.nameAr ?? '')
      setSlug(editing.slug)
      setImage(editing.image)
      setCopy(editing.copy)
      setCopyAr(editing.copyAr ?? '')
      setTourSlugs(editing.detail.tourSlugs.join(', '))
      setShowInDestinations(editing.showInDestinations !== false)
      setShowInOneDayTours(editing.showInOneDayTours === true)
      setPublished(editing.isPublished !== false)
      setOrder(editing.displayOrder === undefined ? '' : String(editing.displayOrder))
    }
    setReady(true)
  }, [identityReady, editSlug, editing, catalogueLoading])

  const availableTours = useMemo(() => {
    const q = tourQuery.trim().toLowerCase()
    return liveTours.filter((t) => !linkedSlugs.includes(t.slug) && (!q || `${t.title} ${t.location} ${t.duration}`.toLowerCase().includes(q)))
  }, [liveTours, linkedSlugs, tourQuery])

  const linkedTours = useMemo(
    () => linkedSlugs.map((s) => liveTours.find((t) => t.slug === s)).filter((t): t is (typeof liveTours)[number] => Boolean(t)),
    [linkedSlugs, liveTours],
  )
  const saveDisabled = saving || uploading || !canSave || !ready || catalogueLoading || Boolean(catalogueError) || Boolean(editSlug && !editing)
  const draft = destinationBuilderRecord({
    ...(editing ?? {}), title, slug: editSlug || dbSlugify(slug.trim() || title), image, copy,
    nameAr: nameAr || undefined, copyAr: copyAr || undefined, translations,
    isPublished: published, showInDestinations, showInOneDayTours,
    displayOrder: order.trim() ? Number(order) : undefined,
    detail: { ...detailDraft, tourSlugs: tourSlugs.split(',').map(value => value.trim()).filter(Boolean) },
  })
  const changeDraft = (next: Destination) => {
    setTitle(next.title); setImage(next.image); setCopy(next.copy); setDetailDraft(next.detail)
    setTranslations(next.translations ?? {})
  }
  // Unsaved association deltas are projected without any request or write.
  const draftTours = previewTours.map(tour => tour.category !== 'one-day-tours' ? tour : ({ ...tour,
    destinationSlug: linkedSlugs.includes(tour.slug) ? draft.slug : tour.destinationSlug === editSlug && initialSlugs.includes(tour.slug) ? null : tour.destinationSlug,
  }))

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
      detail: draft.detail,
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
    ) : <><fieldset disabled={saving || uploading || !canSave} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <DestinationBuilderPreview item={draft} tours={draftTours}/>
      <CreationTimeline busy={saving || uploading} ariaLabel="Destination builder steps" steps={[
        { id: 'hero', label: 'Hero', content: <>      <Card title="Destination builder" sub="Edit the same content and item order shown on the public detail page.">
        <label>Canonical slug<input value={slug} onChange={event => setSlug(event.target.value)} placeholder="siwa-oasis" dir="ltr" readOnly={Boolean(editSlug)}/></label>
        <p className="sp-builder-note">This preview does not save or publish. Record content below follows the public page hierarchy. Template-wide visibility, section order and shared CTA labels belong to <Link href="/admin/website-cms/pages/destination-detail">Website CMS → Destination template</Link>.</p>
      </Card>
<DestinationSectionsEditor item={draft} onChange={changeDraft} setTranslations={setTranslations} onUpload={onUpload} disabled={saving || uploading || !canSave} section="hero"/></> },
        { id: 'facts', label: 'Facts', content: <DestinationSectionsEditor item={draft} onChange={changeDraft} setTranslations={setTranslations} onUpload={onUpload} disabled={saving || uploading || !canSave} section="facts"/> },
        { id: 'story', label: 'Story', content: <DestinationSectionsEditor item={draft} onChange={changeDraft} setTranslations={setTranslations} onUpload={onUpload} disabled={saving || uploading || !canSave} section="story"/> },
        { id: 'experiences', label: 'Experiences', content: <DestinationSectionsEditor item={draft} onChange={changeDraft} setTranslations={setTranslations} onUpload={onUpload} disabled={saving || uploading || !canSave} section="experiences"/> },
        { id: 'rhythm', label: 'Journey', content: <DestinationSectionsEditor item={draft} onChange={changeDraft} setTranslations={setTranslations} onUpload={onUpload} disabled={saving || uploading || !canSave} section="rhythm"/> },
        { id: 'practical', label: 'Practical', content: <DestinationSectionsEditor item={draft} onChange={changeDraft} setTranslations={setTranslations} onUpload={onUpload} disabled={saving || uploading || !canSave} section="practical"/> },
        { id: 'trips', label: 'Related trips', content: <>      <Card title={<AdminText en="7. Related trips / One Day Tours" ar="رحلات اليوم الواحد" />} sub={<AdminText en="This destination appears on One Day Tours with these tours" ar="تظهر هذه الوجهة في رحلات اليوم الواحد مع هذه الرحلات" />}>
        <label>Editorial related trip slugs (canonical, comma separated)<input value={tourSlugs} onChange={event => setTourSlugs(event.target.value)} onBlur={() => setTourSlugs(tourSlugs.split(',').map(value => value.trim()).filter(Boolean).map(value => previewTours.find(tour => tour.slug === value)?.slug ?? previewTours.find(tour => tour.aliases?.includes(value))?.slug ?? value).filter((value, index, rows) => rows.indexOf(value) === index).join(', '))} dir="ltr"/></label>
        <ul>{draft.detail.tourSlugs.map(value => { const tour = previewTours.find(row => row.slug === value || row.aliases?.includes(value)); return <li key={value}>{tour?.title ?? value}{tour ? tour.status !== 'published' ? ' — unpublished; excluded publicly' : '' : ' — unavailable or not loaded; existing reference preserved'}</li> })}</ul>
        <p className="sp-builder-note">The public page combines editorial selections with published trips assigned to this destination. Missing or unpublished references never appear publicly.</p>
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
</> },
        { id: 'cover', label: 'Cover & CTA', content: <>      <DestinationCoverEditor item={draft} onChange={changeDraft} onUpload={onUpload} disabled={saving || uploading || !canSave}/>
</> },
        { id: 'publish', label: 'Review & publish', content: <>      <Card title="SEO & shared presentation" sub="Existing SEO and shared CMS editors remain the source of truth.">
        {editSlug ? <Link className="sp-btn" href={`/admin/website-cms/seo/dynamic/destination/${encodeURIComponent(editSlug)}`}>Edit destination SEO</Link> : <p className="sp-builder-note">Save the destination before managing its SEO override. Existing SEO metadata is preserved by the API.</p>}
      </Card>
      <Card title={<AdminText en="Publishing" ar="النشر" />}>
        <div className="sp-form">
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /><span><AdminText en="Published" ar="منشور" /><small><AdminText en="Hidden destinations disappear from the website" ar="الوجهات المخفية تختفي من الموقع" /></small></span></label>
            <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" value={order} onChange={(e) => setOrder(e.target.value)} dir="ltr" /></label>
          </div>
          <div className="sp-form-2">
            <label className="sp-check-row"><input type="checkbox" checked={showInDestinations} onChange={(e) => setShowInDestinations(e.target.checked)} /><span><AdminText en="Feature in curated destination sections" ar="الظهور في صفحة الوجهات" /><small><AdminText en="Homepage selections; the full destination directory shows all published records" ar="صفحات الهبوط التحريرية والرئيسية" /></small></span></label>
            <label className="sp-check-row"><input type="checkbox" checked={showInOneDayTours} onChange={(e) => setShowInOneDayTours(e.target.checked)} /><span><AdminText en="Show in One Day Tours" ar="الظهور في رحلات اليوم الواحد" /><small><AdminText en="Discovery section on the One Day Tours page" ar="قسم الاستكشاف في صفحة رحلات اليوم الواحد" /></small></span></label>
          </div>
        </div>
      </Card>
<Card title="Review destination"><dl><dt>Name</dt><dd>{title || 'Not entered'}</dd><dt>Facts / experiences / stages / practical items</dt><dd>{draft.detail.facts.length} / {draft.detail.experiences.length} / {draft.detail.rhythm.length} / {draft.detail.practical.length}</dd><dt>Publication</dt><dd>{published ? 'Published when saved' : 'Unpublished when saved'}</dd></dl><p className="sp-builder-note">Navigation never saves. Use Save destination to apply the current fields and publication choice.</p></Card></> },
      ]}/>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saveDisabled}><AdminText en="Save destination" ar="حفظ الوجهة" /></button>
        {editSlug && <Link className="sp-btn" href={`/destinations/${editSlug}`}><ExternalLink size={16} /> <AdminText en="View destination" ar="عرض الوجهة" /></Link>}
      </div>
    </fieldset></>}
  </>
}
