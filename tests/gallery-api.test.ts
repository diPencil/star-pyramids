import { beforeEach, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ user: vi.fn(), permission: vi.fn(), homepage: vi.fn(), tours: vi.fn(), list: vi.fn(), choices: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), publish: vi.fn(), remove: vi.fn(), reorder: vi.fn(), upload: vi.fn(), video: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: m.user, hasPermission: m.permission }))
vi.mock('@/lib/server/journey-gallery', () => ({ GalleryValidationError: class extends Error {}, GalleryNotFoundError: class extends Error {}, listPublishedGallery: m.homepage, listTourGalleryItems: m.tours, listGalleryItems: m.list, listGalleryTourChoices: m.choices, getGalleryItem: m.get, createGalleryItem: m.create, updateGalleryItem: m.update, publishGalleryItem: m.publish, deleteGalleryItem: m.remove, reorderGalleryItems: m.reorder }))
vi.mock('@/lib/server/media', () => ({ MediaUploadError: class extends Error {}, checkMediaUploadRateLimit: m.limit, storeUploadedImage: m.upload, maxUploadBytes: () => 5 * 1024 * 1024 }))
vi.mock('@/lib/server/journey-video-storage', () => ({ VideoUploadError: class extends Error {}, storeUploadedVideo: m.video }))
import { GET, POST } from '@/app/api/journey-gallery/route'
import { GET as one, PUT, PATCH, DELETE } from '@/app/api/journey-gallery/[id]/route'
import { POST as reorder } from '@/app/api/journey-gallery/reorder/route'
import { POST as upload } from '@/app/api/media/route'
import { GalleryValidationError } from '@/lib/server/journey-gallery'
const url = 'http://localhost:3000/api/journey-gallery'
const params = { params: Promise.resolve({ id: 'item-id' }) }
const request = (method: string, body: unknown, origin = 'http://localhost:3000') => new Request(url, { method, headers: { host: 'localhost:3000', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks(); m.user.mockResolvedValue({ id: 'staff' }); m.permission.mockReturnValue(true)
  m.homepage.mockResolvedValue([]); m.list.mockResolvedValue([]); m.tours.mockResolvedValue([]); m.choices.mockResolvedValue([{ slug: 'tour', title: 'Actual tour' }]); m.get.mockResolvedValue({ id: 'item-id' }); m.create.mockResolvedValue({ id: 'item-id' }); m.update.mockResolvedValue({ id: 'item-id' }); m.publish.mockResolvedValue({ id: 'item-id' }); m.remove.mockResolvedValue(undefined); m.reorder.mockResolvedValue(undefined)
  m.limit.mockResolvedValue({ allowed: true }); m.upload.mockResolvedValue({ url: '/media/test.jpg' }); m.video.mockResolvedValue({ url: '/gallery-videos/test.mp4' })
})
it('rejects an oversized upload before multipart parsing or storage', async () => {
  const result = await upload(new Request('http://localhost:3000/api/media', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-length': '999999999' }, body: 'not multipart' }))
  expect(result.status).toBe(413)
  expect(m.upload).not.toHaveBeenCalled(); expect(m.video).not.toHaveBeenCalled()
})
it('serves public feeds without invoking staff listing or exposing draft records', async () => {
  m.user.mockResolvedValue(null)
  expect((await GET(new Request(url))).status).toBe(200)
  expect(m.homepage).toHaveBeenCalledTimes(1); expect(m.list).not.toHaveBeenCalled()
  await GET(new Request(url + '?tour=published-tour')); expect(m.tours).toHaveBeenCalledWith('published-tour')
  expect((await GET(new Request(url + '?tour=' + 'a'.repeat(81)))).status).toBe(400)
})
it('protects listing, choices, editor reads and every mutation', async () => {
  m.user.mockResolvedValue(null)
  expect((await GET(new Request(url + '?admin=1'))).status).toBe(401)
  expect((await GET(new Request(url + '?tourChoices=1'))).status).toBe(401)
  expect((await one(new Request(url), params)).status).toBe(401)
  expect((await POST(request('POST', {}))).status).toBe(401)
  expect((await PUT(request('PUT', {}), params)).status).toBe(401)
  expect((await PATCH(request('PATCH', { isPublished: true }), params)).status).toBe(401)
  expect((await DELETE(request('DELETE', {}), params)).status).toBe(401)
  expect((await reorder(request('POST', {}))).status).toBe(401)
  expect(m.create).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled()
})
it('requires gallery-specific permissions and same-origin writes', async () => {
  m.permission.mockReturnValue(false)
  expect((await POST(request('POST', {}))).status).toBe(403)
  expect((await GET(new Request(url + '?tourChoices=1'))).status).toBe(403)
  expect((await PATCH(request('PATCH', { isPublished: true }), params)).status).toBe(403)
  m.permission.mockReturnValue(true)
  expect((await PUT(request('PUT', {}, 'https://evil.example'), params)).status).toBe(403)
  expect((await DELETE(request('DELETE', {}, 'https://evil.example'), params)).status).toBe(403)
  expect(m.update).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled()
})
it('gives gallery managers minimal tour choices without requiring tours.view', async () => {
  m.permission.mockImplementation((_user, permission) => permission === 'gallery.edit')
  const result = await GET(new Request(url + '?tourChoices=1'))
  expect(result.status).toBe(200); expect(await result.json()).toEqual({ tours: [{ slug: 'tour', title: 'Actual tour' }] }); expect(result.headers.get('cache-control')).toContain('private')
})
it.each([null, [], { isPublished: 'false' }, { isPublished: true, title: 'overwrite' }])('rejects invalid visibility patch %j', async body => {
  expect((await PATCH(request('PATCH', body), params)).status).toBe(400); expect(m.publish).not.toHaveBeenCalled()
})
it('changes visibility without submitting or replacing reviewable media content', async () => {
  expect((await PATCH(request('PATCH', { isPublished: false }), params)).status).toBe(200)
  expect(m.publish).toHaveBeenCalledWith('item-id', false); expect(m.update).not.toHaveBeenCalled()
})
it('retains create/edit/delete and safe validation error contracts', async () => {
  expect((await POST(request('POST', { title: 'Existing fixture' }))).status).toBe(201)
  expect((await PUT(request('PUT', { title: 'Edited fixture' }), params)).status).toBe(200)
  expect((await DELETE(request('DELETE', {}), params)).status).toBe(200)
  m.create.mockRejectedValueOnce(new GalleryValidationError('This media is already in the gallery.'))
  expect((await POST(request('POST', {}))).status).toBe(409)
})
it('permits image and video uploads for gallery-only editors using existing storage', async () => {
  m.permission.mockImplementation((_user, permission) => permission === 'gallery.edit')
  for (const scope of ['catalogue', 'gallery-video']) {
    const form = new FormData(); form.set('scope', scope); form.set('file', new File(['fixture'], scope === 'catalogue' ? 'image.jpg' : 'video.mp4'))
    const result = await upload(new Request('http://localhost:3000/api/media', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, body: form }))
    expect(result.status).toBe(201)
  }
  expect(m.upload).toHaveBeenCalledTimes(1); expect(m.video).toHaveBeenCalledTimes(1)
})
