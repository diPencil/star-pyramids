export const GTM_DENIED_DEFAULTS = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  personalization_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500,
} as const

export type GtmScriptState = {
  id: string
  status: 'loading' | 'loaded' | 'failed'
  onSettled?: () => void
}

export type GtmWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __spGtmScript?: GtmScriptState
}

// This function also runs as inline bootstrap code. Keep its dependencies in its arguments.
export function startGtmScript(browser: GtmWindow, id: string, defaults: typeof GTM_DENIED_DEFAULTS): GtmScriptState {
  const previous = browser.__spGtmScript
  if (previous && previous.status !== 'failed') return previous

  browser.dataLayer ??= []
  browser.gtag ??= function () { browser.dataLayer?.push(arguments) }
  if (!previous) {
    browser.gtag('consent', 'default', defaults)
    browser.gtag('set', 'ads_data_redaction', true)
    browser.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  }

  const state: GtmScriptState = { id, status: 'loading' }
  const script = browser.document.createElement('script')
  script.async = true
  script.referrerPolicy = 'no-referrer'
  const nonce = browser.document.querySelector?.<HTMLScriptElement>('script[nonce]')?.nonce
  if (nonce) script.nonce = nonce
  script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
  script.onload = () => {
    if (browser.__spGtmScript !== state || state.status !== 'loading') return
    state.status = 'loaded'
    state.onSettled?.()
  }
  script.onerror = () => {
    if (browser.__spGtmScript !== state || state.status !== 'loading') return
    state.status = 'failed'
    script.remove?.()
    state.onSettled?.()
  }
  browser.__spGtmScript = state
  browser.document.head.appendChild(script)
  return state
}
