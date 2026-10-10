import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ signedIn: false, allowed: false }))
vi.mock('@/lib/server/auth', () => ({ getCurrentUser: async () => auth.signedIn ? { id: 'test-staff' } : null, hasPermission: () => auth.allowed }))
vi.mock('@/lib/server/db', () => ({ db: {} }))
vi.mock('@/lib/server/catalogue-translations', () => ({ catalogueTranslationResponse: vi.fn(), saveWithCatalogueTranslations: vi.fn() }))
import { POST } from '@/app/api/offers/route'
import { PUT, DELETE } from '@/app/api/offers/[slug]/route'
const context = { params: Promise.resolve({ slug: 'existing' }) }
function request(method: string, body?: string, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/offers/existing', { method, body, headers: { host: 'localhost:3000', origin, 'content-type': 'application/json' } })
}
beforeEach(() => { auth.signedIn = false; auth.allowed = false })
describe('Offer mutation security and malformed requests', () => {
  it('requires authentication for every mutation', async () => {
    expect((await POST(request('POST', '{}'))).status).toBe(401)
    expect((await PUT(request('PUT', '{}'), context)).status).toBe(401)
    expect((await DELETE(request('DELETE'), context)).status).toBe(401)
  })
  it('requires the appropriate staff permission', async () => {
    auth.signedIn = true
    expect((await POST(request('POST', '{}'))).status).toBe(403)
    expect((await PUT(request('PUT', '{}'), context)).status).toBe(403)
    expect((await DELETE(request('DELETE'), context)).status).toBe(403)
  })
  it('blocks cross-origin mutations before reading or writing data', async () => {
    auth.signedIn = true; auth.allowed = true
    expect((await POST(request('POST', '{}', 'https://untrusted.example'))).status).toBe(403)
    expect((await PUT(request('PUT', '{}', 'https://untrusted.example'), context)).status).toBe(403)
    expect((await DELETE(request('DELETE', undefined, 'https://untrusted.example'), context)).status).toBe(403)
  })
  it.each(['', 'null', '[1]', '{broken'])('returns JSON 400 for malformed authorized input %s', async body => {
    auth.signedIn = true; auth.allowed = true
    for (const response of [await POST(request('POST', body)), await PUT(request('PUT', body), context)]) {
      expect(response.status).toBe(400)
      expect(await response.json()).toHaveProperty('error')
    }
  })
})
