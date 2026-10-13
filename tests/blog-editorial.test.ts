import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blogs } from '@/data/content'
import { BlogEditorialInputError, validateBlogEditorial } from '@/lib/blog-editorial'
import { localizeCatalogue, moveTranslationRow, removeTranslationRow, validateCatalogueTranslations } from '@/lib/catalogue-translations'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('blog editorial data', () => {
  it('accepts every current static article without losing its structured content', () => {
    for (const blog of blogs) {
      expect(blog.editorial, blog.slug).toBeTruthy()
      const validated = validateBlogEditorial(blog.editorial, { publishable: true })
      expect(validated.sections?.length, blog.slug).toBe(blog.editorial?.sections?.length)
      expect(validated.facts?.length, blog.slug).toBe(blog.editorial?.facts?.length)
      expect(validated.checklist?.length, blog.slug).toBe(blog.editorial?.checklist?.length)
      expect(JSON.parse(JSON.stringify(validated))).toMatchObject(JSON.parse(JSON.stringify(blog.editorial)))
    }
  })

  it('rejects incomplete published content and unsafe media', () => {
    expect(() => validateBlogEditorial({}, { publishable: true })).toThrow(BlogEditorialInputError)
    expect(() => validateBlogEditorial({ heroDescription: 'Intro', sections: [{ id: 'one', number: '01', eyebrow: 'Start', heading: 'Heading', image: { src: 'javascript:alert(1)', alt: 'Bad' } }] }, { publishable: true })).toThrow(/HTTPS URL/)
  })

  it('requires sidebar links to point at real section anchors', () => {
    expect(() => validateBlogEditorial({ heroDescription: 'Intro', sections: [{ id: 'one', number: '01', eyebrow: 'Start', heading: 'Heading' }], sidebarLinks: [{ href: '#missing', label: 'Missing' }] }, { publishable: true })).toThrow(/must point to an article section/)
  })

  it('localizes nested editorial fields without changing links, images or layout', () => {
    const base = blogs[1]
    const translations = validateCatalogueTranslations('blog', { es: {
      'editorial.heroDescription': 'Introducción',
      'editorial.facts.0.label': 'Clima',
      'editorial.sections.0.heading': 'Capas ligeras',
      'editorial.sections.0.copy.0': 'Párrafo traducido',
      'editorial.checklist.0.title': 'Consulta el tiempo',
      'editorial.cta.heading': 'Deja que el río marque el ritmo',
    } })
    const localized = localizeCatalogue({ ...base, translations }, 'blog', 'es')
    expect(localized.editorial?.heroDescription).toBe('Introducción')
    expect(localized.editorial?.facts?.[0].label).toBe('Clima')
    expect(localized.editorial?.sections?.[0].heading).toBe('Capas ligeras')
    expect(localized.editorial?.sections?.[0].copy?.[0]).toBe('Párrafo traducido')
    expect(localized.editorial?.sections?.[0].image?.src).toBe(base.editorial?.sections?.[0].image?.src)
    expect(localized.editorial?.cta?.tourSlug).toBe(base.editorial?.cta?.tourSlug)
  })

  it('keeps nested translations aligned when sections are removed or reordered', () => {
    const translations = { es: {
      'editorial.sections.0.heading': 'Uno',
      'editorial.sections.1.heading': 'Dos',
      'editorial.sections.2.heading': 'Tres',
    } }
    expect(removeTranslationRow(translations, 'editorial.sections', 1).es).toEqual({
      'editorial.sections.0.heading': 'Uno',
      'editorial.sections.1.heading': 'Tres',
    })
    expect(moveTranslationRow(translations, 'editorial.sections', 2, 0).es).toEqual({
      'editorial.sections.1.heading': 'Uno',
      'editorial.sections.2.heading': 'Dos',
      'editorial.sections.0.heading': 'Tres',
    })
  })
})

describe('blog release guards', () => {
  it('stores and validates editorial content in create and update APIs', () => {
    expect(source('app/api/blogs/route.ts')).toMatch(/validateBlogEditorial/)
    expect(source('app/api/blogs/[slug]/route.ts')).toMatch(/validateBlogEditorial/)
  })

  it('keeps drafts out of public API, static params and metadata routes', () => {
    expect(source('app/api/blogs/route.ts')).toMatch(/where: \{ isPublished: true \}/)
    expect(source('app/api/blogs/[slug]/route.ts')).toMatch(/if \(!blog\.isPublished\)/)
    expect(source('lib/server/blogs.ts')).toMatch(/where: \{ slug, isPublished: true \}/)
    expect(source('lib/server/blogs.ts')).toMatch(/where: \{ isPublished: true \}, select: \{ slug: true \}/)
  })

  it('renders blog routes from server-provided database records instead of the static catalogue', () => {
    expect(source('app/blogs/page.tsx')).toMatch(/getPublishedDbBlogs/)
    expect(source('app/blogs/[slug]/page.tsx')).toMatch(/initialBlogs=\{publishedBlogs\}/)
    expect(source('components/extended-pages.tsx')).toMatch(/useDbBlogs\(initialBlogs\)/)
  })

  it('does not render fabricated generic article copy', () => {
    const page = source('components/extended-pages.tsx')
    expect(page).not.toContain('Egypt rewards travelers who look a little closer')
    expect(page).not.toContain('Travel slowly enough to notice what makes a place itself')
  })
})
