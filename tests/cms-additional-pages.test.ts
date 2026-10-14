import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { originalPageContent, validatePageContent, initialPageState, transitionPageContent, publicPageContent } from '@/lib/page-sections'
import { isPageDocumentId, type PageDocumentId } from '@/lib/additional-page-content'
import { CmsFaqBody, CmsPolicyPage } from '@/components/cms-additional-pages'

vi.mock('@/components/locale', () => ({ useLocale: () => ({ locale: 'it' }) }))

describe('additional page documents without any database', () => {
  it.each(['faq', 'privacy', 'terms', 'guide', 'accessible'] as PageDocumentId[])('keeps %s private until publish and restores only its own defaults', (id) => {
    const original = originalPageContent(id)
    expect(validatePageContent(original, id)).toEqual(original)
    const saved = transitionPageContent(initialPageState(), 'save-draft', original, id)
    expect(saved.mode).toBe('original')
    const published = transitionPageContent(saved, 'publish', undefined, id)
    expect(publicPageContent(published, id).content).toEqual(original)
    expect(transitionPageContent(published, 'restore', undefined, id).published).toBeNull()
  })
  it('keeps intentionally empty or hidden FAQ items empty in actual markup', () => {
    const content = originalPageContent('faq')
    content.sections[2].items = []
    let html = renderToStaticMarkup(React.createElement(CmsFaqBody, { state: { content } }))
    expect(html).not.toContain('When is the best time')
    content.sections[1].visible = false
    html = renderToStaticMarkup(React.createElement(CmsFaqBody, { state: { content } }))
    expect(html).not.toContain('Prima di partire')
    expect(html).toContain('faq-list')
  })
  it('renders translated edits and ordered visible questions without restoring removed answers', () => {
    const content = originalPageContent('faq')
    content.sections[2].items = [{ id: 'new-question', visible: true, text: { en: { question: 'English?', answer: 'English answer' }, es: { question: 'Spanish?', answer: 'Spanish answer' }, it: { question: 'Italian?', answer: 'Italian answer' } } }]
    const html = renderToStaticMarkup(React.createElement(CmsFaqBody, { state: { content } }))
    expect(html).toContain('Italian?'); expect(html).toContain('Italian answer')
    expect(html).not.toContain('English answer')
    expect(html).not.toContain('October through April')
  })
  it('does not invent a legal policy but renders owner-supplied publication', () => {
    const content = originalPageContent('privacy')
    expect(content.sections[1].items).toEqual([])
    content.sections[1].items = [{ id: 'approved', visible: true, text: { en: { heading: 'Approved', description: 'Owner text' }, es: { heading: 'Approved', description: 'Owner text' }, it: { heading: 'Approvato', description: 'Testo approvato' } } }]
    const html = renderToStaticMarkup(React.createElement(CmsPolicyPage, { pageId: 'privacy', state: { content } }))
    expect(html).toContain('Testo approvato')
    expect(html).not.toContain('Owner text')
    expect(renderToStaticMarkup(React.createElement(CmsPolicyPage, { pageId: 'privacy', state: { content, unavailable: true } }))).not.toContain('Testo approvato')
  })
  it('allowlists page identities and rejects cross-page schemas', () => {
    expect(isPageDocumentId('__proto__')).toBe(false)
    expect(isPageDocumentId('settings')).toBe(false)
    expect(() => validatePageContent(originalPageContent(), 'faq')).toThrow()
    expect(() => validatePageContent(originalPageContent('faq'), 'privacy')).toThrow()
  })
})
