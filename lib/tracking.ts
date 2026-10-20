export const DEFAULT_GTM_CONTAINER_ID = 'GTM-KQ8GR36H'
export const TRACKING_CONSENT_STORAGE_KEY = 'sp-consent'

const GTM_CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/
const PRIVATE_TRACKING_PREFIXES = ['/admin', '/account', '/website-cms-preview'] as const

export interface TrackingSettings {
  enabled: boolean
  containerId: string
}

export function normalizeGtmContainerId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return GTM_CONTAINER_ID_PATTERN.test(id) ? id : null
}

export function isValidGtmContainerId(value: unknown): value is string {
  return normalizeGtmContainerId(value) !== null
}

export function resolveTrackingSettings(input: { enabled?: unknown; containerId?: unknown }): TrackingSettings {
  const rawEnabled = typeof input.enabled === 'string' ? input.enabled.trim().toLowerCase() : ''
  const rawContainerId = typeof input.containerId === 'string' ? input.containerId.trim() : ''
  const configured = rawContainerId ? normalizeGtmContainerId(rawContainerId) : null
  const containerId = rawContainerId ? configured ?? '' : DEFAULT_GTM_CONTAINER_ID
  return {
    enabled: containerId !== '' && (rawEnabled === '' || rawEnabled === 'true'),
    containerId,
  }
}

export function isTrackingExcludedPath(requestPath: string): boolean {
  const pathname = requestPath.split(/[?#]/, 1)[0] || '/'
  return PRIVATE_TRACKING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function buildGtmLoaderSnippet(containerId: string): string {
  const id = normalizeGtmContainerId(containerId)
  if (!id) throw new Error('Invalid Google Tag Manager Container ID.')
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`
}

export function buildConsentDefaultSnippet(): string {
  return `window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};(function(w){function u(c){if(!c||typeof c!=='object'||Array.isArray(c))return;var av=c.analytics,mv=c.marketing;if((av!==undefined&&typeof av!=='boolean')||(mv!==undefined&&typeof mv!=='boolean'))return;var a=av===true?'granted':'denied';var m=mv===true?'granted':'denied';w.gtag('consent','update',{analytics_storage:a,ad_storage:m,ad_user_data:m,ad_personalization:m,personalization_storage:m});}w.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',personalization_storage:'denied',security_storage:'granted',wait_for_update:500});w.gtag('set','ads_data_redaction',true);try{var r=w.localStorage.getItem(${JSON.stringify(TRACKING_CONSENT_STORAGE_KEY)});if(r){u(JSON.parse(r));}}catch(e){}w.addEventListener('sp:consent-change',function(e){if(e&&e.detail){u(e.detail);}});})(window);`
}

export function buildGtmIntegrationSnippet(containerId: string): string {
  const loader = buildGtmLoaderSnippet(containerId)
  return `if(!window.__spGtmInitialized){window.__spGtmInitialized=true;${buildConsentDefaultSnippet()}\n${loader}}`
}
