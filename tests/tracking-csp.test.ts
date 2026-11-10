import { expect, it } from 'vitest'
import { observeTrackingCsp, safeTrackingCspEvidence, trackingCspEvidence } from '@/lib/tracking/tracking-csp'
import { browserTrackingHealth } from '@/lib/tracking/health/tracking-health'

it('captures only Google origin, directive and disposition, omitting tokens, nonces and page details', () => {
  const browser = new EventTarget() as Window
  const stop = observeTrackingCsp(browser)
  browser.dispatchEvent(Object.assign(new Event('securitypolicyviolation'), {
    blockedURI: 'https://www.googletagmanager.com/gtm.js?id=GTM-KQ8GR36H&token=secret',
    effectiveDirective: 'script-src-elem', disposition: 'enforce', originalPolicy: "script-src 'nonce-secret'", sample: 'private sample',
  }))
  expect(trackingCspEvidence(browser)).toEqual({ origin: 'https://www.googletagmanager.com', directive: 'script-src-elem', disposition: 'enforce' })
  expect(JSON.stringify(trackingCspEvidence(browser))).not.toContain('secret')
  stop()
  browser.dispatchEvent(Object.assign(new Event('securitypolicyviolation'), {
    blockedURI: 'https://www.google-analytics.com/g/collect', effectiveDirective: 'connect-src', disposition: 'report',
  }))
  expect(trackingCspEvidence(browser)?.directive).toBe('script-src-elem')
})

it('rejects unsafe or unrecognized evidence across the diagnostic boundary', () => {
  for (const origin of ['https://evil.invalid', 'https://www.google.com.evil.invalid', 'https://www.google.com/path?token=secret']) {
    expect(safeTrackingCspEvidence({ origin, directive: 'script-src', disposition: 'enforce' })).toBeUndefined()
  }
  expect(safeTrackingCspEvidence({ origin: 'https://www.google.com', directive: "script-src 'nonce-secret'", disposition: 'enforce' })).toBeUndefined()
})

it('reports an observed script failure with narrowly projected CSP evidence while consent remains denied', () => {
  expect(browserTrackingHealth({ observedAt: new Date().toISOString(), containerId: 'GTM-KQ8GR36H', eligible: true,
    analytics: false, marketing: false, script: 'failed', csp: { origin: 'https://www.googletagmanager.com', directive: 'script-src', disposition: 'enforce', originalPolicy: 'secret' },
  }, 'GTM-KQ8GR36H')).toMatchObject({ status: 'error', evidence: {
    analyticsConsent: false, marketingConsent: false, cspOrigin: 'https://www.googletagmanager.com', cspDirective: 'script-src', cspDisposition: 'enforce',
  } })
})
