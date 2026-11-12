import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { openBookingConfirmation, type CheckoutReceipt } from '@/lib/booking/booking-confirmation'
import { bookingConfirmationResponse, confirmationCookieName, readBookingConfirmation } from '@/lib/server/booking/access/booking-confirmation'
import { POST } from '@/app/api/bookings/confirmation/route'
import PublicPage from '@/app/booking-confirmation/page'
import PrivatePage from '@/app/checkout/receipt/page'
import { BookingConfirmation } from '@/components/booking/booking-confirmation'
import { canMeasureLocation } from '@/lib/tracking/tracking'
import { publicPageView } from '@/lib/tracking/tracking-events'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const mocks = vi.hoisted(() => ({ cookie: undefined as string | undefined, user: vi.fn(), locale: 'en' as 'en' | 'es' | 'it' }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => mocks.cookie ? { value: mocks.cookie } : undefined }) }))
vi.mock('next/navigation', async original => ({ ...await original<typeof import('next/navigation')>(), redirect: (path: string) => { throw Error('redirect:' + path) } }))
vi.mock('@/lib/server/auth/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/components/locale', async original => ({ ...await original<typeof import('@/components/locale')>(), useLocale: () => ({ locale: mocks.locale, currency: 'USD' }) }))

const origin = 'https://starpyramids.com'
const secret = 'fixture-confirmation-key-not-used-outside-tests'
const guest: CheckoutReceipt = {
  reference: 'SP-BK-ABC123', total: 305.10, existing: false, linked: false, guest: true,
  email: 'private@example.test', guestAccessUrl: '/booking/' + 'a'.repeat(43),
}
const owner = { id: 'fixture-owner', roles: ['CUSTOMER'] }
const payload = { reference: guest.reference, bookingMeasurement: { event_id: 'bk_' + 'b'.repeat(32) } }
const now = Date.now()

beforeEach(() => { vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('BOOKING_QUOTE_SECRET', secret); mocks.cookie = undefined; mocks.user.mockReset(); mocks.locale = 'en' })
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

async function issue(receipt = guest, cookie?: string, ownerId: string | null = null, time = now) {
  const response = bookingConfirmationResponse(payload, receipt.existing ? 200 : 201, cookie, ownerId, receipt, time)
  const value = response.cookies.get(confirmationCookieName())?.value
  const reply = await response.json()
  const flow = new URL(reply.bookingConfirmationUrl, origin).searchParams.get('flow')!
  return { response, reply, value: value!, flow }
}

it('creates an encrypted, short-lived HttpOnly handoff without exposing private details in its public URL', async () => {
  const result = await issue()
  expect(result.response.status).toBe(201)
  expect(result.reply.bookingMeasurement).toEqual(payload.bookingMeasurement)
  expect(result.reply.bookingConfirmationUrl).toMatch(/^\/booking-confirmation\?flow=[a-f0-9]{32}$/)
  const header = result.response.headers.get('set-cookie')!
  expect(header).toContain('__Host-sp-booking-confirmation=')
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/', 'Max-Age=1800']) expect(header).toContain(flag)
  for (const privateValue of [guest.reference, guest.email, guest.guestAccessUrl!]) expect(result.value).not.toContain(privateValue)
  expect(readBookingConfirmation(result.value, result.flow, now)?.receipt).toEqual(guest)
  expect(readBookingConfirmation(result.value, 'c'.repeat(32), now)).toBeUndefined()
  expect(readBookingConfirmation(result.value, result.flow, now + 1800001)).toBeUndefined()
  expect(readBookingConfirmation(result.value.slice(0, -2) + 'zz', result.flow, now)).toBeUndefined()
  vi.stubEnv('BOOKING_QUOTE_SECRET', 'another-fixture-key-which-is-long-enough')
  expect(readBookingConfirmation(result.value, result.flow, now)).toBeUndefined()
})

it('preserves a matching guest access link on authorized replay and keeps concurrent tabs separate', async () => {
  const first = await issue()
  const replay = await issue({ ...guest, existing: true, total: null, guestAccessUrl: null }, first.value)
  expect(replay.flow).toBe(first.flow)
  expect(replay.response.status).toBe(200)
  expect(readBookingConfirmation(replay.value, first.flow, now)?.receipt.guestAccessUrl).toBe(guest.guestAccessUrl)
  const second = await issue({ ...guest, reference: 'SP-BK-DEF456' }, replay.value)
  expect(readBookingConfirmation(second.value, first.flow, now)?.receipt.reference).toBe(guest.reference)
  expect(readBookingConfirmation(second.value, second.flow, now)?.receipt.reference).toBe('SP-BK-DEF456')
  const third = await issue({ ...guest, reference: 'SP-BK-GHI789' }, second.value)
  const fourth = await issue({ ...guest, reference: 'SP-BK-JKL012' }, third.value)
  expect(fourth.value.length).toBeLessThan(3800)
  expect(readBookingConfirmation(fourth.value, first.flow, now)).toBeUndefined()
  expect(readBookingConfirmation(fourth.value, second.flow, now)).toBeDefined()
})

it('keeps a successful booking successful when signing is unavailable or the handoff data is invalid', async () => {
  for (const key of ['', 'short']) {
    vi.stubEnv('BOOKING_QUOTE_SECRET', key)
    const response = bookingConfirmationResponse(payload, 201, undefined, null, guest)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(payload)
    expect(response.headers.get('set-cookie')).toBeNull()
  }
  vi.stubEnv('BOOKING_QUOTE_SECRET', secret)
  const response = bookingConfirmationResponse(payload, 200, undefined, null, { ...guest, guestAccessUrl: 'https://evil.example' })
  expect(await response.json()).toEqual(payload)
})

it('acknowledges only the matching HttpOnly context and never returns its private fields', async () => {
  const result = await issue()
  const request = (flow: string, requestOrigin = origin, cookie = result.value) => new Request(`${origin}/api/bookings/confirmation`, {
    method: 'POST', headers: { host: 'starpyramids.com', origin: requestOrigin, 'content-type': 'application/json', cookie: `${confirmationCookieName()}=${cookie}` },
    body: JSON.stringify({ flow }),
  })
  // Protected checkout sends no Referer; same-origin POST supplies Origin.
  expect(request(result.flow).headers.get('referer')).toBeNull()
  const response = await POST(request(result.flow))
  expect(await response.json()).toEqual({ ready: true })
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await (await POST(request('c'.repeat(32)))).json()).toEqual({ ready: false })
  expect(await (await POST(request(result.flow, origin, 'tampered'))).json()).toEqual({ ready: false })
  expect((await POST(request(result.flow, 'https://evil.example'))).status).toBe(403)
  const anonymousOrigin = request(result.flow); anonymousOrigin.headers.delete('origin')
  expect((await POST(anonymousOrigin)).status).toBe(403)
  const tooLarge = new Request(`${origin}/api/bookings/confirmation`, { method: 'POST', headers: { origin, host: 'starpyramids.com' }, body: JSON.stringify({ flow: 'x'.repeat(300) }) })
  expect((await POST(tooLarge)).status).toBe(400)
})

it('renders only the public selector and generic confirmation while keeping the original receipt private', async () => {
  const result = await issue(); mocks.cookie = result.value
  const publicView = await PublicPage({ searchParams: Promise.resolve({ flow: result.flow }) })
  expect(publicView.props).toEqual({ flow: result.flow })
  for (const locale of ['en', 'es', 'it'] as const) {
    mocks.locale = locale
    const html = renderToStaticMarkup(createElement(BookingConfirmation, publicView.props))
    expect(html).toContain('/checkout/receipt')
    expect(html).not.toContain('live-chat')
    for (const privateValue of [guest.reference, guest.email, guest.guestAccessUrl!]) expect(html).not.toContain(privateValue)
  }
  const privateView = await PrivatePage({ searchParams: Promise.resolve({ flow: result.flow }) })
  expect(privateView.props.initialReceipt).toEqual(guest)
  mocks.cookie = undefined
  expect((await PublicPage({ searchParams: Promise.resolve({ flow: result.flow }) })).props).toEqual({ flow: null })
  await expect(PrivatePage({ searchParams: Promise.resolve({ flow: result.flow }) })).rejects.toThrow('redirect:/booking-confirmation')
})

it('requires the original customer for account receipts and cannot turn a guest selector into account access', async () => {
  const result = await issue({ ...guest, guest: false, linked: true, email: '', guestAccessUrl: null }, undefined, owner.id)
  mocks.cookie = result.value
  mocks.user.mockResolvedValue(null)
  await expect(PrivatePage({ searchParams: Promise.resolve({ flow: result.flow }) })).rejects.toThrow('redirect:/login')
  mocks.user.mockResolvedValue({ id: 'other-owner', roles: ['CUSTOMER'] })
  await expect(PrivatePage({ searchParams: Promise.resolve({ flow: result.flow }) })).rejects.toThrow('redirect:/login')
  mocks.user.mockResolvedValue(owner)
  expect((await PrivatePage({ searchParams: Promise.resolve({ flow: result.flow }) })).props.initialReceipt.reference).toBe(guest.reference)
})

it('admits only a clean public confirmation document and forces a fresh protected receipt document', () => {
  const flow = 'a'.repeat(32)
  const url = new URL(`/booking-confirmation?flow=${flow}`, origin)
  expect(canMeasureLocation(url, 'production')).toBe(true)
  expect(publicPageView(url, 'production')).toMatchObject({ page_location: origin + '/booking-confirmation', page_title: 'Booking Request Confirmation | STAR PYRAMIDS' })
  expect(proxy(new NextRequest(url)).headers.get('cache-control')).toContain('no-store')
  const receiptUrl = `${origin}/checkout/receipt?flow=${flow}`
  expect(canMeasureLocation(new URL(receiptUrl), 'production')).toBe(false)
  expect(proxy(new NextRequest(receiptUrl, { headers: { rsc: '1', referer: url.href } })).status).toBe(204)
  expect(proxy(new NextRequest(receiptUrl)).headers.get('cache-control')).toContain('no-store')
  expect(proxy(new NextRequest(receiptUrl)).headers.get('referrer-policy')).toBe('no-referrer')
  for (const suffix of ['?flow=private', '?flow=' + flow + '&email=private%40example.test', '#token']) {
    expect(canMeasureLocation(new URL('/booking-confirmation' + suffix, origin), 'production')).toBe(false)
  }
})

it('navigates only after cookie acknowledgement and leaves failures, missing cookies and later navigation alone', async () => {
  const assign = vi.fn()
  const browser = { location: { href: origin + '/checkout/details', assign }, fetch: vi.fn() } as unknown as Window
  const target = '/booking-confirmation?flow=' + 'a'.repeat(32)
  const fetch = vi.mocked(browser.fetch)
  fetch.mockResolvedValueOnce(Response.json({ ready: true }))
  expect(await openBookingConfirmation(browser, target)).toBe(true)
  expect(fetch.mock.calls[0]).toMatchObject(['/api/bookings/confirmation', { method: 'POST', credentials: 'same-origin', body: JSON.stringify({ flow: 'a'.repeat(32) }) }])
  expect(assign).toHaveBeenCalledExactlyOnceWith(target)
  assign.mockClear()
  fetch.mockResolvedValueOnce(Response.json({ ready: false }))
  expect(await openBookingConfirmation(browser, target)).toBe(false)
  fetch.mockRejectedValue(Error('offline'))
  expect(await openBookingConfirmation(browser, target)).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(4)
  fetch.mockImplementationOnce(async () => { browser.location.href = origin + '/trips'; return Response.json({ ready: true }) })
  expect(await openBookingConfirmation(browser, target)).toBe(false)
  expect(await openBookingConfirmation(browser, 'https://evil.example')).toBe(false)
  expect(assign).not.toHaveBeenCalled()
})

it('retries a failed acknowledgement once without restarting checkout', async () => {
  const assign = vi.fn()
  const target = '/booking-confirmation?flow=' + 'a'.repeat(32)
  const fetch = vi.fn().mockRejectedValueOnce(Error('connection lost')).mockResolvedValueOnce(Response.json({ ready: true }))
  const browser = { location: { href: origin + '/checkout/details', assign }, fetch } as unknown as Window
  expect(await openBookingConfirmation(browser, target)).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(assign).toHaveBeenCalledExactlyOnceWith(target)
})

it('bounds the acknowledgement wait and keeps a slow connection from blocking the saved receipt', async () => {
  vi.useFakeTimers()
  const assign = vi.fn()
  const browser = { location: { href: origin + '/checkout/details', assign }, fetch: vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Error('aborted')))
  })) } as unknown as Window
  const pending = openBookingConfirmation(browser, '/booking-confirmation?flow=' + 'a'.repeat(32))
  await vi.advanceTimersByTimeAsync(2501)
  expect(await pending).toBe(false)
  expect(browser.fetch).toHaveBeenCalledOnce()
  expect(assign).not.toHaveBeenCalled()
})
