import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), tour: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ db: { $queryRaw: m.query, $executeRaw: m.execute, $transaction: m.transaction, tour: { findUnique: m.tour } } }))
import { listPublishedGallery, listTourGalleryItems, publishGalleryItem, reorderGalleryItems } from '@/lib/server/journey-gallery'
const row = (id: string, sortOrder: number) => ({ id, mediaType: 'VIDEO', mediaUrl: '/clip.mp4', title: `Actual ${id}`, titleAr: null, caption: 'Saved caption', thumbnail: null, showOnHomepage: true, showOnTours: true, tourScope: 'SELECTED_TOURS', platform: 'direct', isPublished: true, sortOrder, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') })
beforeEach(() => { vi.clearAllMocks(); m.query.mockResolvedValue([row('later', 20), row('first', 10)]); m.tour.mockResolvedValue({ status: 'published' }); m.execute.mockResolvedValue(1); m.transaction.mockImplementation(async callback => callback({ $queryRaw: m.query, $executeRaw: m.execute })) })
it('filters eligible homepage records in SQL and returns sorted items without private assignments', async () => {
  const result = await listPublishedGallery()
  expect(m.query.mock.calls[0][0].join(' ')).toContain('i.isPublished = 1 AND i.showOnHomepage = 1')
  expect(result.map(item => item.id)).toEqual(['first', 'later']); expect(result.every(item => item.tourSlugs.length === 0)).toBe(true)
  expect(result[0].caption).toBe('Saved caption'); expect(m.execute).not.toHaveBeenCalled()
})
it('never resolves gallery data for unpublished or missing tours', async () => {
  m.tour.mockResolvedValueOnce({ status: 'draft' }).mockResolvedValueOnce(null)
  expect(await listTourGalleryItems('hidden')).toEqual([]); expect(await listTourGalleryItems('deleted')).toEqual([]); expect(m.query).not.toHaveBeenCalled()
})
it('filters published tour videos and exposes only the requested association', async () => {
  const result = await listTourGalleryItems('public-trip')
  expect(m.query.mock.calls[0][0].join(' ')).toContain("i.mediaType = 'VIDEO' AND i.isPublished = 1 AND i.showOnTours = 1")
  expect(result[0].tourSlugs).toEqual(['public-trip']); expect(result.map(item => item.id)).toEqual(['first', 'later'])
})
it('publishes narrowly without touching media fields, captions or files', async () => {
  m.query.mockResolvedValueOnce([row('item', 1)]).mockResolvedValueOnce([])
  await publishGalleryItem('item', false)
  const statement = m.execute.mock.calls[0][0].join(' ')
  expect(statement).toContain('SET isPublished ='); expect(statement).not.toMatch(/mediaUrl|caption|title|DELETE/)
})
it('rejects invalid/duplicate reorder before any write and rejects missing IDs inside the transaction', async () => {
  await expect(reorderGalleryItems([{ id: 'same', sortOrder: 1 }, { id: 'same', sortOrder: 2 }])).rejects.toThrow()
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.execute).not.toHaveBeenCalled()
  m.query.mockResolvedValueOnce([])
  await expect(reorderGalleryItems([{ id: 'missing', sortOrder: 1 }])).rejects.toThrow('Refresh')
  expect(m.execute).not.toHaveBeenCalled()
})
it('locks items before committing an atomic valid reorder', async () => {
  m.query.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
  await reorderGalleryItems([{ id: 'b', sortOrder: 10 }, { id: 'a', sortOrder: 20 }])
  expect(m.query.mock.calls[0][0].join(' ')).toContain('ORDER BY id FOR UPDATE')
  expect(m.transaction).toHaveBeenCalledTimes(1); expect(m.execute).toHaveBeenCalledTimes(2)
})
