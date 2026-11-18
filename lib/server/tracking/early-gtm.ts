import 'server-only'
import { GTM_DENIED_DEFAULTS, startGtmScript } from '../../tracking/gtm-script'
import { canMeasureLocation, normalizeGtmContainerId, publicTrackingAnchors, TRACKING_ELIGIBLE_HEADER, type TrackingSettings } from '../../tracking/tracking'

export function earlyGtmBootstrap(request: Pick<Headers, 'get'>, settings: TrackingSettings | null, environment: string | undefined, enabled: string | undefined): string | null {
  // Enable only after the published container's third-party consent gates are verified.
  if (enabled !== 'true' || request.get(TRACKING_ELIGIBLE_HEADER) !== '1' || !settings?.enabled) return null
  const id = normalizeGtmContainerId(settings.containerId)
  const host = request.get('host')
  const path = request.get('x-sp-path')
  if (!id || !host || !path?.startsWith('/')) return null

  let approved: URL
  try { approved = new URL(`https://${host}${path}`) } catch { return null }
  if (approved.host !== host.toLowerCase() || approved.hash || !canMeasureLocation(approved, environment)) return null

  const args = JSON.stringify({
    id, origin: approved.origin, path: approved.pathname + approved.search,
    anchors: publicTrackingAnchors(approved.pathname), defaults: GTM_DENIED_DEFAULTS,
  }).replace(/</g, '\\u003c')

  // Bind this bootstrap to the server-reviewed document and validate the browser-only fragment.
  return `(function(config, start) {
    var url = new URL(window.location.href);
    if (url.origin === config.origin && !url.username && !url.password &&
        url.pathname + url.search === config.path && (!url.hash || config.anchors.includes(url.hash))) {
      start(window, config.id, config.defaults);
    }
  })(${args}, ${startGtmScript.toString()});`
}
