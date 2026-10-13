import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ user: { id: 'staff' } as { id: string } | null, allowed: true, origin: true, video: vi.fn(), image: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => mock.user, hasPermission: () => mock.allowed }))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: () => mock.origin }))
vi.mock('@/lib/server/media', () => ({ checkMediaUploadRateLimit: async () => ({ allowed: true }), storeUploadedImage: mock.image, MediaUploadError: class extends Error {} }))
vi.mock('@/lib/server/journey-video-storage', () => ({ storeUploadedVideo: mock.video, VideoUploadError: class extends Error {} }))
import { POST } from '@/app/api/admin/website-cms/hero-media/route'
import { MAX_HERO_VIDEO_BYTES } from '@/lib/website-heroes'
beforeEach(() => { mock.user = { id: 'staff' }; mock.allowed = true; mock.origin = true; mock.video.mockReset().mockResolvedValue({ url: '/gallery-videos/example.mp4' }); mock.image.mockReset().mockResolvedValue({ url: '/media/example.jpg' }) })
describe('CMS media boundary with no filesystem writes', () => {
  it('requires edit permission before parsing an upload', async () => {
    mock.allowed = false
    expect((await POST(new Request('https://example.com', { method: 'POST' }))).status).toBe(403)
    expect(mock.video).not.toHaveBeenCalled()
  })
  it('rejects unsupported MIME/extension before invoking storage', async () => {
    const data = new FormData(); data.set('type', 'video'); data.set('file', new File(['abc'], 'bad.html', { type: 'text/html' }))
    expect((await POST(new Request('https://example.com', { method: 'POST', body: data }))).status).toBe(400)
    expect(mock.video).not.toHaveBeenCalled()
  })
  it('uses the explicit bounded hero limit rather than changing gallery limits', async () => {
    const data = new FormData(); data.set('type', 'video'); data.set('file', new File(['fake fixture; storage mocked'], 'hero.mp4', { type: 'video/mp4' }))
    expect((await POST(new Request('https://example.com', { method: 'POST', body: data }))).status).toBe(201)
    expect(mock.video.mock.calls[0][0].maxBytes).toBe(MAX_HERO_VIDEO_BYTES)
    expect(MAX_HERO_VIDEO_BYTES).toBe(20 * 1024 * 1024)
  })
})
