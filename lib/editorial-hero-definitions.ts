import { originalFaqHero, publicFaqHero, validateFaqHero, type FaqHero, type FaqHeroState, type PublicFaqHero } from './faq-hero'
import { isInformationPageId, originalInformationPage } from './information-pages'
import { HeroValidationError } from './website-heroes'

export const EDITORIAL_HERO_IDS = ['faq', 'destinations', 'guide', 'accessible'] as const
export type EditorialHeroId = typeof EDITORIAL_HERO_IDS[number]
export function isEditorialHeroId(value: string): value is EditorialHeroId { return EDITORIAL_HERO_IDS.some((id) => id === value) }
export const EDITORIAL_HERO_PAGES = {
  faq: { name: 'FAQ', route: '/faq' },
  destinations: { name: 'Destinations', route: '/destinations' },
  guide: { name: 'Egypt travel guide', route: '/egypt-travel-guide' },
  accessible: { name: 'Accessible travel', route: '/accessible-travel' },
} as const
export function originalEditorialHero(id: EditorialHeroId): FaqHero {
  if (id === 'faq') return originalFaqHero()
  if (isInformationPageId(id)) return originalInformationPage(id)
  return {
    text: {
      en: { eyebrow: 'See the full picture', heading: 'Every destination tells a different Egypt story', description: 'Build a trip around the places that make you curious, from ancient capitals to salt-white deserts and coral-blue seas.', action: 'Build my route', alt: '' },
      es: { eyebrow: 'Mira el panorama completo', heading: 'Cada destino cuenta una historia distinta de Egipto', description: 'Crea un viaje en torno a los lugares que despierten tu curiosidad, desde capitales antiguas hasta desiertos blancos y mares de coral.', action: 'Crea mi ruta', alt: '' },
      it: { eyebrow: 'Guarda il quadro completo', heading: "Ogni destinazione racconta una storia diversa dell'Egitto", description: 'Costruisci un viaggio intorno ai luoghi che accendono la tua curiosità, dalle antiche capitali ai deserti bianchi e ai mari corallini.', action: 'Crea il mio itinerario', alt: '' },
    }, image: desertImage, href: '/make-your-trip',
  }
}
const desertImage = 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=85'

export function validateEditorialHero(id: EditorialHeroId, input: unknown): FaqHero {
  const content = validateFaqHero(input)
  if (isInformationPageId(id) !== (content.sections !== undefined)) throw new HeroValidationError('Check the supported page sections.')
  return content
}

export function publicEditorialHero(id: EditorialHeroId, state: FaqHeroState): PublicFaqHero {
  if (state.mode === 'original') return { hidden: false, content: originalEditorialHero(id) }
  // Hiding the hero must not restore removed or unpublished page sections.
  if (isInformationPageId(id) && state.mode === 'hidden') return { hidden: true, content: state.published ?? originalEditorialHero(id) }
  return publicFaqHero(state)
}
