import { faqs } from '@/data/content'
import type { PageContent, SectionDefinition } from './page-sections'
import { ENABLED_LOCALES } from './locale-config'
import { TEMPLATE_PAGES, isTemplatePageId, templateSections, originalTemplateContent } from './template-presentation'

export const PAGE_DOCUMENTS = {
  ...TEMPLATE_PAGES,
  homepage: { name: 'Homepage', route: '/' },
  faq: { name: 'FAQ', route: '/faq' },
  privacy: { name: 'Privacy Policy', route: '/privacy' },
  terms: { name: 'Terms of Use', route: '/terms' },
  guide: { name: 'Egypt travel guide', route: '/egypt-travel-guide' },
  accessible: { name: 'Accessible travel', route: '/accessible-travel' },
} as const
export type PageDocumentId = keyof typeof PAGE_DOCUMENTS
export function isPageDocumentId(id: string): id is PageDocumentId { return Object.hasOwn(PAGE_DOCUMENTS, id) }
export function additionalSections(id: Exclude<PageDocumentId, 'homepage'>): readonly SectionDefinition[] {
  if (isTemplatePageId(id)) return templateSections(id)
  if (id === 'guide' || id === 'accessible') return [
    { id: 'hero', name: 'Hero & information topics', fields: [], mandatory: true, editor: '/admin/website-cms/hero-sections/' + id },
    { id: 'help', name: 'Contact CTA', fields: ['heading', 'description', 'action'], href: '/contact' },
  ]
  if (id === 'faq') return [
    { id: 'hero', name: 'FAQ hero', fields: [], mandatory: true, editor: '/admin/website-cms/hero-sections/faq' },
    { id: 'intro', name: 'FAQ introduction', fields: ['eyebrow', 'heading', 'description'] },
    { id: 'questions', name: 'Questions and answers', fields: [], itemFields: ['question', 'answer'], minItems: 0, maxItems: 60 },
  ]
  return [
    { id: 'hero', name: 'Page heading & introduction', fields: ['heading', 'description'], mandatory: true },
    { id: 'content', name: 'Owner-approved policy sections', fields: [], itemFields: ['heading', 'description'], minItems: 0, maxItems: 60 },
  ]
}
export function originalAdditionalPage(id: Exclude<PageDocumentId, 'homepage'>): PageContent {
  if (isTemplatePageId(id)) return originalTemplateContent(id)
  const translations = (fields: Record<string, string>) => Object.fromEntries(ENABLED_LOCALES.map((locale) => [locale, { ...fields }])) as PageContent['sections'][number]['text']
  const sections = additionalSections(id).map((section) => ({ id: section.id, visible: true, text: translations(Object.fromEntries(section.fields.map((field) => [field, '']))) })) as PageContent['sections']
  if (id === 'guide' || id === 'accessible') {
    sections[1].href = '/contact'
    sections[1].text = {
      en: { heading: 'Need help planning your journey?', description: 'Talk to our team about the places you want to visit and the support you need.', action: 'Contact our team' },
      es: { heading: '¿Necesitas ayuda para planificar tu viaje?', description: 'Habla con nuestro equipo sobre los lugares que quieres visitar y la ayuda que necesitas.', action: 'Contacta con nuestro equipo' },
      it: { heading: 'Hai bisogno di aiuto per pianificare il viaggio?', description: 'Parla con il nostro team dei luoghi che vuoi visitare e dell’assistenza di cui hai bisogno.', action: 'Contatta il nostro team' },
    }
  } else if (id === 'faq') {
    sections[1].text = {
      en: { eyebrow: 'Good to know', heading: 'Before you go', description: 'We believe planning should feel as welcoming as the trip itself.' },
      es: { eyebrow: 'Conviene saber', heading: 'Antes de viajar', description: 'Creemos que planificar debe resultar tan acogedor como el propio viaje.' },
      it: { eyebrow: 'Utile sapere', heading: 'Prima di partire', description: 'Crediamo che pianificare debba essere accogliente quanto il viaggio stesso.' },
    }
    // Preserve the existing source verbatim; translations can be supplied by the editor.
    sections[2].items = faqs.map(([question, answer], index) => ({ id: 'question-' + index, visible: true, text: translations({ question, answer }) }))
  } else {
    sections[0].text = translations({ heading: PAGE_DOCUMENTS[id].name, description: id === 'privacy' ? 'STAR PYRAMIDS privacy policy. Learn how we collect, use, and protect your personal information when you book Egypt tours and travel services.' : 'STAR PYRAMIDS terms of use. Conditions for booking Egypt tours, Nile cruises, and travel services with STAR PYRAMIDS.' })
    sections[1].items = []
  }
  return { sections, seo: { text: translations({ title: '', description: '' }) as PageContent['seo']['text'], image: '' } }
}
