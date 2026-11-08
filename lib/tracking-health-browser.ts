import { canMeasureLocation, isTrackingGrant } from './tracking'
import { gtmScriptHealth, observedGtmContainerId, readTrackingConsent } from './tracking-browser'
import { browserTrackingHealth, type TrackingHealthCheck, type TrackingBrowserSnapshot } from './tracking-health'

const CHANNEL = 'sp-tracking-health-v1'
type BrowserWithChannel = Window & { BroadcastChannel?: typeof BroadcastChannel }

/** Respond only to same-origin, ephemeral requests. No URLs, customer data or consent proofs leave this tab. */
export function installTrackingHealthResponder(browser: BrowserWithChannel, environment: string | undefined, containerId: string | null) {
  let channel: BroadcastChannel | undefined
  try {
    if (!browser.BroadcastChannel) return () => {}
    channel = new browser.BroadcastChannel(CHANNEL)
    channel.onmessage = event => {
      if (event.data?.type !== 'request' || !isTrackingGrant(event.data.nonce)) return
      try {
        const consent = readTrackingConsent(browser)
        const snapshot: TrackingBrowserSnapshot = { observedAt: new Date().toISOString(), containerId: observedGtmContainerId(browser) ?? containerId,
          eligible: canMeasureLocation(new URL(browser.location.href), environment), analytics: consent.analytics, marketing: consent.marketing, script: gtmScriptHealth(browser) }
        channel?.postMessage({ type: 'response', nonce: event.data.nonce, snapshot })
      } catch { /* Diagnostics are optional and must not affect a public page. */ }
    }
  } catch { /* Unsupported or blocked channels mean no browser evidence. */ }
  return () => channel?.close()
}

export function observeTrackingBrowser(browser: BrowserWithChannel, containerId: string): Promise<TrackingHealthCheck> {
  return new Promise(resolve => {
    let channel: BroadcastChannel | undefined
    try {
      if (!browser.BroadcastChannel) { resolve({ status: 'not_verified', code: 'browser_channel_unavailable' }); return }
      channel = new browser.BroadcastChannel(CHANNEL)
      const nonce = browser.crypto.randomUUID()
      const results: TrackingHealthCheck[] = []
      channel.onmessage = event => {
        if (event.data?.type === 'response' && event.data.nonce === nonce && results.length < 50) results.push(browserTrackingHealth(event.data.snapshot, containerId))
      }
      browser.setTimeout(() => {
        channel?.close()
        const relevant = results.filter(c => !['browser_invalid_observation', 'browser_ineligible'].includes(c.code))
        const issue = relevant.find(c => c.status === 'error') ?? relevant.find(c => c.status === 'action_required')
        const loaded = relevant.filter(c => c.status === 'verified')
        resolve(issue ?? (loaded.length ? { ...loaded[0], evidence: { ...loaded[0].evidence, observedTabs: relevant.length, loadedTabs: loaded.length } } : relevant[0] ?? { status: 'not_verified', code: 'browser_no_observation' }))
      }, 1200)
      channel.postMessage({ type: 'request', nonce })
    } catch {
      channel?.close()
      resolve({ status: 'not_verified', code: 'browser_channel_unavailable' })
    }
  })
}
