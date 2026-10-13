import type { BlogEditorial, BlogGuideSection } from '@/data/types'

export const BLOG_GUIDE_ICONS = ['Sun', 'Clock3', 'Compass', 'ShieldCheck', 'Ticket', 'Camera'] as const

export class BlogEditorialInputError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const clean = (value: unknown, max: number, label: string, required = false): string => {
  if (value === undefined || value === null) {
    if (required) throw new BlogEditorialInputError(`${label} is required.`)
    return ''
  }
  if (typeof value !== 'string') throw new BlogEditorialInputError(`Invalid ${label.toLowerCase()}.`)
  const result = value.trim().slice(0, max)
  if (required && !result) throw new BlogEditorialInputError(`${label} is required.`)
  return result
}

const array = (value: unknown, max: number, label: string): unknown[] => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > max) throw new BlogEditorialInputError(`Invalid ${label.toLowerCase()}.`)
  return value
}

const imageUrl = (value: unknown, label: string): string => {
  const result = clean(value, 2000, label)
  if (!result) return ''
  if (result.startsWith('/') && !result.startsWith('//')) return result
  try {
    const url = new URL(result)
    if (url.protocol === 'https:') return result
  } catch {}
  throw new BlogEditorialInputError(`${label} must be a website path or HTTPS URL.`)
}

const sectionId = (value: unknown): string => {
  const result = clean(value, 80, 'Section anchor', true).toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) {
    throw new BlogEditorialInputError('Section anchors use lowercase letters, numbers and dashes only.')
  }
  return result
}

const tourSlug = (value: unknown, label: string): string => {
  const result = clean(value, 80, label)
  if (result && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result)) throw new BlogEditorialInputError(`Invalid ${label.toLowerCase()}.`)
  return result
}

const compact = <T extends Record<string, unknown>>(value: T): T => {
  const entries = Object.entries(value).filter(([, item]) => item !== '' && item !== undefined && item !== false && !(Array.isArray(item) && item.length === 0))
  return Object.fromEntries(entries) as T
}

function readImage(value: unknown, label: string): { src: string; alt: string; caption?: string } | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) throw new BlogEditorialInputError(`Invalid ${label.toLowerCase()}.`)
  const src = imageUrl(value.src, `${label} URL`)
  const alt = clean(value.alt, 300, `${label} alt text`)
  const caption = clean(value.caption, 500, `${label} caption`)
  if (!src && !alt && !caption) return undefined
  if (!src) throw new BlogEditorialInputError(`${label} URL is required when the image is configured.`)
  if (!alt) throw new BlogEditorialInputError(`${label} alt text is required.`)
  return compact({ src, alt, caption })
}

function readSection(value: unknown, index: number): BlogGuideSection {
  if (!isRecord(value)) throw new BlogEditorialInputError('Invalid article section.')
  const id = sectionId(value.id)
  const number = clean(value.number, 20, `Section ${index + 1} number`, true)
  const eyebrow = clean(value.eyebrow, 160, `Section ${index + 1} eyebrow`, true)
  const heading = clean(value.heading, 300, `Section ${index + 1} heading`, true)
  const lede = clean(value.lede, 2000, `Section ${index + 1} introduction`)
  const copy = array(value.copy, 20, 'Section paragraphs').map((entry) => clean(entry, 5000, 'Section paragraph', true))
  const list = array(value.list, 30, 'Section list').map((entry) => clean(entry, 1000, 'Section list item', true))
  const image = readImage(value.image, `Section ${index + 1} image`)
  return compact({ id, number, eyebrow, heading, lede, copy, list, image, reverse: value.reverse === true }) as BlogGuideSection
}

export function emptyBlogEditorial(): BlogEditorial {
  return {
    heroImage: '',
    heroAlt: '',
    readTime: '',
    heroDescription: '',
    facts: [],
    sidebarLinks: [],
    sections: [],
    tips: [],
    quote: '',
    checklistEyebrow: 'Before you go',
    checklistHeading: 'Your trip, simplified',
    checklist: [],
  }
}

export function validateBlogEditorial(value: unknown, options: { publishable?: boolean } = {}): BlogEditorial {
  if (!isRecord(value)) throw new BlogEditorialInputError('Add the article content before publishing.')

  const sections = array(value.sections, 40, 'Article sections').map(readSection)
  const ids = new Set<string>()
  for (const section of sections) {
    if (ids.has(section.id)) throw new BlogEditorialInputError(`Section anchor "${section.id}" is used more than once.`)
    ids.add(section.id)
  }

  const rawTips = array(value.tips, 12, 'Tip cards')
  const rawChecklist = array(value.checklist, 30, 'Checklist')
  if (rawTips.length > 0 && !ids.has('essentials')) {
    throw new BlogEditorialInputError('Tip cards require an article section with the anchor "essentials".')
  }
  if (rawTips.length > 0 && ids.has('tips')) throw new BlogEditorialInputError('The "tips" anchor is reserved for the tip cards.')
  if (rawChecklist.length > 0 && ids.has('checklist')) throw new BlogEditorialInputError('The "checklist" anchor is reserved for the checklist.')

  const facts = array(value.facts, 8, 'Quick facts').map((entry) => {
    if (!isRecord(entry)) throw new BlogEditorialInputError('Invalid quick fact.')
    const icon = clean(entry.icon, 40, 'Quick fact icon') || 'Compass'
    if (!BLOG_GUIDE_ICONS.includes(icon as typeof BLOG_GUIDE_ICONS[number])) throw new BlogEditorialInputError('Invalid quick fact icon.')
    return { icon, label: clean(entry.label, 160, 'Quick fact label', true), value: clean(entry.value, 300, 'Quick fact value', true) }
  })

  const availableAnchors = new Set(ids)
  if (rawTips.length > 0 || rawChecklist.length > 0) availableAnchors.add('tips')
  if (rawChecklist.length > 0) availableAnchors.add('checklist')

  const sidebarLinks = array(value.sidebarLinks, 40, 'Guide links').map((entry) => {
    if (!isRecord(entry)) throw new BlogEditorialInputError('Invalid guide link.')
    const href = clean(entry.href, 82, 'Guide link anchor', true)
    if (!href.startsWith('#') || !availableAnchors.has(href.slice(1))) throw new BlogEditorialInputError(`Guide link "${href}" must point to an article section.`)
    return { href, label: clean(entry.label, 200, 'Guide link label', true) }
  })

  let sidebarAction: BlogEditorial['sidebarAction']
  if (value.sidebarAction !== undefined && value.sidebarAction !== null) {
    if (!isRecord(value.sidebarAction)) throw new BlogEditorialInputError('Invalid sidebar action.')
    const label = clean(value.sidebarAction.label, 160, 'Sidebar action label')
    const heading = clean(value.sidebarAction.heading, 300, 'Sidebar action heading')
    const linkedTour = tourSlug(value.sidebarAction.tourSlug, 'Sidebar tour')
    if (label || heading || linkedTour) {
      if (!label || !heading || !linkedTour) throw new BlogEditorialInputError('Complete the sidebar action label, heading and tour.')
      sidebarAction = { label, heading, tourSlug: linkedTour }
    }
  }

  const tips = rawTips.map((entry) => {
    if (!isRecord(entry)) throw new BlogEditorialInputError('Invalid tip card.')
    const icon = clean(entry.icon, 40, 'Tip icon') || 'Compass'
    if (!BLOG_GUIDE_ICONS.includes(icon as typeof BLOG_GUIDE_ICONS[number])) throw new BlogEditorialInputError('Invalid tip icon.')
    return { icon, title: clean(entry.title, 200, 'Tip title', true), copy: clean(entry.copy, 2000, 'Tip copy', true) }
  })

  const checklist = rawChecklist.map((entry) => {
    if (!isRecord(entry)) throw new BlogEditorialInputError('Invalid checklist item.')
    return { title: clean(entry.title, 240, 'Checklist title', true), detail: clean(entry.detail, 2000, 'Checklist detail', true) }
  })

  let cta: BlogEditorial['cta']
  if (value.cta !== undefined && value.cta !== null) {
    if (!isRecord(value.cta)) throw new BlogEditorialInputError('Invalid final call to action.')
    const next = {
      eyebrow: clean(value.cta.eyebrow, 160, 'CTA eyebrow'),
      heading: clean(value.cta.heading, 300, 'CTA heading'),
      copy: clean(value.cta.copy, 2000, 'CTA copy'),
      tourSlug: tourSlug(value.cta.tourSlug, 'CTA tour'),
      tourLabel: clean(value.cta.tourLabel, 160, 'CTA tour button'),
      customLabel: clean(value.cta.customLabel, 160, 'CTA planning button'),
    }
    if (Object.values(next).some(Boolean)) {
      if (!next.eyebrow || !next.heading || !next.copy) throw new BlogEditorialInputError('Complete the CTA eyebrow, heading and copy.')
      cta = compact(next)
    }
  }

  const result: BlogEditorial = compact({
    heroImage: imageUrl(value.heroImage, 'Hero image'),
    heroAlt: clean(value.heroAlt, 300, 'Hero alt text'),
    readTime: clean(value.readTime, 80, 'Reading time'),
    heroDescription: clean(value.heroDescription, 2000, 'Hero description'),
    facts,
    sidebarLinks,
    sidebarAction,
    sections,
    tips,
    quote: clean(value.quote, 3000, 'Quote'),
    checklistEyebrow: clean(value.checklistEyebrow, 160, 'Checklist eyebrow'),
    checklistHeading: clean(value.checklistHeading, 300, 'Checklist heading'),
    checklist,
    wideImage: readImage(value.wideImage, 'Wide article image'),
    cta,
  })

  if (options.publishable) {
    if (!result.heroDescription) throw new BlogEditorialInputError('Enter the hero introduction before publishing.')
    if (!result.sections?.length) throw new BlogEditorialInputError('Add at least one article section before publishing.')
  }
  return result
}
