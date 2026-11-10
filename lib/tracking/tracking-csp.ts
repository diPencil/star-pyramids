// Record only allowlisted origins and directive names, never query strings,
// source samples, document URLs, or originalPolicy (which can contain nonces).
const GOOGLE_ORIGINS = new Set([
  'https://www.googletagmanager.com', 'https://tagmanager.google.com',
  'https://www.google-analytics.com', 'https://region1.google-analytics.com',
  'https://www.google.com', 'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net', 'https://stats.g.doubleclick.net',
  'https://fonts.googleapis.com', 'https://fonts.gstatic.com',
  'https://ssl.gstatic.com', 'https://www.gstatic.com',
])
export type TrackingCspEvidence = { origin: string; directive: string; disposition: 'enforce' | 'report' }
const observations = new WeakMap<Window, TrackingCspEvidence>()

export function safeTrackingCspEvidence(value: unknown): TrackingCspEvidence | undefined {
  if (!value || typeof value !== 'object') return
  const input = value as Partial<TrackingCspEvidence>
  if (typeof input.origin !== 'string' || !GOOGLE_ORIGINS.has(input.origin) ||
      !['script-src', 'script-src-elem', 'connect-src', 'img-src', 'frame-src', 'style-src', 'style-src-elem', 'font-src', 'default-src'].includes(input.directive ?? '') ||
      !['enforce', 'report'].includes(input.disposition ?? '')) return
  return { origin: input.origin, directive: input.directive!, disposition: input.disposition! }
}

export function trackingCspEvidence(browser: Window) { return observations.get(browser) }

export function observeTrackingCsp(browser: Window) {
  const listener = (event: SecurityPolicyViolationEvent) => {
    try {
      const evidence = safeTrackingCspEvidence({ origin: new URL(event.blockedURI).origin,
        directive: event.effectiveDirective, disposition: event.disposition })
      if (evidence) observations.set(browser, evidence)
    } catch { /* Inline/eval/unknown resources are deliberately not recorded. */ }
  }
  browser.addEventListener('securitypolicyviolation', listener)
  return () => browser.removeEventListener('securitypolicyviolation', listener)
}
