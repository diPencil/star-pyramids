export const APPEARANCE_KEY = 'cms.appearance.public.v1'
export const APPEARANCE_FONTS = { brand: 'var(--font-montserrat), Arial, sans-serif', system: 'system-ui, sans-serif', arial: 'Arial, sans-serif', georgia: 'Georgia, serif' } as const
type Group = 'Colors' | 'Typography' | 'Buttons' | 'Forms' | 'Cards & Layout'
type Field = { label: string; group: Group; kind: 'color' | 'number' | 'select'; default: string | number; min?: number; max?: number; options?: readonly string[] }
const color = (label: string, value: string, group: Group = 'Colors'): Field => ({ label, group, kind: 'color', default: value })
const number = (label: string, value: number, min: number, max: number, group: Group): Field => ({ label, group, kind: 'number', default: value, min, max })
export const APPEARANCE_FIELDS = {
  primary: color('Primary', '#f7951d'), secondary: color('Secondary', '#1d4ed8'), accent: color('Accent', '#ffc531'),
  background: color('Background', '#ffffff'), surface: color('Card surface', '#ffffff'), text: color('Primary text', '#1d1f1f'), muted: color('Secondary text', '#737983'), border: color('Border', '#dedede'), link: color('Links', '#1d4ed8'), focus: color('Focus ring', '#1d4ed8'),
  font: { label: 'Font family', group: 'Typography', kind: 'select', default: 'brand', options: Object.keys(APPEARANCE_FONTS) } as Field,
  baseSize: number('Base font size', 16, 14, 20, 'Typography'), mobileBaseSize: number('Mobile base font size', 16, 14, 20, 'Typography'), tabletBaseSize: number('Tablet base font size', 16, 14, 20, 'Typography'),
  bodyWeight: number('Body weight', 400, 400, 800, 'Typography'), headingWeight: number('Heading weight', 800, 400, 800, 'Typography'), lineHeight: number('Body line height', 1.6, 1.3, 2, 'Typography'),
  h1: number('H1 size', 48, 30, 72, 'Typography'), h2: number('H2 size', 42, 24, 56, 'Typography'), h3: number('H3 size', 28, 20, 40, 'Typography'), h4: number('H4 size', 24, 18, 32, 'Typography'), h5: number('H5 size', 20, 16, 28, 'Typography'), h6: number('H6 size', 18, 14, 24, 'Typography'),
  mobileHeadingScale: number('Mobile heading scale', 0.8, 0.65, 1, 'Typography'), tabletHeadingScale: number('Tablet heading scale', 0.9, 0.75, 1, 'Typography'),
  buttonBackground: color('Primary button background', '#f7951d', 'Buttons'), buttonText: color('Primary button text', '#ffffff', 'Buttons'), buttonHover: color('Primary button hover', '#e88410', 'Buttons'), secondaryButtonBackground: color('Secondary button background', '#ffffff', 'Buttons'), secondaryButtonText: color('Secondary button text', '#1d4ed8', 'Buttons'), secondaryButtonHover: color('Secondary button hover', '#f4f7ff', 'Buttons'),
  buttonRadius: number('Button radius', 999, 0, 999, 'Buttons'), buttonBorder: number('Button border width', 0, 0, 3, 'Buttons'), buttonHeight: number('Button minimum height', 48, 44, 64, 'Buttons'), buttonPadding: number('Button horizontal padding', 24, 12, 42, 'Buttons'), buttonSize: number('Button font size', 16, 12, 20, 'Buttons'), buttonWeight: number('Button weight', 700, 400, 800, 'Buttons'), disabledOpacity: number('Disabled opacity', 0.5, 0.3, 0.8, 'Buttons'),
  inputBackground: color('Field background', '#ffffff', 'Forms'), inputText: color('Field text', '#1d1f1f', 'Forms'), inputBorder: color('Field border', '#dedede', 'Forms'), placeholder: color('Placeholder', '#737983', 'Forms'),
  inputHeight: number('Field minimum height', 48, 44, 64, 'Forms'), inputRadius: number('Field radius', 8, 0, 24, 'Forms'), inputSize: number('Field font size', 16, 16, 20, 'Forms'), labelSize: number('Label font size', 14, 12, 18, 'Forms'), labelWeight: number('Label weight', 700, 400, 800, 'Forms'),
  cardRadius: number('Card radius', 22, 0, 32, 'Cards & Layout'), cardBorder: number('Card border width', 1, 0, 3, 'Cards & Layout'),
  cardShadow: { label: 'Card shadow', group: 'Cards & Layout', kind: 'select', default: 'original', options: ['original', 'none', 'soft', 'medium'] } as Field,
  containerWidth: number('Container maximum width', 1450, 960, 1600, 'Cards & Layout'), sectionSpacing: number('Section vertical spacing', 76, 40, 100, 'Cards & Layout'), mobileSectionSpacing: number('Mobile section spacing', 48, 24, 64, 'Cards & Layout'), tabletSectionSpacing: number('Tablet section spacing', 60, 32, 80, 'Cards & Layout'), contentGap: number('Card content spacing', 22, 12, 32, 'Cards & Layout'), gridGap: number('Listing grid gap', 24, 12, 36, 'Cards & Layout'),
} satisfies Record<string, Field>
export type AppearanceToken = keyof typeof APPEARANCE_FIELDS
export type AppearanceTokens = Partial<Record<AppearanceToken, string | number>>
export type AppearanceState = { version: 1; revision: number; draft: AppearanceTokens | null; published: AppearanceTokens | null; previous: AppearanceTokens | null; hasPrevious: boolean; updatedAt: string | null }
export type AppearanceAction = 'save-draft' | 'publish' | 'restore'
export class AppearanceValidationError extends Error {}
export const initialAppearance = (): AppearanceState => ({ version: 1, revision: 0, draft: null, published: null, previous: null, hasPrevious: false, updatedAt: null })
export function validateAppearance(input: unknown): AppearanceTokens {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppearanceValidationError('Invalid appearance settings.')
  const clean: AppearanceTokens = {}
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(APPEARANCE_FIELDS, key)) throw new AppearanceValidationError('Unknown appearance token.')
    const field: Field = APPEARANCE_FIELDS[key as AppearanceToken]
    if (field.kind === 'color' ? typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value) : field.kind === 'select' ? typeof value !== 'string' || !field.options?.includes(value) : typeof value !== 'number' || !Number.isFinite(value) || value < field.min! || value > field.max! || (key.endsWith('Weight') && value % 100 !== 0)) throw new AppearanceValidationError(`Invalid ${field.label.toLowerCase()}.`)
    // Store explicit overrides only; absence preserves each original component's design.
    clean[key as AppearanceToken] = typeof value === 'string' && field.kind === 'color' ? value.toLowerCase() : value
  }
  return clean
}
export function decodeAppearance(raw: string): AppearanceState {
  const value = JSON.parse(raw) as AppearanceState
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.hasPrevious !== 'boolean' || (value.updatedAt !== null && (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))))) throw new AppearanceValidationError('Invalid stored appearance.')
  for (const key of ['draft', 'published', 'previous'] as const) { if (value[key] !== null) value[key] = validateAppearance(value[key]) }
  return value
}
export function transitionAppearance(state: AppearanceState, action: AppearanceAction, input?: unknown): AppearanceState {
  const next = { ...state, revision: state.revision + 1, updatedAt: new Date().toISOString() }
  if (action === 'save-draft') next.draft = validateAppearance(input)
  else if (action === 'publish') {
    if (state.draft === null) throw new AppearanceValidationError('Save a draft before publishing.')
    next.previous = state.published; next.hasPrevious = true; next.published = validateAppearance(state.draft); next.draft = null
  } else if (action === 'restore') {
    if (!state.hasPrevious) throw new AppearanceValidationError('No previous published version.')
    next.published = state.previous; next.previous = state.published; next.draft = null
  } else throw new AppearanceValidationError('Invalid appearance action.')
  return next
}
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => { const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4); return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 }
  const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export const isPublicAppearancePath = (path: string) => !/^\/(admin|account)(\/|$)/.test(path)

// All selectors are restricted to real shared storefront primitives. Never target admin classes.
export function appearanceCss(input: AppearanceTokens, scope = '.public-appearance'): string {
  if (scope !== '.public-appearance') throw new AppearanceValidationError('Invalid appearance scope.')
  const t = validateAppearance(input); const rules: string[] = []; const vars: string[] = []
  const rule = (selectors: string, property: string, key: AppearanceToken, unit = '') => { if (t[key] !== undefined) rules.push(`${selectors.split(',').map(s => `${scope} ${s.trim()}`).join(',')}{${property}:${t[key]}${unit}}`) }
  const map: Partial<Record<AppearanceToken, string>> = { primary: '--primary', secondary: '--blue', accent: '--yellow', surface: '--surface', text: '--text', muted: '--muted', border: '--border', buttonHover: '--primary-hover', containerWidth: '--content', cardRadius: '--radius-card' }
  for (const [key, name] of Object.entries(map)) if (t[key as AppearanceToken] !== undefined) vars.push(`${name}:${t[key as AppearanceToken]}${typeof t[key as AppearanceToken] === 'number' ? 'px' : ''}`)
  if (t.font) vars.push(`font-family:${APPEARANCE_FONTS[t.font as keyof typeof APPEARANCE_FONTS]}`)
  if (t.baseSize !== undefined) vars.push(`font-size:${t.baseSize}px`)
  if (t.bodyWeight !== undefined) vars.push(`font-weight:${t.bodyWeight}`)
  if (t.text) vars.push(`color:${t.text}`)
  if (t.background) vars.push(`display:block;background:${t.background};min-height:100vh`)
  if (vars.length) rules.push(`${scope}{${vars.join(';')}}`)
  const primaryButtons = '.primary-btn,.search-btn,.small-orange-btn'
  const buttons = `${primaryButtons},.outline-btn,.make-trip-link`
  rule('p', 'line-height', 'lineHeight'); rule('p,.tour-body,.content-card-body,.offer-card-body', 'font-size', 'baseSize', 'px'); rule('h1,h2,h3,h4,h5,h6', 'font-weight', 'headingWeight')
  for (const key of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const) {
    rule(key, 'font-size', key, 'px')
    if (t[key] !== undefined) rules.push(`${scope} ${key}{overflow-wrap:anywhere}`)
  }
  rule(primaryButtons, 'background-color', 'buttonBackground'); rule(primaryButtons, 'color', 'buttonText'); rule('.primary-btn:hover:not(:disabled),.search-btn:hover:not(:disabled),.small-orange-btn:hover', 'background-color', 'buttonHover')
  rule('.outline-btn,.make-trip-link', 'background-color', 'secondaryButtonBackground'); rule('.outline-btn,.make-trip-link', 'color', 'secondaryButtonText'); rule('.outline-btn:hover:not(:disabled),.make-trip-link:hover', 'background-color', 'secondaryButtonHover')
  rule(buttons, 'border-radius', 'buttonRadius', 'px'); rule(buttons, 'border-width', 'buttonBorder', 'px'); if (t.buttonBorder !== undefined) rules.push(`${scope} :is(${buttons}){border-style:solid;border-color:var(--primary)}`)
  rule(buttons, 'min-height', 'buttonHeight', 'px'); rule(buttons, 'padding-inline', 'buttonPadding', 'px'); rule(buttons, 'font-size', 'buttonSize', 'px'); rule(buttons, 'font-weight', 'buttonWeight'); rule('.primary-btn:disabled,.outline-btn:disabled,.search-btn:disabled,.small-orange-btn:disabled', 'opacity', 'disabledOpacity')
  if (t.buttonSize !== undefined || t.buttonPadding !== undefined) rules.push(`${scope} :is(${buttons}){min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;text-align:center}`)
  const formScopes = ['.form-grid', '.myt-field', '.contact-form', '.ask-form', '.rev-form', '.shared-help-fields']
  const textInput = 'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]):not([type=submit]):not([type=button])'
  const forms = formScopes.flatMap(selector => [`${selector} ${textInput}`, `${selector} select`, `${selector} textarea`, `${selector} .cselect-trigger`]).join(',')
  rule(forms, 'background-color', 'inputBackground'); rule(forms, 'color', 'inputText'); rule(forms, 'border-color', 'inputBorder'); rule(forms, 'min-height', 'inputHeight', 'px'); rule(forms, 'border-radius', 'inputRadius', 'px'); rule(forms, 'font-size', 'inputSize', 'px'); rule(formScopes.flatMap(selector => [`${selector} input::placeholder`, `${selector} textarea::placeholder`]).join(','), 'color', 'placeholder')
  if (t.inputHeight !== undefined) rules.push(`${formScopes.map(selector => `${scope} ${selector} textarea`).join(',')}{min-height:max(96px,${t.inputHeight}px)}`)
  rule('.form-grid label,.myt-field,.contact-form label,.ask-form label,.rev-form label,.shared-help-fields label', 'font-size', 'labelSize', 'px'); rule('.form-grid label,.myt-field,.contact-form label,.ask-form label,.rev-form label,.shared-help-fields label', 'font-weight', 'labelWeight')
  if (t.focus) rules.push(`${scope} :is(${buttons},${forms}):focus-visible{outline:2px solid ${t.focus};outline-offset:3px}`)
  rule('.text-link,.promo-offer-link,.content-card a:not(.primary-btn),.tour-body a:not(.primary-btn)', 'color', 'link')
  const cards = '.tour-card,.content-card,.car-card,.promo-offer-card,.offer-card,.blog-home-grid>article,.rev-card'
  rule(cards, 'background-color', 'surface'); rule(cards, 'border-radius', 'cardRadius', 'px'); rule(cards, 'border-width', 'cardBorder', 'px'); rule(cards, 'border-color', 'border')
  if (t.cardBorder !== undefined) rules.push(`${scope} :is(${cards}){border-style:solid}`)
  if (t.cardShadow && t.cardShadow !== 'original') rules.push(`${scope} :is(${cards}){box-shadow:${({ none: 'none', soft: '0 4px 16px rgb(0 0 0 / 8%)', medium: '0 12px 32px rgb(0 0 0 / 14%)' } as Record<string, string>)[t.cardShadow]}}`)
  rule('.section,.home-section', 'padding-block', 'sectionSpacing', 'px'); rule('.content-card-body,.tour-body,.offer-card-body,.blog-home-grid>article>div', 'padding', 'contentGap', 'px'); rule('.tour-grid,.blog-grid,.content-grid,.car-grid,.listing-grid,.compact-tour-grid,.blog-home-grid', 'gap', 'gridGap', 'px')
  rule('.offers-page,.listing-page,.article-page,.policy-page,.search-page,.contact-page,.about-page', 'background-color', 'background')
  for (const [device, query] of [['tablet', '(min-width:761px) and (max-width:1100px)'], ['mobile', '(max-width:760px)']] as const) {
    const r: string[] = []; const base = t[`${device}BaseSize`]; const spacing = t[`${device}SectionSpacing`]; const scale = t[`${device}HeadingScale`]
    if (base !== undefined) r.push(`${scope},${scope} p,${scope} .tour-body,${scope} .content-card-body,${scope} .offer-card-body{font-size:${base}px}`)
    if (spacing !== undefined) r.push(`${scope} .section,${scope} .home-section{padding-block:${spacing}px}`)
    for (const key of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const) if (t[key] !== undefined || scale !== undefined) r.push(`${scope} ${key}{font-size:${Number(t[key] ?? APPEARANCE_FIELDS[key].default) * Number(scale ?? (device === 'mobile' ? 0.8 : 0.9))}px}`)
    if (r.length) rules.push(`@media ${query}{${r.join('')}}`)
  }
  return rules.join('\n')
}
