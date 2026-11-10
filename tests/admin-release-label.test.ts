import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const brand = vi.hoisted(() => ({ companyName: 'Star Pyramids Tours' }))
vi.mock('@/lib/admin-store', () => ({ useBrandSettings: () => brand }))
import { AdminReleaseLabel, shortCompanyName } from '@/components/admin/admin-release-label'

const require = createRequire(import.meta.url)
const { formatReleaseVersion, resolveReleaseVersion } = require('../scripts/release-version.cjs') as {
  formatReleaseVersion: (count: number) => string
  resolveReleaseVersion: (options: { git: ReturnType<typeof vi.fn> }) => string
}

afterEach(() => {
  brand.companyName = 'Star Pyramids Tours'
  vi.unstubAllEnvs()
})

describe('admin release identity', () => {
  it.each([
    ['Star Pyramids Tours', 'Star Pyramids'],
    ['  New\tTravel\nCompany With Five Names ', 'New Travel'],
    ['Solo', 'Solo'],
    ['', ''],
    ['Viaggi\u00a0Italia Agenzia', 'Viaggi Italia'],
  ])('uses only the first two words from %s', (input, expected) => {
    expect(shortCompanyName(input)).toBe(expected)
  })

  it('renders the live brand source and build version below the sidebar user', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_RELEASE_VERSION', 'v1.64')
    let html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: false }))
    expect(html).toContain('Star Pyramids')
    expect(html).not.toContain('Tours')
    expect(html).toContain('v1.64')
    brand.companyName = 'New Company Five Other Names'
    html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: false }))
    expect(html).toContain('New Company')
    expect(html).not.toContain('Five Other Names')
    const shell = readFileSync('components/admin/admin-shell.tsx', 'utf8')
    expect(shell.indexOf('<AdminReleaseLabel collapsed={collapsed} />')).toBeGreaterThan(shell.indexOf('className="sp-side-user"'))
    expect(shell.indexOf('<AdminReleaseLabel collapsed={collapsed} />')).toBeLessThan(shell.indexOf('</aside>'))
  })

  it('keeps the version compact when collapsed and the full label accessible', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_RELEASE_VERSION', 'v1.64')
    const html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: true }))
    expect(html).toContain('aria-label="Star Pyramids v1.64"')
    expect(html).not.toContain('>Star Pyramids</span>')
    expect(html).toContain('dir="ltr">v1.64</span>')
    const css = readFileSync('components/admin/admin-release-label.module.css', 'utf8')
    expect(css).toContain('min-width: 0')
    expect(css).toContain('text-overflow: ellipsis')
    expect(css).toContain('flex: none')
  })

  it('escapes company markup and does not invent a version without build metadata', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_RELEASE_VERSION', '')
    brand.companyName = '<script> bad company'
    const html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: false }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt; bad')
    expect(html).toContain('v—')
  })
})

describe('release version calculation', () => {
  it.each([[0, 'v0.00'], [9, 'v0.09'], [10, 'v0.10'], [50, 'v0.50'], [99, 'v0.99'], [100, 'v1.00'], [150, 'v1.50'], [164, 'v1.64'], [165, 'v1.65'], [169, 'v1.69'], [170, 'v1.70'], [199, 'v1.99'], [200, 'v2.00'], [1000, 'v10.00']])('formats %i commits as %s', (count, expected) => {
    expect(formatReleaseVersion(count)).toBe(expected)
  })
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid counts: %s', count => {
    expect(() => formatReleaseVersion(count)).toThrow('Invalid release commit count')
  })
  it('reads complete build history with a bounded Git subprocess', () => {
    const git = vi.fn().mockReturnValueOnce('false\n').mockReturnValueOnce('170\n')
    expect(resolveReleaseVersion({ git })).toBe('v1.70')
    expect(git).toHaveBeenLastCalledWith('git', ['rev-list', '--count', 'HEAD'], expect.objectContaining({ timeout: 2000, windowsHide: true }))
  })
  it('uses the recorded published snapshot for shallow clones', () => {
    const git = vi.fn().mockReturnValueOnce('true\n')
    expect(resolveReleaseVersion({ git })).toBe('v1.64')
    expect(git).toHaveBeenCalledTimes(1)
  })
  it('uses the recorded snapshot if Git is absent, fails or returns malformed counts', () => {
    expect(resolveReleaseVersion({ git: vi.fn(() => { throw new Error('timeout') }) })).toBe('v1.64')
    expect(resolveReleaseVersion({ git: vi.fn().mockReturnValueOnce('false').mockReturnValueOnce('bad') })).toBe('v1.64')
  })
})
