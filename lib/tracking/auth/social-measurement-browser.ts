import { analyticsDataLayer, readTrackingGrants } from '../tracking-browser'
import { SOCIAL_MEASUREMENT_HEADER, SOCIAL_MEASUREMENT_PATH, SOCIAL_MEASUREMENT_TTL, parseSocialMeasurement } from './social-measurement'

const deliveredKey = 'sp-social-measured-v1'
const running = new WeakSet<Window>()
const completed = new WeakSet<Window>()

export async function flushSocialMeasurements(browser: Window, environment: string | undefined) {
  if (running.has(browser) || completed.has(browser) || !analyticsDataLayer(browser, environment)) return
  running.add(browser)
  const flush = async () => {
    if (!analyticsDataLayer(browser, environment)) return
    const grant = readTrackingGrants(browser).analytics
    if (!grant) return
    const response = await browser.fetch(SOCIAL_MEASUREMENT_PATH, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { [SOCIAL_MEASUREMENT_HEADER]: grant }, signal: AbortSignal.timeout(3500),
    })
    if (!response.ok) return
    const { events } = await response.json() as { events?: unknown[] }
    if (!Array.isArray(events) || events.length > 4) return
    completed.add(browser)

    for (const raw of events) {
      const event = parseSocialMeasurement(raw)
      const layer = analyticsDataLayer(browser, environment)
      if (!layer || readTrackingGrants(browser).analytics !== grant) return
      if (!event) continue
      const storage = browser.localStorage
      const now = Date.now()
      const previous = JSON.parse(storage.getItem(deliveredKey) ?? '[]') as [string, number][]
      const delivered = Array.isArray(previous) ? previous.filter(entry => Array.isArray(entry) && entry[1] > now) : []
      if (delivered.some(([id]) => id === event.event_id)) continue
      storage.setItem(deliveredKey, JSON.stringify([...delivered.slice(-63), [event.event_id, now + SOCIAL_MEASUREMENT_TTL]]))
      layer.push(event)
    }
  }
  try {
    const locks = browser.navigator?.locks
    if (locks) await locks.request('sp-social-measurement', flush)
    else await flush()
  } catch { /* Optional measurement failures have no impact on account access. */ }
  finally { running.delete(browser) }
}
