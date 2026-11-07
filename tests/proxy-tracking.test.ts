import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

const origin = 'https://starpyramids.com'
const eligibility = 'x-middleware-request-x-sp-tracking-eligible'

afterEach(() => vi.unstubAllEnvs())

describe('measurement document boundary', () => {
  it('derives eligibility from the real request and overwrites a client-supplied marker', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = proxy(new NextRequest(`${origin}/admin?tab=users`, {
      headers: { cookie: 'sp_session=fake', 'x-sp-tracking-eligible': '1', 'x-sp-path': '/trips' },
    }))
    expect(response.headers.get(eligibility)).toBe('0')
    expect(response.headers.get('x-middleware-request-x-sp-path')).toBe('/admin?tab=users')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    const publicResponse = proxy(new NextRequest(`${origin}/trips?page=2`, {
      headers: { 'x-sp-tracking-eligible': '0' },
    }))
    expect(publicResponse.headers.get(eligibility)).toBe('1')
  })

  it.each(['/account', '/login', '/booking/private', '/checkout', '/search?q=private', '/trips?token=private'])(
    'returns a document fallback instead of Flight data for %s', async path => {
      vi.stubEnv('NODE_ENV', 'production')
      const url = new URL(path, origin)
      url.searchParams.set('_rsc', 'transport')
      const response = proxy(new NextRequest(url, { headers: { rsc: '1', referer: `${origin}/trips` } }))
      expect(response.status).toBe(204)
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect(response.headers.get('x-middleware-next')).toBeNull()
      expect(await response.text()).toBe('')
    },
  )

  it('allows public Flight navigation and requires a fresh document after a no-referrer page', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const target = `${origin}/trips?page=2&_rsc=transport`
    const publicFlight = proxy(new NextRequest(target, { headers: { rsc: '1', referer: `${origin}/` } }))
    expect(publicFlight.headers.get('x-middleware-next')).toBe('1')
    expect(publicFlight.headers.get(eligibility)).toBe('1')
    expect(proxy(new NextRequest(target, { headers: { rsc: '1' } })).status).toBe(204)
    expect(proxy(new NextRequest(`${origin}/trips?_rsc=untrusted`)).headers.get(eligibility)).toBe('0')
  })

  it('keeps production builds on nonproduction hosts unmeasured', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = proxy(new NextRequest('http://localhost:3000/trips', { headers: { 'x-sp-tracking-eligible': '1' } }))
    expect(response.headers.get(eligibility)).toBe('0')
    expect(response.headers.get('x-middleware-next')).toBe('1')
    vi.stubEnv('NODE_ENV', 'development')
    expect(proxy(new NextRequest(`${origin}/trips`)).headers.get(eligibility)).toBe('0')
  })

  it('still redirects unauthenticated private document requests', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = proxy(new NextRequest(`${origin}/account?tab=profile`))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login?next=%2Faccount%3Ftab%3Dprofile')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })
})
