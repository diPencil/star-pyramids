import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GTM_CONTAINER_ID,
  TRACKING_CONSENT_STORAGE_KEY,
  buildConsentDefaultSnippet,
  buildGtmIntegrationSnippet,
  buildGtmLoaderSnippet,
  isTrackingExcludedPath,
  isValidGtmContainerId,
  normalizeGtmContainerId,
  resolveTrackingSettings,
} from '@/lib/tracking'

describe('Google Tag Manager configuration', () => {
  it('accepts only GTM container IDs', () => {
    expect(isValidGtmContainerId('GTM-KQ8GR36H')).toBe(true)
    expect(normalizeGtmContainerId('  GTM-KQ8GR36H  ')).toBe('GTM-KQ8GR36H')
    for (const invalid of ['', 'GTM-', 'GTM-kq8gr36h', 'UA-12345', 'GTM-KQ8GR36H;alert(1)', 'G-ABC123']) {
      expect(isValidGtmContainerId(invalid)).toBe(false)
    }
  })

  it('uses the supplied container and enables tracking when settings are unset', () => {
    expect(resolveTrackingSettings({ enabled: null, containerId: null })).toEqual({
      enabled: true,
      containerId: DEFAULT_GTM_CONTAINER_ID,
    })
  })

  it('honours an explicit disable and a configured container', () => {
    expect(resolveTrackingSettings({ enabled: 'false', containerId: 'GTM-ABC123' })).toEqual({
      enabled: false,
      containerId: 'GTM-ABC123',
    })
  })

  it('fails safely when a stored container ID is invalid', () => {
    expect(resolveTrackingSettings({ enabled: 'true', containerId: 'not-a-container' })).toEqual({
      enabled: false,
      containerId: '',
    })
  })

  it('excludes admin, account and staff preview routes without excluding similar public paths', () => {
    for (const path of [
      '/admin',
      '/admin/settings',
      '/admin?tab=users',
      '/admin/settings?section=seo#tracking',
      '/account',
      '/account/bookings',
      '/account/bookings?ref=SP-123',
      '/website-cms-preview',
      '/website-cms-preview/homepage?page=home',
    ]) {
      expect(isTrackingExcludedPath(path)).toBe(true)
    }
    for (const path of ['/', '/trips?page=2', '/administrator', '/accounting', '/website-cms-preview-guide']) {
      expect(isTrackingExcludedPath(path)).toBe(false)
    }
  })

  it('builds the official loader for the validated container only', () => {
    const snippet = buildGtmLoaderSnippet('GTM-KQ8GR36H')
    expect(snippet).toContain("https://www.googletagmanager.com/gtm.js?id='+i+dl")
    expect(snippet).toContain("'GTM-KQ8GR36H'")
    expect(() => buildGtmLoaderSnippet('GTM-<script>')).toThrow('Invalid Google Tag Manager Container ID.')
  })

  it('defaults non-essential consent to denied and reads stored choices', () => {
    const snippet = buildConsentDefaultSnippet()
    expect(snippet).toContain("ad_storage:'denied'")
    expect(snippet).toContain("analytics_storage:'denied'")
    expect(snippet).toContain("ad_user_data:'denied'")
    expect(snippet).toContain("ad_personalization:'denied'")
    expect(snippet).toContain("functionality_storage:'granted'")
    expect(snippet).toContain("security_storage:'granted'")
    expect(snippet).toContain(JSON.stringify(TRACKING_CONSENT_STORAGE_KEY))
    expect(snippet).toContain("addEventListener('sp:consent-change'")
    expect(snippet).toContain("Array.isArray(c)")
    expect(snippet).toContain("typeof av!=='boolean'")
    expect(snippet).toContain("typeof mv!=='boolean'")
  })

  it('establishes consent before GTM and guards against duplicate initialization', () => {
    const snippet = buildGtmIntegrationSnippet('GTM-KQ8GR36H')
    expect(snippet.indexOf("consent','default")).toBeLessThan(snippet.indexOf("event:'gtm.js'"))
    expect(snippet).toContain('window.__spGtmInitialized')
    expect(snippet.match(/gtm\.js\?id=/g)).toHaveLength(1)
  })
})
