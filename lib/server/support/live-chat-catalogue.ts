import 'server-only'
import type { Prisma } from '@prisma/client'
import { copy, getBotReply } from '@/lib/support/live-chat-bot'
import type { LiveAction } from '@/lib/support/live-chat-contract'

type Language = LiveAction['locale']
const text = {
  en: { heading: 'Here are some currently published trips:', empty: 'I could not find matching published trips. Browse all trips or ask our team for help.', unavailable: 'I could not load the trip catalogue right now. Please browse all trips or contact our team.', detail: 'Open a trip for its current prices, itinerary and options. The final price is confirmed during booking.', all: 'All trips:' },
  es: { heading: 'Estos son algunos de los viajes publicados actualmente:', empty: 'No he encontrado viajes publicados que coincidan. Consulta todos los viajes o pide ayuda a nuestro equipo.', unavailable: 'No he podido cargar el catálogo de viajes. Consulta todos los viajes o contacta con nuestro equipo.', detail: 'Abre un viaje para consultar sus precios, itinerario y opciones actuales. El precio final se confirma al reservar.', all: 'Todos los viajes:' },
  it: { heading: 'Ecco alcuni dei viaggi attualmente pubblicati:', empty: 'Non ho trovato viaggi pubblicati corrispondenti. Consulta tutti i viaggi o chiedi aiuto al nostro team.', unavailable: 'Non riesco a caricare il catalogo dei viaggi. Consulta tutti i viaggi o contatta il nostro team.', detail: 'Apri un viaggio per consultarne prezzi, itinerario e opzioni aggiornati. Il prezzo finale viene confermato durante la prenotazione.', all: 'Tutti i viaggi:' },
} satisfies Record<Language, Record<string, string>>

const stopWords = new Set('all trip trips tour tours price prices pricing cost costs show me the a an in to for of and do you have what which available published current new latest please want looking find about much how your our can tell see visit travel are is there any some would like recommend recommendations per person people day days one multi shore excursion excursions todos todas los las viajes viaje excursiones excursión precios precio mostrar ver por para de del el la en y que qué tienes quiero disponibles disponible nuestros nuestras actuales dia dias un una tutti tutte i gli le viaggi viaggio escursioni escursione prezzi prezzo vedere mostra per di del il lo e che quali avete voglio vorrei disponibili disponibile nostri nostre giorno giorni'.split(' '))
const normalize = (value: string) => value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const safeText = (value: string, limit: number) => value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit)

/** Fresh, bounded, published-only reads. No hardcoded products, prices or LLM. */
export async function catalogueBotReply(question: string, locale: Language, client: Pick<Prisma.TransactionClient, 'tour'>): Promise<string> {
  const fallback = getBotReply(question, locale, '').text
  const t = copy[locale]
  if ([t.greeting, t.booking, t.human, t.thanks].some(answer => answer === fallback)) return fallback
  const normalized = normalize(question)
  const cruise = /\b(cruise|cruises|nile|crucero|cruceros|nilo|crociera|crociere)\b/.test(normalized)
  const category = cruise ? 'nile-cruises' : /\b(shore|port excursion)\b/.test(normalized) ? 'shore-excursions' :
    /\b(multi[- ]?days?|varios dias|piu giorni)\b/.test(normalized) ? 'multi-days-tours' :
    /\b(day tours?|day trips?|un dia|un giorno)\b/.test(normalized) ? 'one-day-tours' : undefined
  const ignored = new Set([...stopWords].map(normalize))
  for (const word of ['cruise', 'cruises', 'nile', 'crucero', 'cruceros', 'nilo', 'crociera', 'crociere']) ignored.add(word)
  for (const word of ['varios', 'piu', 'multiday', 'multidays']) ignored.add(word)
  const terms = [...new Set(normalized.match(/[a-z0-9]{3,40}/g) ?? [])].filter(word => !ignored.has(word)).slice(0, 4)
  const where: Prisma.TourWhereInput = {
    status: 'published', ...(category ? { category } : {}),
    ...(terms.length ? { OR: terms.flatMap(term => [{ title: { contains: term } }, { location: { contains: term } }, { slug: { contains: term } }]) } : {}),
  }
  const labels = text[locale]
  try {
    const tours = await client.tour.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { slug: 'asc' }], take: 6,
      select: { slug: true, title: true, location: true, duration: true, status: true } })
    const visible = tours.filter(tour => tour.status === 'published' && tour.slug.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tour.slug)).slice(0, 5)
    if (!visible.length) return `${labels.empty}\n/trips`
    return `${labels.heading}\n\n${visible.map(tour => `${safeText(tour.title, 160)}${[tour.location, tour.duration].filter(Boolean).length ? ` — ${[tour.location, tour.duration].filter(Boolean).map(v => safeText(v, 100)).join(' · ')}` : ''}\n/egypt-tours/${tour.slug}`).join('\n\n')}\n\n${labels.detail}\n${labels.all} /trips`
  } catch { return `${labels.unavailable}\n/trips` }
}
