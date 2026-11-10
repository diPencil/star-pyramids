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
    vi.stubEnv('NEXT_PUBLIC_APP_RELEASE_VERSION', 'v0.16')
    let html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: false }))
    expect(html).toContain('Star Pyramids')
    expect(html).not.toContain('Tours')
    expect(html).toContain('v0.16')
    brand.companyName = 'New Company Five Other Names'
    html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: false }))
    expect(html).toContain('New Company')
    expect(html).not.toContain('Five Other Names')
    const shell = readFileSync('components/admin/admin-shell.tsx', 'utf8')
    expect(shell.indexOf('<AdminReleaseLabel collapsed={collapsed} />')).toBeGreaterThan(shell.indexOf('className="sp-side-user"'))
    expect(shell.indexOf('<AdminReleaseLabel collapsed={collapsed} />')).toBeLessThan(shell.indexOf('</aside>'))
  })

  it('keeps the version compact when collapsed and the full label accessible', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_RELEASE_VERSION', 'v0.16')
    const html = renderToStaticMarkup(createElement(AdminReleaseLabel, { collapsed: true }))
    expect(html).toContain('aria-label="Star Pyramids v0.16"')
    expect(html).not.toContain('>Star Pyramids</span>')
    expect(html).toContain('dir="ltr">v0.16</span>')
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
  it.each([[0, 'v0.00'], [9, 'v0.00'], [10, 'v0.01'], [50, 'v0.05'], [164, 'v0.16'], [169, 'v0.16'], [170, 'v0.17'], [1000, 'v1.00']])('formats %i commits as %s', (count, expected) => {
    expect(formatReleaseVersion(count)).toBe(expected)
  })
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid counts: %s', count => {
    expect(() => formatReleaseVersion(count)).toThrow('Invalid release commit count')
  })
  it('reads complete build history with a bounded Git subprocess', () => {
    const git = vi.fn().mockReturnValueOnce('false\n').mockReturnValueOnce('170\n')
    expect(resolveReleaseVersion({ git })).toBe('v0.17')
    expect(git).toHaveBeenLastCalledWith('git', ['rev-list', '--count', 'HEAD'], expect.objectContaining({ timeout: 2000, windowsHide: true }))
  })
  it('uses the recorded published snapshot for shallow clones', () => {
    const git = vi.fn().mockReturnValueOnce('true\n')
    expect(resolveReleaseVersion({ git })).toBe('v0.16')
    expect(git).toHaveBeenCalledTimes(1)
  })
  it('uses the recorded snapshot if Git is absent, fails or returns malformed counts', () => {
    expect(resolveReleaseVersion({ git: vi.fn(() => { throw new Error('timeout') }) })).toBe('v0.16')
    expect(resolveReleaseVersion({ git: vi.fn().mockReturnValueOnce('false').mockReturnValueOnce('bad') })).toBe('v0.16')
  })
})
