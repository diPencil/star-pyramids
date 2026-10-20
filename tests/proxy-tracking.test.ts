import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

describe('tracking path header trust boundary', () => {
  it('overwrites a client-supplied path header from the real request URL', () => {
    const response = proxy(new NextRequest('http://localhost/admin?tab=users', {
      headers: { cookie: 'sp_session=fake', 'x-sp-path': '/trips' },
    }))
    expect(response.headers.get('x-middleware-request-x-sp-path')).toBe('/admin?tab=users')

    const publicResponse = proxy(new NextRequest('http://localhost/trips?page=2', {
      headers: { 'x-sp-path': '/admin' },
    }))
    expect(publicResponse.headers.get('x-middleware-request-x-sp-path')).toBe('/trips?page=2')
  })

  it('still redirects unauthenticated private routes before rendering', () => {
    const response = proxy(new NextRequest('http://localhost/account?tab=profile', {
      headers: { 'x-sp-path': '/' },
    }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login?next=%2Faccount%3Ftab%3Dprofile')
  })
})
