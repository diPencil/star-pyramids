import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const memory = vi.hoisted(() => ({ assets: new Map<string, Record<string, unknown>>(), authorized: true }))
vi.mock('@/lib/server/db', () => ({ db: { mediaAsset: {
  count: async () => 0,
  create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: 'asset-' + memory.assets.size, publicId: 'public-' + memory.assets.size }; memory.assets.set(String(data.storageKey), row); return row },
  findUnique: async ({ where }: { where: { storageKey: string } }) => memory.assets.get(where.storageKey) ?? null,
} } }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => memory.authorized ? { id: 'isolated-staff' } : null, hasPermission: () => true }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => true }))
import { POST } from '@/app/api/admin/website-cms/hero-media/route'
import { GET as imageGET } from '@/app/media/[...path]/route'
import { GET as videoGET } from '@/app/gallery-videos/[...path]/route'
let root: string
beforeAll(async () => { root = await mkdtemp(path.join(tmpdir(), 'sp-cms-media-')); vi.stubEnv('MEDIA_STORAGE_DIR', root) })
afterAll(async () => {
  vi.unstubAllEnvs()
  // Only the unique directory allocated by this test may be removed.
  if (root && path.dirname(root) === path.resolve(tmpdir()) && path.basename(root).startsWith('sp-cms-media-')) await rm(root, { recursive: true, force: true })
})
beforeEach(() => { memory.assets.clear(); memory.authorized = true })
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/5+hHgAAXolJLoIAAAAASUVORK5CYII=', 'base64')
// Transport/signature fixture, not a claim of playable video or codec validation.
const mp4 = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109, 109, 112, 52, 50])
function upload(bytes: Buffer, type: 'image' | 'video', name: string, mime: string) {
  const form = new FormData(); form.set('type', type); form.set('file', new File([new Uint8Array(bytes)], name, { type: mime }))
  return POST(new Request('https://example.test/api/admin/website-cms/hero-media', { method: 'POST', body: form }))
}
describe('real CMS upload and retrieval with disposable filesystem and mocked DB', () => {
  it.each([['image', 'image.png', 'image/png', png], ['video', 'video.mp4', 'video/mp4', mp4]] as const)('%s round-trips exact bytes and stored reference', async (type, name, mime, bytes) => {
    const response = await upload(bytes, type, name, mime)
    expect(response.status).toBe(201)
    const { media } = await response.json()
    expect(memory.assets.size).toBe(1)
    const segments = media.url.split('/').slice(2)
    const get = type === 'image' ? imageGET : videoGET
    const result = await get(new Request('https://example.test' + media.url), { params: Promise.resolve({ path: segments }) })
    expect(result.status).toBe(200)
    expect(result.headers.get('content-type')).toBe(mime)
    expect(result.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes)
    if (type === 'video') {
      const tail = await videoGET(new Request('https://example.test' + media.url, { headers: { range: 'bytes=-4' } }), { params: Promise.resolve({ path: segments }) })
      expect(tail.status).toBe(206)
      expect(tail.headers.get('content-range')).toBe('bytes 20-23/24')
      expect(Buffer.from(await tail.arrayBuffer())).toEqual(bytes.subarray(-4))
    }
  })
  it('rejects unsigned bytes and unauthorized uploads before persistence', async () => {
    expect((await upload(Buffer.from('not an image'), 'image', 'bad.png', 'image/png')).status).toBe(400)
    expect((await upload(Buffer.from('not a video'), 'video', 'bad.mp4', 'video/mp4')).status).toBe(400)
    memory.authorized = false
    expect((await upload(png, 'image', 'image.png', 'image/png')).status).toBe(401)
    expect(memory.assets.size).toBe(0)
  })
})
