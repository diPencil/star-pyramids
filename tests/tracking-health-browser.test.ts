import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { installTrackingHealthResponder, observeTrackingBrowser } from '@/lib/tracking/health/tracking-health-browser'
import { initializeGtm, readTrackingConsent } from '@/lib/tracking/tracking-browser'
import { TRACKING_CONSENT_STORAGE_KEY } from '@/lib/tracking/tracking'

class Channel {
  static channels = new Set<Channel>()
  onmessage: ((event: MessageEvent) => void) | null = null
  closed = false
  constructor(public name: string) { Channel.channels.add(this) }
  postMessage(data: unknown) { for (const channel of Channel.channels) if (channel !== this && channel.name === this.name) channel.onmessage?.({ data } as MessageEvent) }
  close() { this.closed = true; Channel.channels.delete(this) }
}
function browser(href = 'https://starpyramids.com/trips', granted = false) {
  const values = new Map<string, string>()
  if (granted) values.set(TRACKING_CONSENT_STORAGE_KEY, '{"analytics":true,"marketing":false}')
  const scripts: { onload?: () => void; onerror?: () => void }[] = []
  const result = Object.assign(new EventTarget(), {
    location: { href }, crypto: { randomUUID }, BroadcastChannel: Channel,
    setTimeout, clearTimeout,
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, v: string) => { values.set(key, v) }, removeItem: (key: string) => { values.delete(key) } },
    document: { createElement: () => ({}), head: { appendChild: vi.fn((script: typeof scripts[number]) => { scripts.push(script) }) } },
    dataLayer: [] as unknown[],
  })
  return { browser: result as unknown as Window & { BroadcastChannel: typeof BroadcastChannel }, result, scripts }
}
afterEach(() => { for (const channel of Channel.channels) channel.close(); vi.useRealTimers() })

it('observes saved denial without initializing GTM, granting consent or leaking URLs', async () => {
  vi.useFakeTimers()
  const page = browser()
  const stop = installTrackingHealthResponder(page.browser, 'production', 'GTM-KQ8GR36H')
  const admin = browser('https://starpyramids.com/admin/website-cms/seo')
  const report = observeTrackingBrowser(admin.browser, 'GTM-KQ8GR36H')
  await vi.advanceTimersByTimeAsync(1200)
  expect(await report).toMatchObject({ status: 'not_verified', code: 'browser_consent_denied' })
  expect(page.result.document.head.appendChild).not.toHaveBeenCalled()
  expect(page.result.dataLayer).toEqual([])
  expect(JSON.stringify(await report)).not.toContain('https://')
  stop()
  expect(Channel.channels.size).toBe(0)
})

it('requires an already-loaded consenting public tab and does not create another tag', async () => {
  vi.useFakeTimers()
  const page = browser(undefined, true)
  initializeGtm(page.browser, 'GTM-KQ8GR36H', readTrackingConsent(page.browser), 'production')
  page.scripts[0].onload?.()
  const stop = installTrackingHealthResponder(page.browser, 'production', 'GTM-KQ8GR36H')
  const report = observeTrackingBrowser(browser().browser, 'GTM-KQ8GR36H')
  await vi.advanceTimersByTimeAsync(1200)
  expect(await report).toMatchObject({ status: 'verified', code: 'browser_observed', evidence: { loadedTabs: 1 } })
  expect(page.result.document.head.appendChild).toHaveBeenCalledOnce()
  stop()
})

it('verifies pre-consent Advanced script load without claiming Analytics or Marketing consent', async () => {
  vi.useFakeTimers()
  const page = browser()
  initializeGtm(page.browser, 'GTM-KQ8GR36H', readTrackingConsent(page.browser), 'production', 'advanced')
  page.scripts[0].onload?.()
  const stop = installTrackingHealthResponder(page.browser, 'production', 'GTM-KQ8GR36H')
  const report = observeTrackingBrowser(browser().browser, 'GTM-KQ8GR36H')
  await vi.advanceTimersByTimeAsync(1200)
  expect(await report).toMatchObject({ status: 'verified', code: 'browser_observed', evidence: { analyticsConsent: false, marketingConsent: false } })
  expect(page.result.document.head.appendChild).toHaveBeenCalledOnce()
  stop()
})

it('does not verify a private page or a server request without a browser witness', async () => {
  vi.useFakeTimers()
  const privatePage = browser('https://starpyramids.com/account?token=private', true)
  const stop = installTrackingHealthResponder(privatePage.browser, 'production', 'GTM-KQ8GR36H')
  const result = observeTrackingBrowser(browser().browser, 'GTM-KQ8GR36H')
  await vi.advanceTimersByTimeAsync(1200)
  expect(await result).toMatchObject({ status: 'not_verified', code: 'browser_no_observation' })
  expect(JSON.stringify(await result)).not.toContain('private')
  stop()
})

it('reports the actual loaded container rather than a later configuration prop', async () => {
  vi.useFakeTimers()
  const page = browser(undefined, true)
  initializeGtm(page.browser, 'GTM-OLD123', readTrackingConsent(page.browser), 'production')
  page.scripts[0].onload?.()
  const stop = installTrackingHealthResponder(page.browser, 'production', 'GTM-KQ8GR36H')
  const result = observeTrackingBrowser(browser().browser, 'GTM-KQ8GR36H')
  await vi.advanceTimersByTimeAsync(1200)
  expect(await result).toMatchObject({ status: 'action_required', code: 'browser_container_mismatch' })
  stop()
})

it('fails closed when cross-tab observation is unavailable', async () => {
  const page = browser()
  Object.assign(page.browser, { BroadcastChannel: undefined })
  const stop = installTrackingHealthResponder(page.browser, 'production', 'GTM-KQ8GR36H')
  expect(await observeTrackingBrowser(page.browser, 'GTM-KQ8GR36H')).toMatchObject({ status: 'not_verified', code: 'browser_channel_unavailable' })
  expect(page.result.document.head.appendChild).not.toHaveBeenCalled()
  stop()
})
