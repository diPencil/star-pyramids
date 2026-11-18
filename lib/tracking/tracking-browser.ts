import { canMeasureLocation, DOCUMENT_LOCATION_CHANGE_EVENT, isTrackingGrant, normalizeGtmContainerId, TRACKING_CONSENT_STORAGE_KEY, type TrackingGrants } from './tracking'
import { GTM_DENIED_DEFAULTS, startGtmScript, type GtmWindow } from './gtm-script'

export type TrackingConsent = { analytics: boolean; marketing: boolean }

type TrackingWindow = GtmWindow & {
  BroadcastChannel?: typeof BroadcastChannel
}

const DENIED: TrackingConsent = { analytics: false, marketing: false }
const CONSENT_VETO = '__Host-sp-consent-revoked'
const CONSENT_COOKIE_FLAGS = 'Path=/; Secure; SameSite=Strict'
const LEGACY_GRANTS_KEY = 'sp-consent-legacy-grants-v1'
const unresolvedConsent = new WeakSet<Window>()
const verifiedConsentStorage = new WeakSet<Window>()
const analyticsConsent = new WeakMap<Window, boolean>()
const appliedGoogleConsent = new WeakMap<Window, TrackingConsent>()
const startupInteractions = new WeakMap<Window, { analytics: string; events: object[] }>()
type ConsentListener = (choice: TrackingConsent) => void
const consentSubscriptions = new WeakMap<Window, { listeners: Set<ConsentListener>; stop: () => void }>()
const CONSENT_CHANGE_EVENT = 'sp:consent-change'
export const GTM_READY_EVENT = 'sp:gtm-ready'
export const GTM_CONSENT_READY_EVENT = 'sp_consent_ready'

export function isGtmReady(browser: Window): boolean {
  return (browser as GtmWindow).__spGtmScript?.status === 'loaded'
}

/** Observation only: never initializes tags or changes consent. */
export function gtmScriptHealth(browser: Window): 'not_loaded' | 'loading' | 'loaded' | 'failed' {
  return (browser as GtmWindow).__spGtmScript?.status ?? 'not_loaded'
}

export function observedGtmContainerId(browser: Window): string | null {
  return (browser as GtmWindow).__spGtmScript?.id ?? null
}

export function subscribeToTrackingLocation(browser: Window, refresh: () => void) {
  const navigation = (browser as Window & { navigation?: EventTarget }).navigation
  const events = ['hashchange', 'popstate', DOCUMENT_LOCATION_CHANGE_EVENT]
  for (const event of events) browser.addEventListener(event, refresh)
  navigation?.addEventListener('currententrychange', refresh)
  return () => {
    for (const event of events) browser.removeEventListener(event, refresh)
    navigation?.removeEventListener('currententrychange', refresh)
  }
}

function parseConsent(value: unknown): TrackingConsent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { analytics, marketing } = value as Partial<TrackingConsent>
  if (analytics === undefined && marketing === undefined) return null
  if ((analytics !== undefined && typeof analytics !== 'boolean') ||
      (marketing !== undefined && typeof marketing !== 'boolean')) return null
  return { analytics: analytics === true, marketing: marketing === true }
}

function hasRevocationCookie(browser: Window): boolean {
  return browser.document?.cookie?.split(';').some(cookie => cookie.trim() === CONSENT_VETO + '=1') === true
}

function hasConsentVeto(browser: Window): boolean {
  return hasRevocationCookie(browser) || browser.sessionStorage?.getItem(CONSENT_VETO) === '1'
}

function blockTabConsent(browser: Window) {
  unresolvedConsent.add(browser)
  try { browser.sessionStorage?.setItem(CONSENT_VETO, '1') } catch { /* Keep the current document denied. */ }
}

function verifyConsentStorage(browser: Window, storage: Storage): boolean {
  if (verifiedConsentStorage.has(browser)) return true
  // Probe a separate key so a read cannot overwrite a concurrent withdrawal.
  const key = 'sp-consent-probe:' + browser.crypto.randomUUID()
  storage.setItem(key, '1')
  const written = storage.getItem(key) === '1'
  storage.removeItem(key)
  if (!written || storage.getItem(key) !== null) return false
  verifiedConsentStorage.add(browser)
  return true
}

function legacyConsentGrants(browser: Window, storage: Storage, stored: string, choice: TrackingConsent, grants: TrackingGrants): TrackingGrants | null {
  if ((!choice.analytics || grants.analytics) && (!choice.marketing || grants.marketing)) return grants
  // Old explicit preferences had boolean choices but no category grant IDs.
  // Bind IDs to those exact bytes in separate metadata. Never rewrite the
  // choice during a read: doing so could overwrite a concurrent withdrawal.
  if (stored.length > 2048) return null
  let saved: { record?: unknown; analytics?: unknown; marketing?: unknown } | null = null
  try { saved = JSON.parse(storage.getItem(LEGACY_GRANTS_KEY) ?? 'null') } catch { /* Replace malformed metadata only. */ }
  const continuous = saved?.record === stored
  const result = {
    analytics: choice.analytics ? grants.analytics ?? (continuous && isTrackingGrant(saved?.analytics) ? saved.analytics : browser.crypto.randomUUID()) : undefined,
    marketing: choice.marketing ? grants.marketing ?? (continuous && isTrackingGrant(saved?.marketing) ? saved.marketing : browser.crypto.randomUUID()) : undefined,
  }
  const serialized = JSON.stringify({ record: stored, ...result })
  if (storage.getItem(TRACKING_CONSENT_STORAGE_KEY) !== stored || hasConsentVeto(browser)) return null
  if (storage.getItem(LEGACY_GRANTS_KEY) !== serialized) storage.setItem(LEGACY_GRANTS_KEY, serialized)
  if (storage.getItem(LEGACY_GRANTS_KEY) !== serialized || storage.getItem(TRACKING_CONSENT_STORAGE_KEY) !== stored || hasConsentVeto(browser)) return null
  return result
}

function readConsentRecord(browser: Window): { choice: TrackingConsent; grants: TrackingGrants } | null {
  try {
    if (unresolvedConsent.has(browser) || hasConsentVeto(browser)) return null
    const storage = browser.localStorage
    const stored = storage.getItem(TRACKING_CONSENT_STORAGE_KEY)
    const record = stored ? JSON.parse(stored) : null
    const choice = parseConsent(record)
    if (!stored || !choice || ((choice.analytics || choice.marketing) && !verifyConsentStorage(browser, storage))) return null
    if (storage.getItem(TRACKING_CONSENT_STORAGE_KEY) !== stored || hasConsentVeto(browser)) return null
    const existing = {
      analytics: choice.analytics && isTrackingGrant(record.grants?.analytics) ? record.grants.analytics : undefined,
      marketing: choice.marketing && isTrackingGrant(record.grants?.marketing) ? record.grants.marketing : undefined,
    }
    const missingGrant = (choice.analytics && !existing.analytics) || (choice.marketing && !existing.marketing)
    // Compatibility is only for the original boolean-only format, not for a
    // malformed modern record or unknown consent metadata.
    if (missingGrant && Object.keys(record).some(key => key !== 'analytics' && key !== 'marketing')) return null
    const grants = legacyConsentGrants(browser, storage, stored, choice, existing)
    return grants ? { choice, grants } : null
  } catch {
    return null
  }
}

export function readTrackingConsentPreference(browser: Window): TrackingConsent | null {
  return readConsentRecord(browser)?.choice ?? null
}

export function readTrackingGrants(browser: Window): TrackingGrants {
  return readConsentRecord(browser)?.grants ?? {}
}

export function readTrackingConsent(browser: Window): TrackingConsent {
  return readTrackingConsentPreference(browser) ?? DENIED
}

export function chooseTrackingConsent(browser: Window, choice: TrackingConsent): boolean {
  browser.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: choice }))
  const stored = readTrackingConsentPreference(browser)
  return stored?.analytics === choice.analytics && stored.marketing === choice.marketing
}

function persistConsent(browser: Window, choice: TrackingConsent): TrackingConsent {
  try {
    const storage = browser.localStorage
    const previous = readTrackingGrants(browser)
    const grants = {
      analytics: choice.analytics ? previous.analytics ?? browser.crypto.randomUUID() : undefined,
      marketing: choice.marketing ? previous.marketing ?? browser.crypto.randomUUID() : undefined,
    }
    const serialized = JSON.stringify(grants.analytics || grants.marketing ? { ...choice, grants } : choice)
    // Invalidate the previous grant before a write that could fail.
    storage.removeItem(TRACKING_CONSENT_STORAGE_KEY)
    if (storage.getItem(TRACKING_CONSENT_STORAGE_KEY) !== null) throw new Error('Consent invalidation failed')
    if (hasConsentVeto(browser)) {
      browser.document.cookie = `${CONSENT_VETO}=; Max-Age=0; ${CONSENT_COOKIE_FLAGS}`
      browser.sessionStorage?.removeItem(CONSENT_VETO)
      if (hasConsentVeto(browser)) return DENIED
    }
    storage.setItem(TRACKING_CONSENT_STORAGE_KEY, serialized)
    if (storage.getItem(TRACKING_CONSENT_STORAGE_KEY) === serialized) {
      verifiedConsentStorage.add(browser)
      unresolvedConsent.delete(browser)
      return readTrackingConsent(browser)
    }
  } catch { /* Fall back to a denial when the new choice cannot be verified. */ }

  try {
    browser.localStorage.removeItem(TRACKING_CONSENT_STORAGE_KEY)
    if (browser.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY) === null) return DENIED
  } catch { /* The original choice may be stuck in local storage. */ }
  try {
    const denied = JSON.stringify(DENIED)
    browser.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, denied)
    if (browser.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY) === denied) return DENIED
  } catch { /* The local storage denial could not be verified. */ }

  try {
    browser.document.cookie = `${CONSENT_VETO}=1; Max-Age=34560000; ${CONSENT_COOKIE_FLAGS}`
    if (hasRevocationCookie(browser)) return DENIED
  } catch { /* Try a marker that survives reload in this tab. */ }
  blockTabConsent(browser)
  return DENIED
}

function listenForTrackingConsent(browser: TrackingWindow, update: ConsentListener) {
  let channel: BroadcastChannel | undefined
  try {
    if (browser.BroadcastChannel) channel = new browser.BroadcastChannel(TRACKING_CONSENT_STORAGE_KEY)
  } catch { /* Storage events still cover the regular synchronization path. */ }
  const sync = () => update(readTrackingConsent(browser))
  if (channel) channel.onmessage = event => {
    if (event.data === 'deny') blockTabConsent(browser)
    sync()
  }

  const onChoice = (event: Event) => {
    const choice = parseConsent((event as CustomEvent<unknown>).detail)
    if (!choice) return
    update(persistConsent(browser, choice))
    // A fallback cookie does not fire a storage event in other tabs.
    try { channel?.postMessage(unresolvedConsent.has(browser) ? 'deny' : null) } catch { /* The next read still checks the veto. */ }
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === TRACKING_CONSENT_STORAGE_KEY) sync()
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) sync()
  }
  browser.addEventListener(CONSENT_CHANGE_EVENT, onChoice)
  browser.addEventListener('storage', onStorage)
  browser.addEventListener('pageshow', onPageShow)
  return () => {
    browser.removeEventListener(CONSENT_CHANGE_EVENT, onChoice)
    browser.removeEventListener('storage', onStorage)
    browser.removeEventListener('pageshow', onPageShow)
    channel?.close()
  }
}

export function subscribeToTrackingConsent(browser: TrackingWindow, update: ConsentListener) {
  let subscription = consentSubscriptions.get(browser)
  if (!subscription) {
    const listeners = new Set<ConsentListener>()
    const stop = listenForTrackingConsent(browser, choice => {
      for (const listener of listeners) {
        try { listener(choice) } catch { /* Keep other consent listeners working if a tag throws. */ }
      }
    })
    subscription = { listeners, stop }
    consentSubscriptions.set(browser, subscription)
  }
  const { listeners, stop } = subscription
  listeners.add(update)
  return () => {
    if (listeners.delete(update) && !listeners.size) {
      stop()
      consentSubscriptions.delete(browser)
    }
  }
}

function consentState(choice: TrackingConsent) {
  const marketing = choice.marketing ? 'granted' : 'denied'
  return {
    analytics_storage: choice.analytics ? 'granted' : 'denied',
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
    personalization_storage: marketing,
  }
}

export function updateGoogleConsent(browser: TrackingWindow, choice: TrackingConsent) {
  if (!browser.__spGtmScript) return
  if (!choice.analytics) startupInteractions.delete(browser)
  const effective = isGtmReady(browser) ? choice : DENIED
  const previous = appliedGoogleConsent.get(browser)
  const changed = previous?.analytics !== effective.analytics || previous.marketing !== effective.marketing
  if (analyticsConsent.has(browser)) analyticsConsent.set(browser, false)
  if (changed) {
    browser.gtag?.('consent', 'update', consentState(effective))
    appliedGoogleConsent.set(browser, effective)
    if (effective.analytics || effective.marketing) browser.dataLayer?.push({ event: GTM_CONSENT_READY_EVENT })
  }
  if (analyticsConsent.has(browser)) analyticsConsent.set(browser, effective.analytics)
}

export function canCaptureAnalytics(browser: TrackingWindow, environment: string | undefined): boolean {
  return analyticsConsent.has(browser) && Boolean(browser.__spGtmScript) &&
    canMeasureLocation(new URL(browser.location.href), environment) && readTrackingConsent(browser).analytics
}

export function analyticsDataLayer(browser: TrackingWindow, environment: string | undefined): unknown[] | undefined {
  if (!isGtmReady(browser) || analyticsConsent.get(browser) !== true || !canCaptureAnalytics(browser, environment)) return
  return browser.dataLayer
}

/** Buffer only projected interaction payloads during startup, outside Google's queue. */
export function pushPublicInteraction(browser: Window, environment: string | undefined, event: object): boolean {
  const layer = analyticsDataLayer(browser, environment)
  if (layer) { layer.push(event); return true }
  if (isGtmReady(browser) || !canCaptureAnalytics(browser, environment)) return false
  const analytics = readTrackingGrants(browser).analytics
  if (!analytics) return false
  const previous = startupInteractions.get(browser)
  const events = previous?.analytics === analytics ? previous.events : []
  if (events.length >= 20) return false
  events.push(event)
  startupInteractions.set(browser, { analytics, events })
  return true
}

export function initializeGtm(browser: TrackingWindow, containerId: string | null, choice: TrackingConsent, environment: string | undefined, mode: 'basic' | 'advanced' = 'basic') {
  analyticsConsent.delete(browser)
  const id = normalizeGtmContainerId(containerId)
  if (!id || !canMeasureLocation(new URL(browser.location.href), environment)) {
    updateGoogleConsent(browser, DENIED)
    return
  }
  analyticsConsent.set(browser, false)
  const previous = browser.__spGtmScript
  if (previous && previous.status !== 'failed' && previous.onSettled) {
    updateGoogleConsent(browser, choice)
    return
  }
  if (mode === 'basic' && (!previous || previous.status === 'failed')) {
    // A retry must re-read consent in case it was withdrawn since the failure.
    const current = previous ? readTrackingConsent(browser) : choice
    if (!current.analytics && !current.marketing) return
  }
  const state = startGtmScript(browser, id, GTM_DENIED_DEFAULTS)
  state.onSettled = () => {
    if (state.status === 'failed') {
      startupInteractions.delete(browser)
      updateGoogleConsent(browser, DENIED)
      return
    }
    const eligible = analyticsConsent.has(browser) && canMeasureLocation(new URL(browser.location.href), environment)
    updateGoogleConsent(browser, eligible ? readTrackingConsent(browser) : DENIED)
    const pending = startupInteractions.get(browser)
    startupInteractions.delete(browser)
    if (pending && pending.analytics === readTrackingGrants(browser).analytics) {
      analyticsDataLayer(browser, environment)?.push(...pending.events)
    }
    browser.dispatchEvent(new Event(GTM_READY_EVENT))
  }
  // The early script may have finished before the consent bridge mounted.
  if (state.status !== 'loading') state.onSettled()
}
