import { expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { catalogueBotReply } from '@/lib/server/live-chat-catalogue'
import { baseChipHrefs, botMessageParts, copy } from '@/lib/live-chat-bot'

function catalogue() {
  const findMany = vi.fn().mockResolvedValue([])
  return { findMany, client: { tour: { findMany } } as unknown as Pick<Prisma.TransactionClient, 'tour'> }
}
const trip = { slug: 'cairo-discovery', title: 'Cairo Discovery', location: 'Cairo', duration: '1 day', status: 'published' }

it('reads fresh published trips and changes its answers when the catalogue changes', async () => {
  const { findMany, client } = catalogue()
  findMany.mockResolvedValueOnce([trip]).mockResolvedValueOnce([{ ...trip, slug: 'new-aswan-trip', title: 'New Aswan Trip' }])
  expect(await catalogueBotReply('All trips', 'en', client)).toContain('/egypt-tours/cairo-discovery')
  const next = await catalogueBotReply('All trips', 'en', client)
  expect(next).toContain('New Aswan Trip')
  expect(next).not.toContain('Cairo Discovery')
  expect(findMany).toHaveBeenCalledTimes(2)
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'published' }, take: 6,
    select: { slug: true, title: true, location: true, duration: true, status: true } }))
})

it('excludes draft and unsafe links even if a data adapter returns them', async () => {
  const { findMany, client } = catalogue()
  findMany.mockResolvedValue([trip, { ...trip, title: 'Private Draft', status: 'draft' }, { ...trip, title: 'Unsafe', slug: 'private?token=secret' }])
  const reply = await catalogueBotReply('All trips', 'en', client)
  expect(reply).toContain('Cairo Discovery')
  expect(reply).not.toMatch(/Private Draft|Unsafe|secret|token/)
})

it('searches live titles/locations with bounded parameters and filters Nile requests only when requested', async () => {
  const { findMany, client } = catalogue()
  await catalogueBotReply('Cairo tours', 'en', client)
  expect(findMany.mock.calls[0][0].where).toEqual({ status: 'published', OR: [{ title: { contains: 'cairo' } }, { location: { contains: 'cairo' } }, { slug: { contains: 'cairo' } }] })
  await catalogueBotReply('Nile cruises', 'en', client)
  expect(findMany.mock.calls[1][0].where).toEqual({ status: 'published', category: 'nile-cruises' })
})
it.each(['Do you have any tours?', 'Quiero ver los viajes disponibles', 'Vorrei vedere tutti i viaggi disponibili'])('does not mistake common catalogue phrasing for a product name: %s', async question => {
  const { findMany, client } = catalogue()
  await catalogueBotReply(question, 'en', client)
  expect(findMany.mock.calls[0][0].where).toEqual({ status: 'published' })
})
it.each([['day tours', 'one-day-tours'], ['multi-day trips', 'multi-days-tours'], ['shore excursions', 'shore-excursions']] as const)('looks up the requested public category for %s', async (question, category) => {
  const { findMany, client } = catalogue()
  await catalogueBotReply(question, 'en', client)
  expect(findMany.mock.calls[0][0].where).toEqual({ status: 'published', category })
})

it.each([['en', 'All trips', 'currently published'], ['es', 'Todos los viajes', 'publicados actualmente'], ['it', 'Tutti i viaggi', 'attualmente pubblicati']] as const)('localizes %s catalogue guidance without fabricating prices', async (locale, question, phrase) => {
  const { findMany, client } = catalogue(); findMany.mockResolvedValue([trip])
  const reply = await catalogueBotReply(question, locale, client)
  expect(reply).toContain(phrase)
  expect(reply).toContain('Cairo Discovery')
  expect(reply).not.toMatch(/\$|4 cruise levels|full board|USD/)
  expect(copy[locale].chipLabels.prices).toBe(question)
  expect(baseChipHrefs.browse).toBe('/trips')
})

it('does not substitute static products on an empty or failing catalogue, and never echoes database errors', async () => {
  const { findMany, client } = catalogue()
  expect(await catalogueBotReply('All trips', 'en', client)).toContain('could not find')
  findMany.mockRejectedValue(Error('SELECT database-secret'))
  const reply = await catalogueBotReply('price', 'en', client)
  expect(reply).toContain('could not load')
  expect(reply).not.toMatch(/SELECT|secret|Standard|Luxury/)
})

it('keeps booking/handoff guidance independent of catalogue availability', async () => {
  const { findMany, client } = catalogue()
  expect(await catalogueBotReply('book', 'en', client)).toBe(copy.en.booking)
  expect(await catalogueBotReply('agent', 'en', client)).toBe(copy.en.human)
  expect(findMany).not.toHaveBeenCalled()
})

it('renders only stand-alone canonical public bot paths as links', () => {
  const parts = botMessageParts('Tour\n/egypt-tours/cairo-discovery\n/trips https://evil.example/egypt-tours/cairo /booking/secret /egypt-tours/cairo?token=secret javascript:alert(1)')
  expect(parts.filter(part => part.href).map(part => part.href)).toEqual(['/egypt-tours/cairo-discovery', '/trips'])
})
