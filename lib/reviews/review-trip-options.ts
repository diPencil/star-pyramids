import type { EnabledLocale } from '../i18n/locale-config'

export type ReviewTripChoice = { slug: string; title: string; category: string }
export const REVIEW_TRIP_TYPES = ['one-day-tours', 'multi-days-tours', 'nile-cruises', 'shore-excursions'] as const
const labels: Record<EnabledLocale, Record<string, string>> = {
  en: { all: 'All types', 'one-day-tours': 'One Day Tours', 'multi-days-tours': 'Multi Days Tours', 'nile-cruises': 'Nile Cruises', 'shore-excursions': 'Shore Excursions', unknown: 'Tour type unavailable' },
  es: { all: 'Todos los tipos', 'one-day-tours': 'Excursiones de un día', 'multi-days-tours': 'Viajes de varios días', 'nile-cruises': 'Cruceros por el Nilo', 'shore-excursions': 'Excursiones desde el puerto', unknown: 'Tipo de viaje no disponible' },
  it: { all: 'Tutti i tipi', 'one-day-tours': 'Escursioni di un giorno', 'multi-days-tours': 'Viaggi di più giorni', 'nile-cruises': 'Crociere sul Nilo', 'shore-excursions': 'Escursioni dal porto', unknown: 'Tipo di viaggio non disponibile' },
}
export function reviewTripTypeLabel(category: string, locale: string) {
  const copy = labels[locale === 'es' || locale === 'it' ? locale : 'en']
  return copy[category] ?? copy.unknown
}
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
export function filterReviewTrips(tours: readonly ReviewTripChoice[], query: string, category: string, locale: string) {
  const search = normalize(query)
  return tours.filter(tour => (category === 'all' || tour.category === category) && normalize(`${tour.title} ${tour.slug} ${reviewTripTypeLabel(tour.category, locale)}`).includes(search))
}
