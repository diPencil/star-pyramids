import { cruiseTypes } from '@/data/tours'

export const CRUISE_HERO_IDS = ['standard-nile-cruises', 'deluxe-nile-cruise', 'superior-nile-cruise', 'luxury-nile-cruise'] as const
export type CruiseHeroId = typeof CRUISE_HERO_IDS[number]
export function isCruiseHeroId(id: string): id is CruiseHeroId { return CRUISE_HERO_IDS.some((value) => value === id) }
export function isCompactHeroId(id: string) { return id === 'trips' || isCruiseHeroId(id) }

function cruiseDefaults(id: CruiseHeroId) {
  const source = cruiseTypes.find((item) => item.slug === id)!
  // Reference definitions retain ownership of original copy; CMS stores overrides.
  return { image: '', links: {}, text: {
    en: { title: source.titleEn, intro: source.descEn, eyebrow: 'Sail in style', stat0: 'Nile itineraries', stat1: 'Cruise options' },
    es: { title: source.titleEn, intro: source.descEn, eyebrow: 'Navega por el Nilo', stat0: 'Itinerarios por el Nilo', stat1: 'Opciones de crucero' },
    it: { title: source.titleEn, intro: source.descEn, eyebrow: 'Naviga sul Nilo', stat0: 'Itinerari sul Nilo', stat1: 'Opzioni di crociera' },
  } }
}
export const compactHeroDefaults = {
  trips: { image: '', links: {}, text: {
    en: { title: 'Find your Egypt trip', intro: 'From one memorable day to a journey across the country. Explore every trip in one place.', eyebrow: 'STAR PYRAMIDS, EGYPT', stat0: 'All trips' },
    es: { title: 'Encuentra tu viaje por Egipto', intro: 'De un día memorable a un viaje por todo el país. Explora todos los viajes en un solo lugar.', eyebrow: 'STAR PYRAMIDS, EGYPT', stat0: 'Todos los viajes' },
    it: { title: 'Trova il tuo viaggio in Egitto', intro: 'Da un giorno memorabile a un viaggio in tutto il paese. Esplora tutti i viaggi in un unico luogo.', eyebrow: 'STAR PYRAMIDS, EGYPT', stat0: 'Tutti i viaggi' },
  } },
  'standard-nile-cruises': cruiseDefaults('standard-nile-cruises'),
  'deluxe-nile-cruise': cruiseDefaults('deluxe-nile-cruise'),
  'superior-nile-cruise': cruiseDefaults('superior-nile-cruise'),
  'luxury-nile-cruise': cruiseDefaults('luxury-nile-cruise'),
}
