import { sanitizeLocale, type Locale } from './locale-config'

const copy: Record<string, [string, string]> = {
  'All reviews': ['Todas las reseñas', 'Tutte le recensioni'],
  'Reviews': ['Reseñas', 'Recensioni'], 'Review': ['Reseña', 'Recensione'],
  'Pending': ['Pendientes', 'In attesa'], 'Published': ['Publicadas', 'Pubblicate'], 'Rejected': ['Rechazadas', 'Rifiutate'], 'All': ['Todas', 'Tutte'],
  'Website reviews': ['Reseñas del sitio', 'Recensioni del sito'], 'Trip reviews': ['Reseñas de viajes', 'Recensioni dei viaggi'],
  'Website review': ['Reseña del sitio', 'Recensione del sito'], 'Trip unavailable': ['Viaje no disponible', 'Viaggio non disponibile'],
  'Review source': ['Origen de la reseña', 'Origine recensione'], 'Customer': ['Cliente', 'Cliente'], 'Rating': ['Valoración', 'Valutazione'], 'Status': ['Estado', 'Stato'], 'Submitted': ['Enviada', 'Inviata'],
  'Loading reviews…': ['Cargando reseñas…', 'Caricamento recensioni…'], 'Could not load reviews': ['No se pudieron cargar las reseñas', 'Impossibile caricare le recensioni'],
  'No reviews found': ['No se encontraron reseñas', 'Nessuna recensione trovata'], 'Try changing the search or filters.': ['Prueba a cambiar la búsqueda o los filtros.', 'Prova a cambiare ricerca o filtri.'],
  'Publish': ['Publicar', 'Pubblica'], 'Reject': ['Rechazar', 'Rifiuta'], 'Return to pending': ['Volver a pendientes', 'Rimetti in attesa'], 'View details': ['Ver detalles', 'Vedi dettagli'],
  'Review content': ['Contenido de la reseña', 'Contenuto recensione'], 'Moderation': ['Moderación', 'Moderazione'], 'Back to reviews': ['Volver a reseñas', 'Torna alle recensioni'],
  'View website': ['Ver sitio', 'Vedi sito'], 'View tour page': ['Ver viaje', 'Vedi viaggio'], 'Awaiting moderation': ['Pendiente de moderación', 'In attesa di moderazione'],
  'Confirm': ['Confirmar', 'Conferma'], 'Cancel': ['Cancelar', 'Annulla'], 'Retry': ['Reintentar', 'Riprova'],
  'Publish this review?': ['¿Publicar esta reseña?', 'Pubblicare questa recensione?'], 'Reject this review?': ['¿Rechazar esta reseña?', 'Rifiutare questa recensione?'], 'Return to pending?': ['¿Volver a pendientes?', 'Rimettere in attesa?'],
  'Review published.': ['Reseña publicada.', 'Recensione pubblicata.'], 'Review rejected.': ['Reseña rechazada.', 'Recensione rifiutata.'], 'Review returned to pending.': ['Reseña pendiente de moderación.', 'Recensione rimessa in attesa.'],
  'Search customer, tour or text...': ['Buscar cliente, viaje o texto...', 'Cerca cliente, viaggio o testo...'],
  'Moderate website and trip reviews': ['Moderar reseñas del sitio y de viajes', 'Modera recensioni del sito e dei viaggi'],
}
export function reviewText(text: string, locale: Locale) {
  const safe = sanitizeLocale(locale)
  return safe === 'es' ? copy[text]?.[0] ?? text : safe === 'it' ? copy[text]?.[1] ?? text : text
}
