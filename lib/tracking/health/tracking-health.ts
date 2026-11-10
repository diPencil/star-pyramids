import { safeTrackingCspEvidence, type TrackingCspEvidence } from '../tracking-csp'

export type TrackingHealthStatus = 'verified' | 'action_required' | 'not_verified' | 'error'
export type TrackingHealthCheck = { status: TrackingHealthStatus; code: string; evidence?: Record<string, string | number | boolean | null> }
export type TrackingHealthConfig = { enabled: boolean; containerId: string; measurementId: string }
export type TrackingHealthReport = {
  checkedAt: string
  configuration: TrackingHealthCheck
  published: TrackingHealthCheck
  browser: TrackingHealthCheck
  ga4: TrackingHealthCheck
  overall: TrackingHealthStatus
  config: TrackingHealthConfig
}

export function normalizeGa4MeasurementId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim().toUpperCase()
  return /^G-[A-Z0-9]{6,20}$/.test(id) ? id : null
}

export function overallTrackingHealth(checks: readonly TrackingHealthCheck[]): TrackingHealthStatus {
  if (checks.some(c => c.status === 'error')) return 'error'
  if (checks.some(c => c.status === 'action_required')) return 'action_required'
  return checks.length === 4 && checks.every(c => c.status === 'verified') ? 'verified' : 'not_verified'
}

export type TrackingBrowserSnapshot = {
  observedAt: string
  containerId: string | null
  eligible: boolean
  analytics: boolean
  marketing: boolean
  script: 'not_loaded' | 'loading' | 'loaded' | 'failed'
  csp?: TrackingCspEvidence
}

export function browserTrackingHealth(input: unknown, containerId: string, now = Date.now()): TrackingHealthCheck {
  if (!input || typeof input !== 'object') return { status: 'not_verified', code: 'browser_no_observation' }
  const s = input as Partial<TrackingBrowserSnapshot>
  const timestamp = typeof s.observedAt === 'string' ? Date.parse(s.observedAt) : NaN
  if (!Number.isFinite(timestamp) || timestamp > now + 3000 || now - timestamp > 10000 ||
      typeof s.eligible !== 'boolean' || typeof s.analytics !== 'boolean' || typeof s.marketing !== 'boolean' ||
      !['not_loaded', 'loading', 'loaded', 'failed'].includes(s.script ?? '')) return { status: 'not_verified', code: 'browser_invalid_observation' }
  if (!s.eligible) return { status: 'not_verified', code: 'browser_ineligible' }
  if (s.containerId !== containerId) return { status: 'action_required', code: 'browser_container_mismatch' }
  const csp = safeTrackingCspEvidence(s.csp)
  const evidence = { analyticsConsent: s.analytics, marketingConsent: s.marketing, observedAt: s.observedAt!,
    ...(csp ? { cspOrigin: csp.origin, cspDirective: csp.directive, cspDisposition: csp.disposition } : {}) }
  if (s.script === 'loaded') return { status: 'verified', code: 'browser_observed', evidence }
  if (s.script === 'failed') return { status: 'error', code: 'browser_script_failed', evidence }
  if (!s.analytics && !s.marketing && s.script === 'not_loaded') return { status: 'not_verified', code: 'browser_consent_denied', evidence }
  return { status: 'not_verified', code: s.script === 'loading' ? 'browser_loading' : 'browser_not_loaded', evidence }
}
