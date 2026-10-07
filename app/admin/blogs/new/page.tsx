'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { slugify } from '@/lib/admin-store'
import { invalidateOffersBlogsCache, useDbBlogs } from '@/lib/offers-blogs-client'
import { ImageField } from '@/components/admin/image-field'
import type { Blog } from '@/data/types'

const cleanSlugInput = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 80)

function BlogForm({ initial, editSlug }: { initial: Blog | null; editSlug: string }) {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const dbBlogs = useDbBlogs([])

  const editing = Boolean(editSlug)
  const missing = editing && initial === null

  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [category, setCategory] = useState(initial?.category ?? 'Travel Guide')
  const [date, setDate] = useState(initial?.date ?? 'September 2026')
  const [image, setImage] = useState(initial?.image ?? '')
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '')
  const [published, setPublished] = useState(initial?.isPublished !== false)
  const [displayOrder, setDisplayOrder] = useState(initial?.displayOrder != null ? String(initial.displayOrder) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setError('')
    if (saving) return
    if (!title.trim()) { setError(ar ? 'اكتب عنوان المقال.' : 'Enter the story title.'); return }
    if (!category.trim()) { setError(ar ? 'اكتب تصنيف المقال.' : 'Enter the story category.'); return }
    if (!date.trim()) { setError(ar ? 'اكتب تاريخ المقال.' : 'Enter the story date.'); return }
    if (!excerpt.trim()) { setError(ar ? 'اكتب مقتطف المقال.' : 'Enter the story excerpt.'); return }
    const finalSlug = editing ? editSlug : cleanSlugInput(slugTouched ? slug : slugify(title)) || slugify(title || 'story')
    if (!/^[a-z0-9-]{1,80}$/.test(finalSlug)) {
      setError(ar ? 'المعرف (slug) يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات.' : 'Slug must be lowercase letters, numbers and dashes.')
      return
    }
    if (!editing && dbBlogs.some((b) => b.slug === finalSlug)) {
      setError(ar ? 'هذا المعرف مستخدم بالفعل. اختر معرفًا مختلفًا.' : 'This slug is already taken. Choose a different one.')
      return
    }
    // Story record is DB-authoritative (POST for new, PUT for edit).
    // Rich editorial content is preserved untouched on edit.
    setSaving(true)
    try {
      const url = editing
        ? `/api/blogs/${encodeURIComponent(editSlug)}`
        : '/api/blogs'
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? {} : { slug: finalSlug }),
          title: title.trim(),
          image: image.trim(),
          category: category.trim(),
          date: date.trim(),
          excerpt: excerpt.trim(),
          isPublished: published,
          ...(displayOrder.trim() ? { displayOrder: Number(displayOrder) } : {}),
        }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(data.error || 'Failed to save story.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save story.')
      setSaving(false)
      return
    }
    setSaving(false)
    invalidateOffersBlogsCache()
    router.push('/admin/blogs')
  }

  if (missing) {
    return <>
      <PageHead eyebrow="Blogs" title="Story not found" titleAr="المقال غير موجود" sub="Unknown slug" subAr="معرف غير معروف" backHref="/admin/blogs" />
      <Card title={<AdminText en="Unknown story" ar="مقال غير معروف" />}>
        <p><AdminText en={`No story matches slug "${editSlug}".`} ar={`لا يوجد مقال بالمعرف "${editSlug}".`} /></p>
      </Card>
    </>
  }

  return <>
    <PageHead
      eyebrow="Blogs"
      title={editing ? 'Edit story' : 'New story'}
      titleAr={editing ? 'تعديل مقال' : 'مقال جديد'}
      sub={editing ? `Editing ${editSlug}` : 'Published to the journal and homepage'}
      subAr={editing ? `تعديل ${editSlug}` : 'ينشر في المجلة والرئيسية'}
      backHref="/admin/blogs"
      actions={<button type="button" className="sp-btn dark" onClick={save} disabled={saving}><AdminText en={editing ? 'Save changes' : 'Publish story'} ar={editing ? 'حفظ التعديلات' : 'نشر المقال'} /></button>}
    />
    <Card title={<AdminText en="Story details" ar="بيانات المقال" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Title" ar="العنوان" /><input value={title} onChange={(e) => { setTitle(e.target.value); if (!slugTouched && !editing) setSlug(slugify(e.target.value)) }} /></label>
          <label><AdminText en="Category" ar="التصنيف" /><input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
        </div>
        <div className="sp-form-2">
          <label><AdminText en="Slug" ar="المعرف" /><input value={editing ? editSlug : (slugTouched ? slug : slugify(title))} disabled={editing} dir="ltr" onChange={(e) => { setSlugTouched(true); setSlug(cleanSlugInput(e.target.value)) }} placeholder="custom-..." />{!editing && <small><AdminText en="Lowercase letters, numbers, dashes. Must be unique." ar="أحرف صغيرة وأرقام وشرطات. يجب أن يكون فريدًا." /></small>}{editing && <small><AdminText en="Slug identity stays stable when editing." ar="يبقى المعرف ثابتًا عند التعديل." /></small>}</label>
          <label><AdminText en="Date" ar="التاريخ" /><input value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Excerpt" ar="المقتطف" /><textarea rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></label>
        <div className="sp-form-2">
          <label className="sp-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> <AdminText en="Published (visible on website)" ar="منشور (ظاهر على الموقع)" /></label>
          <label><AdminText en="Display order" ar="ترتيب العرض" /><input type="number" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} placeholder="1" /></label>
        </div>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save} disabled={saving}><AdminText en={editing ? 'Save changes' : 'Publish story'} ar={editing ? 'حفظ التعديلات' : 'نشر المقال'} /></button>
      </div>
    </Card>
  </>
}

function normalizeBlogRow(row: Record<string, unknown>): Blog {
  const content = (row.content ?? {}) as Record<string, unknown>
  return {
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    image: String(row.image ?? ''),
    category: String(row.category ?? ''),
    date: String(row.date ?? ''),
    excerpt: String(row.excerpt ?? ''),
    editorial: (content.editorial as Blog['editorial']) ?? undefined,
    isPublished: row.isPublished === false ? false : undefined,
    displayOrder: typeof row.displayOrder === 'number' ? row.displayOrder : undefined,
  } as Blog
}

function BlogFormLoader() {
  const params = useSearchParams()
  const editSlug = params.get('slug') ?? ''
  const [remote, setRemote] = useState<Record<string, unknown> | null | undefined>(editSlug ? undefined : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!editSlug) {
      setRemote(null)
      return
    }
    let cancelled = false
    setRemote(undefined)
    setLoadError(null)
    // Single source of truth: the DB record. Base-first snapshots would
    // leave admin-created slugs unresolvable and risk stale form state.
    fetch(`/api/blogs/${encodeURIComponent(editSlug)}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          // Unknown slugs are "not found"; any other failure is a DB/API
          // error and must never render as a missing record.
          if (res.status === 404) setRemote(null)
          else setLoadError(`Request failed (${res.status}).`)
          return
        }
        const data = (await res.json()) as { blog?: Record<string, unknown> }
        if (!cancelled) setRemote(data.blog ?? null)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not reach the database.')
      })
    return () => { cancelled = true }
  }, [editSlug, attempt])

  if (remote === undefined && loadError) {
    return <>
      <PageHead eyebrow="Blogs" title="Edit story" titleAr="تعديل مقال" backHref="/admin/blogs" />
      <Card title={<AdminText en="Could not load story" ar="تعذر تحميل المقال" />}>
        <p>{loadError}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button type="button" className="sp-btn primary" onClick={() => { setLoadError(null); setRemote(undefined); setAttempt((n) => n + 1) }}><AdminText en="Retry" ar="إعادة المحاولة" /></button>
        </div>
      </Card>
    </>
  }
  if (remote === undefined) {
    return <>
      <PageHead eyebrow="Blogs" title="Edit story" titleAr="تعديل مقال" backHref="/admin/blogs" />
      <Card title={<AdminText en="Loading…" ar="جارٍ التحميل…" />}><p><AdminText en="Loading story…" ar="جارٍ تحميل المقال…" /></p></Card>
    </>
  }
  const initial = remote ? normalizeBlogRow(remote) : null
  return <BlogForm key={editSlug || 'new'} initial={initial} editSlug={editSlug} />
}

export default function NewBlogPage() {
  return <Suspense><BlogFormLoader /></Suspense>
}
