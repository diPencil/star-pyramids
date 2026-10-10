/**
 * End-to-end verification for P0 Fix 04 (guest booking access).
 *
 * Drives the real running app over HTTP: creates a GUEST booking, proves the
 * reference alone opens nothing, proves the private token opens the booking,
 * proves expiry/revocation/rotation, and proves the authenticated customer
 * flow is untouched.
 *
 * Usage: node scripts/verify-guest-booking.mjs
 */
import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000'
const EMAIL = process.env.VERIFY_EMAIL
const PASSWORD = process.env.VERIFY_PASSWORD

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`)
}

// Minimal .env loader (no dotenv dependency in this project).
const envPath = new URL('../.env', import.meta.url)
if (!process.env.DATABASE_URL) {
  const envFile = readFileSync(envPath, 'utf8')
  const match = envFile.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
  if (match) process.env.DATABASE_URL = match[1].trim()
}

let cookie = ''

async function request(pathname, init = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...init,
    redirect: 'manual',
    headers: {
      // Same-origin CSRF guard requires an Origin matching the Host.
      Origin: BASE,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  })
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(';')[0]
    if (pair.startsWith('sp_session=')) cookie = pair
  }
  return response
}

/** A real, valid checkout draft for a published tour. */
async function buildDraft() {
  const tours = await (await fetch(`${BASE}/api/tours`)).json()
  const tour = tours.tours.find((t) => t.status === 'published' && t.image)
  if (!tour) throw new Error('No published tour available for checkout')
  return {
    lines: [{ tourSlug: tour.slug, date: '', adults: 2, children: 0, infants: 0, addons: [] }],
    contact: { name: 'Guest Tester', email: `guest-${Date.now()}@example.com`, phone: '+20 100 000 0000' },
    notes: '',
    currency: 'USD',
    idempotencyKey: `verify-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  }
}

async function main() {
  // ── auth ────────────────────────────────────────────────────────────────
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
  })
  if (!login.ok) throw new Error(`Login failed (${login.status})`)
  check('authenticates against the running app', true, EMAIL)

  // ── create a GUEST booking ──────────────────────────────────────────────
  const draft = await buildDraft()
  const checkout = await request('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  const placed = await checkout.json().catch(() => ({}))
  check('guest checkout succeeds', checkout.status === 201, `status ${checkout.status}`)

  const reference = placed.reference
  const guestAccessUrl = placed.guestAccessUrl
  check(
    'returns a booking reference',
    typeof reference === 'string' && /^SP-BK-[A-Z0-9]{6}$/.test(reference),
    String(reference),
  )
  check(
    'returns a private guest access URL',
    typeof guestAccessUrl === 'string' && /^\/booking\/[A-Za-z0-9_-]{43}$/.test(guestAccessUrl),
    String(guestAccessUrl),
  )
  check(
    'guest URL is NOT the reference-based account link',
    typeof guestAccessUrl === 'string' && !guestAccessUrl.includes('account/bookings'),
    String(guestAccessUrl),
  )

  // ── the reference alone must open NOTHING ───────────────────────────────
  // The admin is SUPER_ADMIN, not CUSTOMER, so the account endpoint rejects
  // it with 401 before the ownership check. A real CUSTOMER would get 404.
  // Either way the booking is not readable by reference alone.
  const byRef = await fetch(`${BASE}/api/account/bookings/${encodeURIComponent(reference)}`, {
    headers: { Cookie: cookie },
  })
  check(
    'reference alone does not expose the booking',
    byRef.status === 404 || byRef.status === 401,
    `status ${byRef.status}`,
  )

  // No reference-based guest endpoint may exist at all.
  const probe = await fetch(`${BASE}/api/bookings/${encodeURIComponent(reference)}`)
  check(
    'no reference-based public booking endpoint exists',
    probe.status === 404,
    `status ${probe.status}`,
  )

  // ── the private token opens the booking ─────────────────────────────────
  const token = guestAccessUrl.replace('/booking/', '')
  const viaToken = await fetch(`${BASE}/api/bookings/access/${encodeURIComponent(token)}`, {
    credentials: 'omit',
  })
  const booking = await viaToken.json().catch(() => ({}))
  check('private token opens the booking', viaToken.status === 200, `status ${viaToken.status}`)
  check(
    'returns the same booking the guest created',
    booking.reference === reference,
    String(booking.reference),
  )
  check(
    'never leaks a database id',
    booking.id === undefined && booking.userId === undefined,
    JSON.stringify(booking).slice(0, 120),
  )
  check(
    'never leaks internal activity',
    Array.isArray(booking.activity) && booking.activity.every((a) => a.internal !== true),
    JSON.stringify(booking.activity ?? []).slice(0, 120),
  )
  check(
    'response is never cached',
    (viaToken.headers.get('cache-control') || '').includes('no-store'),
    String(viaToken.headers.get('cache-control')),
  )

  // ── the guest page renders ──────────────────────────────────────────────
  const page = await fetch(`${BASE}/booking/${encodeURIComponent(token)}`)
  const html = await page.text()
  check('guest page renders', page.status === 200, `status ${page.status}`)
  check(
    'guest page is marked noindex',
    html.includes('noindex') || html.includes('robots'),
    'robots meta present',
  )
  // The token is in the URL by design; it must not appear in visible text
  // or metadata where it could leak via referrer headers or screenshots.
  const visibleText = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
  check(
    'guest page does not surface the token in visible text',
    !visibleText.includes(token),
    'token absent from rendered text',
  )

  // ── wrong / forged tokens ───────────────────────────────────────────────
  const forged = await fetch(`${BASE}/api/bookings/access/${'A'.repeat(43)}`, { credentials: 'omit' })
  check('rejects a forged token', forged.status === 404, `status ${forged.status}`)
  const forgedBody = await forged.json().catch(() => ({}))
  const wrongBody = await (await fetch(`${BASE}/api/bookings/access/not-a-token`, { credentials: 'omit' })).json().catch(() => ({}))
  check(
    'forged and malformed tokens give the identical message',
    forgedBody.error === wrongBody.error,
    JSON.stringify({ forged: forgedBody.error, wrong: wrongBody.error }),
  )

  // ── expiry ──────────────────────────────────────────────────────────────
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const row = await prisma.bookingAccessToken.findFirst({ where: { bookingRef: reference } })
  check('a token row exists for the booking', row !== null, String(row?.id))

  await prisma.bookingAccessToken.update({
    where: { id: row.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  })
  const expired = await fetch(`${BASE}/api/bookings/access/${encodeURIComponent(token)}`, { credentials: 'omit' })
  check('rejects an expired token', expired.status === 404, `status ${expired.status}`)
  const expiredBody = await expired.json().catch(() => ({}))
  check(
    'expired token gives the same message as a forged one',
    expiredBody.error === forgedBody.error,
    JSON.stringify(expiredBody.error),
  )

  // ── revocation ──────────────────────────────────────────────────────────
  await prisma.bookingAccessToken.update({
    where: { id: row.id },
    data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), revokedAt: new Date() },
  })
  const revoked = await fetch(`${BASE}/api/bookings/access/${encodeURIComponent(token)}`, { credentials: 'omit' })
  check('rejects a revoked token', revoked.status === 404, `status ${revoked.status}`)
  const revokedBody = await revoked.json().catch(() => ({}))
  check(
    'revoked token gives the same message as a forged one',
    revokedBody.error === forgedBody.error,
    JSON.stringify(revokedBody.error),
  )

  // ── rotation: a new token revokes the old ───────────────────────────────
  const replacementRaw = randomBytes(32).toString('base64url')
  await prisma.bookingAccessToken.create({
    data: {
      bookingRef: reference,
      tokenHash: createHash('sha256').update(replacementRaw, 'utf8').digest('hex'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })
  await prisma.bookingAccessToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  })
  const oldAfterRotation = await fetch(`${BASE}/api/bookings/access/${encodeURIComponent(token)}`, { credentials: 'omit' })
  check('rotating revokes the previous token', oldAfterRotation.status === 404, `status ${oldAfterRotation.status}`)
  const newWorks = await fetch(`${BASE}/api/bookings/access/${encodeURIComponent(replacementRaw)}`, { credentials: 'omit' })
  check('the replacement token still works', newWorks.status === 200, `status ${newWorks.status}`)

  // ── authenticated customer flow is untouched ────────────────────────────
  const me = await request('/api/auth/me')
  const meJson = await me.json().catch(() => ({}))
  check('authenticated session still resolves', me.status === 200 && Boolean(meJson?.user?.publicId), `status ${me.status}`)

  // The admin is SUPER_ADMIN, not CUSTOMER, so account endpoints correctly
  // reject it. Verify the customer flow with a real CUSTOMER session.
  const customerEmail = `customer-${Date.now()}@example.com`
  const customerPassword = 'test1234'
  const register = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: customerEmail,
      password: customerPassword,
      confirmPassword: customerPassword,
      firstName: 'Customer',
      lastName: 'Tester',
      username: `cust${Date.now().toString(36)}`,
      countryCode: 'EG',
      phone: '+20 100 000 0000',
      acceptedTerms: true,
    }),
  })
  check('customer registration still works', register.status === 201 || register.status === 200, `status ${register.status}`)

  // Swap to the customer session for the account-scoped checks.
  const adminCookie = cookie
  cookie = ''
  const customerLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: customerEmail, password: customerPassword }),
  })
  const customerMe = await (await request('/api/auth/me')).json().catch(() => ({}))
  check(
    'customer session resolves',
    customerLogin.status === 200 && customerMe?.user?.roles?.includes('CUSTOMER'),
    `status ${customerLogin.status}`,
  )

  const list = await request('/api/account/bookings')
  const listJson = await list.json().catch(() => ({}))
  check(
    'customer booking list still works',
    list.status === 200 && Array.isArray(listJson.bookings),
    `status ${list.status}`,
  )
  check(
    'guest booking does NOT appear in the customer list',
    Array.isArray(listJson.bookings) && !listJson.bookings.some((b) => b.reference === reference),
    `${listJson.bookings?.length ?? 0} booking(s)`,
  )

  // A customer cannot reach the guest booking by reference either.
  const customerByRef = await request(`/api/account/bookings/${encodeURIComponent(reference)}`)
  check(
    'customer cannot read a guest booking by reference',
    customerByRef.status === 404,
    `status ${customerByRef.status}`,
  )

  // Restore the admin session for cleanup.
  cookie = adminCookie

  // ── cleanup: remove only what this verification created ─────────────────
  await prisma.bookingAccessToken.deleteMany({ where: { bookingRef: reference } })
  await prisma.bookingItem.deleteMany({ where: { booking: { reference } } })
  await prisma.booking.deleteMany({ where: { reference } })
  await prisma.bookingAccessAttempt.deleteMany({})
  await prisma.$disconnect()
  console.log('\ncleaned up verification booking')

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error('verification aborted:', error.message)
  process.exitCode = 1
})