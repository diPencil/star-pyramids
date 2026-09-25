'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminText, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { saveCustomItem, slugify } from '@/lib/admin-store'
import { ImageField } from '@/components/admin/image-field'
import type { Blog } from '@/data/types'

export default function NewBlogPage() {
  const ar = useAdminLocale() === 'ar'
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Travel Guide')
  const [date, setDate] = useState('September 2026')
  const [image, setImage] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [error, setError] = useState('')

  const save = () => {
    if (!title.trim()) { setError(ar ? 'اكتب عنوان المقال.' : 'Enter the story title.'); return }
    const item: Blog = {
      title: title.trim(),
      slug: slugify(title),
      image: image.trim(),
      category: category.trim() || 'Travel Guide',
      date: date.trim(),
      excerpt: excerpt.trim() || title.trim(),
    }
    saveCustomItem('blogs', item)
    router.push('/admin/blogs')
  }

  return <>
    <PageHead eyebrow="Blogs" title="New story" titleAr="مقال جديد" sub="Published to the journal and homepage" subAr="ينشر في المجلة والرئيسية" actions={<button type="button" className="sp-btn dark" onClick={save}><AdminText en="Publish story" ar="نشر المقال" /></button>} />
    <Card title={<AdminText en="Story details" ar="بيانات المقال" />}>
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="Title" ar="العنوان" /><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label><AdminText en="Category" ar="التصنيف" /><input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
        </div>
        <label><AdminText en="Date" ar="التاريخ" /><input value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <ImageField value={image} onChange={setImage} />
        <label><AdminText en="Excerpt" ar="المقتطف" /><textarea rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></label>
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="sp-btn primary" onClick={save}><AdminText en="Publish story" ar="نشر المقال" /></button>
      </div>
    </Card>
  </>
}
