import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateReviewConfig, safeProviderUrl } from '@/lib/review-integrations'
import { sealReviewSecret, openReviewSecret } from '@/lib/server/review-credentials'
import { fetchReviewProvider } from '@/lib/server/review-providers'
const config = { enabled: true, resourceId: 'ChIJexample', profileUrl: '', widgetId: '' }
beforeEach(() => { vi.stubEnv('REVIEW_INTEGRATIONS_KEY', 'a'.repeat(64)) })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('Review integration boundaries', () => {
  it('validates canonical configuration and preserves disabled state', () => { expect(validateReviewConfig({ ...config, enabled: false }, 'google').enabled).toBe(false) })
  it.each([null, [], {}, { ...config, enabled: 'true' }, { ...config, extra: 'x' }])('rejects malformed configuration %j', v => { expect(() => validateReviewConfig(v, 'google')).toThrow() })
  it.each(['javascript:alert(1)', 'https://www.google.com.evil.test/', 'https://user:pass@google.com/', 'http://google.com/', 'https://127.0.0.1/'])('rejects unsafe profile URLs %s', u => { expect(safeProviderUrl(u, 'google')).toBe('') })
  it('rejects arbitrary widget HTML', () => { expect(() => validateReviewConfig({ ...config, widgetId: '<script>alert(1)</script>' }, 'trustindex')).toThrow() })
  it('requires a numeric Tripadvisor location', () => { expect(() => validateReviewConfig(config, 'tripadvisor')).toThrow() })
  it('authenticates encrypted credentials, including provider binding', () => {
    const encrypted = sealReviewSecret('private-provider-key', 'google')
    expect(encrypted).not.toContain('private-provider-key'); expect(openReviewSecret(encrypted, 'google')).toBe('private-provider-key')
    expect(() => openReviewSecret(encrypted, 'tripadvisor')).toThrow()
    expect(() => openReviewSecret(encrypted.slice(0, -5) + 'abcd', 'google')).toThrow()
  })
  it('fails closed without a server encryption key', () => { vi.stubEnv('REVIEW_INTEGRATIONS_KEY', ''); expect(() => sealReviewSecret('key', 'google')).toThrow() })
  it('does not make outbound calls without credentials', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect((await fetchReviewProvider('google', config, '')).state).toBe('not_connected'); expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps widget configuration distinct from a verified connection', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect((await fetchReviewProvider('trustindex', { ...config, widgetId: 'aabbccdd11223344' }, '')).state).toBe('widget_configured')
    expect((await fetchReviewProvider('getyourguide', config, '')).state).toBe('partner_access_required'); expect(fetch).not.toHaveBeenCalled()
  })
  it('normalizes live Google attribution and real rating/count without inventing reviews', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 'ChIJexample', rating: 4.2, userRatingCount: 17, googleMapsUri: 'https://maps.google.com/?cid=123', reviews: [{ name: 'r1', rating: 4, text: { text: 'Actual provider review' }, publishTime: '2026-01-01', authorAttribution: { displayName: 'Traveler', uri: 'https://www.google.com/maps/contrib/123' } }] }))
    vi.stubGlobal('fetch', fetch)
    const feed = await fetchReviewProvider('google', config, 'private-key')
    expect(feed.average).toBe(4.2); expect(feed.count).toBe(17); expect(feed.reviews[0].author).toBe('Traveler'); expect(JSON.stringify(feed)).not.toContain('private-key')
    expect(fetch.mock.calls[0][0]).toMatch(/^https:\/\/places.googleapis.com\//); expect(fetch.mock.calls[0][1].cache).toBe('no-store'); expect(fetch.mock.calls[0][1].redirect).toBe('error')
  })
  it('does not fabricate five stars when a provider has no ratings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id: 'place' })))
    const feed = await fetchReviewProvider('google', config, 'key'); expect(feed.average).toBeNull(); expect(feed.count).toBeNull(); expect(feed.reviews).toEqual([])
  })
  it('sanitizes upstream errors without echoing key or response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private-key internal details', { status: 403 })))
    await expect(fetchReviewProvider('google', config, 'private-key')).rejects.toThrow('Provider rejected access.')
  })
  it('handles empty and non-JSON provider responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(''))); await expect(fetchReviewProvider('google', config, 'key')).rejects.toThrow('invalid JSON')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>unavailable</html>'))); await expect(fetchReviewProvider('google', config, 'key')).rejects.toThrow('invalid JSON')
  })
  it('uses official Tripadvisor endpoints and keeps original review links and ratings', async () => {
    const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes('/details') ? { location_id: '123', rating: '4.5', num_reviews: '15', web_url: 'https://www.tripadvisor.com/Attraction_Review-d123' } : { data: [{ id: 'r', rating: 4, text: 'Provider text', user: { username: 'Visitor' }, url: 'https://www.tripadvisor.com/ShowUserReviews-d123' }] })))
    vi.stubGlobal('fetch', fetch)
    const feed = await fetchReviewProvider('tripadvisor', { ...config, resourceId: '123' }, 'secret'); expect(feed.average).toBe(4.5); expect(feed.count).toBe(15); expect(feed.reviews[0].url).toContain('ShowUserReviews'); expect(fetch).toHaveBeenCalledTimes(2)
  })
})
