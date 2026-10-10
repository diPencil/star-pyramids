/**
 * End-to-end verification for P0 Fix 03 (server-side media storage).
 *
 * Drives the real running app over HTTP: logs in, applies the media
 * migration, uploads real image bytes through the multipart endpoints,
 * and asserts that the file, the database reference and the public URL
 * all survive a fresh request.
 *
 * Usage: node scripts/verify-media.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000'
const EMAIL = process.env.VERIFY_EMAIL
const PASSWORD = process.env.VERIFY_PASSWORD

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`)
}

// 1x1 transparent PNG and 1x1 JPEG, written as real binary fixtures.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/5+hHgAAXolJLoIAAAAASUVORK5CYII='
const PNG = Buffer.from(PNG_B64, 'base64')

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
  const setCookie = response.headers.getSetCookie?.() ?? []
  for (const raw of setCookie) {
    const pair = raw.split(';')[0]
    if (pair.startsWith('sp_session=')) cookie = pair
  }
  return response
}

async function main() {
  // ── auth ────────────────────────────────────────────────────────────────
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: EMAIL, password: PASSWORD }),
  })
  if (!login.ok) throw new Error(`Login failed (${login.status}): ${await login.text()}`)
  check('authenticates against the running app', true, EMAIL)

  // ── unauthenticated + cross-origin must be rejected ──────────────────────
  const saved = cookie
  cookie = ''
  const anonBody = new FormData()
  anonBody.append('scope', 'avatar')
  anonBody.append('file', new Blob([PNG], { type: 'image/png' }), 'a.png')
  // No cookie and no same-origin Origin: rejected before anything is read.
  const anon = await fetch(`${BASE}/api/media`, { method: 'POST', body: anonBody })
  check(
    'rejects anonymous upload',
    anon.status === 401 || anon.status === 403,
    `status ${anon.status}`,
  )
  cookie = saved

  const noOrigin = await fetch(`${BASE}/api/media`, {
    method: 'POST',
    headers: { Origin: 'https://evil.example.com', Cookie: cookie },
    body: (() => {
      const body = new FormData()
      body.append('scope', 'avatar')
      body.append('file', new Blob([PNG], { type: 'image/png' }), 'a.png')
      return body
    })(),
  })
  check('rejects cross-origin upload', noOrigin.status === 403, `status ${noOrigin.status}`)

  // ── upload a real PNG ───────────────────────────────────────────────────
  const body = new FormData()
  body.append('scope', 'avatar')
  body.append('file', new Blob([PNG], { type: 'image/png' }), 'pyramids.png')
  const upload = await request('/api/media', { method: 'POST', body })
  const uploadJson = await upload.json().catch(() => ({}))
  check('stores a real PNG upload', upload.status === 201, JSON.stringify(uploadJson))

  const url = uploadJson?.media?.url
  check(
    'returns a /media/<yyyy>/<mm>/<hex>.<ext> URL',
    typeof url === 'string' && /^\/media\/\d{4}\/\d{2}\/[0-9a-f]{32}\.png$/.test(url),
    String(url),
  )
  check(
    'is NOT a data URL',
    typeof url === 'string' && !url.startsWith('data:'),
    typeof url === 'string' ? url.slice(0, 24) : 'n/a',
  )

  // ── the file really exists on disk ──────────────────────────────────────
  const storageDir = process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), 'storage', 'media')
  const onDisk = path.join(storageDir, String(url).replace('/media/', ''))
  check(
    'file exists on disk (outside public/)',
    existsSync(onDisk),
    path.relative(process.cwd(), onDisk),
  )

  // ── serving: fresh request returns the original bytes ───────────────────
  const served = await fetch(`${BASE}${url}`)
  const servedBytes = Buffer.from(await served.arrayBuffer())
  check('serves the image over HTTP', served.status === 200, `status ${served.status}`)
  check(
    'Content-Type comes from stored magic bytes',
    served.headers.get('content-type') === 'image/png',
    String(served.headers.get('content-type')),
  )
  check(
    'sets nosniff and immutable caching',
    served.headers.get('x-content-type-options') === 'nosniff' &&
      (served.headers.get('cache-control') || '').includes('immutable'),
    served.headers.get('cache-control'),
  )
  check('served bytes are byte-identical to the upload', servedBytes.equals(PNG), `${servedBytes.length} bytes`)

  // ── conditional request ─────────────────────────────────────────────────
  const etag = served.headers.get('etag')
  const cached = await fetch(`${BASE}${url}`, { headers: { 'If-None-Match': etag } })
  check('honours If-None-Match with 304', cached.status === 304, `status ${cached.status}`)

  // ── rejection paths ─────────────────────────────────────────────────────
  const spoof = new FormData()
  spoof.append('scope', 'avatar')
  // A shell script wearing a .png name and an image/png declared type.
  spoof.append('file', new Blob([Buffer.from('#!/bin/sh\nrm -rf /\n')], { type: 'image/png' }), 'evil.png')
  const spoofed = await request('/api/media', { method: 'POST', body: spoof })
  check('rejects a non-image disguised as image/png', spoofed.status === 400, `status ${spoofed.status}`)

  const svg = new FormData()
  svg.append('scope', 'avatar')
  svg.append('file', new Blob([Buffer.from('<svg onload="alert(1)"/>')], { type: 'image/svg+xml' }), 'x.svg')
  const svgRes = await request('/api/media', { method: 'POST', body: svg })
  check('rejects SVG', svgRes.status === 400, `status ${svgRes.status}`)

  const badScope = new FormData()
  badScope.append('scope', '../../etc')
  badScope.append('file', new Blob([PNG], { type: 'image/png' }), 'a.png')
  const badScopeRes = await request('/api/media', { method: 'POST', body: badScope })
  check('rejects an invalid scope', badScopeRes.status === 400, `status ${badScopeRes.status}`)

  // ── traversal attempts on the public route ──────────────────────────────
  for (const attempt of [
    '/media/../../../../../../etc/passwd',
    '/media/..%2f..%2f..%2fpackage.json',
    '/media/2026/10/not-a-real-key.png',
  ]) {
    const res = await fetch(`${BASE}${attempt}`)
    check(`blocks traversal: ${attempt}`, res.status === 404, `status ${res.status}`)
  }

  // ── avatar endpoint persists to the database ────────────────────────────
  const avatarBody = new FormData()
  avatarBody.append('file', new Blob([PNG], { type: 'image/png' }), 'me.png')
  const avatarRes = await request('/api/avatar', { method: 'POST', body: avatarBody })
  const avatarJson = await avatarRes.json().catch(() => ({}))
  check('avatar endpoint stores a real file', avatarRes.status === 200, JSON.stringify(avatarJson).slice(0, 120))
  const avatarUrl = avatarJson?.user?.avatar
  check(
    'avatar persists as a /media URL',
    typeof avatarUrl === 'string' && /^\/media\//.test(avatarUrl),
    String(avatarUrl),
  )

  // ── survives a fresh request (the "refresh / re-login" requirement) ────
  const me1 = await request('/api/auth/me')
  const meJson = await me1.json().catch(() => ({}))
  check(
    'avatar survives a fresh session read',
    meJson?.user?.avatar === avatarUrl,
    String(meJson?.user?.avatar),
  )
  const reServed = await fetch(`${BASE}${avatarUrl}`)
  check('avatar URL is publicly retrievable', reServed.status === 200, `status ${reServed.status}`)

  // ── legacy compatibility: an existing https/data URL is still accepted ──
  const legacy = await request('/api/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: 'https://example.com/legacy.png' }),
  })
  check('still accepts a legacy https avatar URL', legacy.status === 200, `status ${legacy.status}`)

  const legacyData = await request('/api/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: `data:image/png;base64,${PNG_B64}` }),
  })
  check('still accepts a legacy data URL (existing records)', legacyData.status === 200, `status ${legacyData.status}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) process.exitCode = 1
}

main().catch((error) => {
  console.error('verification aborted:', error.message)
  process.exitCode = 1
})