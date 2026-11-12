export type CheckoutReceipt = {
  reference: string
  total: number | null
  existing: boolean
  linked: boolean
  guest: boolean
  email: string
  guestAccessUrl: string | null
}

export const CONFIRMATION_FLOW = /^[a-f0-9]{32}$/
export const CHECKOUT_DETAILS_PATH = '/checkout/details'

/** The flow selects an HttpOnly context; it is not a booking access token. */
export async function openBookingConfirmation(browser: Window, target: unknown): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (typeof target !== 'string' || !/^\/booking-confirmation\?flow=[a-f0-9]{32}$/.test(target)) return false
    const source = browser.location.href
    if (new URL(source).pathname !== CHECKOUT_DETAILS_PATH) return false
    const flow = new URL(target, source).searchParams.get('flow')!
    // Verify the browser actually accepted the HttpOnly cookie. A blocked
    // cookie or network failure leaves the existing successful receipt intact.
    const controller = new AbortController()
    timer = setTimeout(() => controller.abort(), 2500)
    for (let attempt = 0; attempt < 2 && !controller.signal.aborted && browser.location.href === source; attempt++) {
      try {
        const response = await browser.fetch('/api/bookings/confirmation', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ flow }),
          credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
        })
        if (response.status >= 500) continue
        if (!response.ok || (await response.json()).ready !== true) return false
      } catch {
        // Retry the read-only acknowledgement once after a transient failure.
        continue
      }
      if (controller.signal.aborted || browser.location.href !== source) return false
      browser.location.assign(target)
      return true
    }
    return false
  } catch { return false }
  finally { if (timer !== undefined) clearTimeout(timer) }
}
