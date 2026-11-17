type EnqueueResult = 'enqueued' | 'already_enqueued' | 'ineligible' | 'push_failed'
type ClaimResult = EnqueueResult | 'storage_failed' | 'claim_timed_out' | 'enqueue_unconfirmed'

const STORE = 'enqueued'
export const BOOKING_CLAIM_TIMEOUT_MS = 2000

/** Both Web Locks and fallback drains use the same origin-wide claim. */
export function claimBookingEnqueue(browser: Window, eventId: string, enqueue: () => EnqueueResult): Promise<ClaimResult> {
  return new Promise((resolve) => {
    let database: IDBDatabase | undefined
    let transaction: IDBTransaction | undefined
    let settled = false
    let result: EnqueueResult | 'storage_failed' = 'storage_failed'
    const deadline = Date.now() + BOOKING_CLAIM_TIMEOUT_MS
    const timer = setTimeout(expire, BOOKING_CLAIM_TIMEOUT_MS)

    function finish(status: ClaimResult, abort = false) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (abort) {
        try { transaction?.abort() } catch { /* The transaction may have finished. */ }
      }
      database?.close()
      resolve(status)
    }

    function expire() {
      // A push already accepted by dataLayer must keep its chance to commit.
      if (result === 'enqueued') finish('enqueue_unconfirmed')
      else finish('claim_timed_out', true)
    }

    function stopped() {
      // An IndexedDB callback may run after the deadline but before the timer task.
      if (!settled && Date.now() >= deadline) expire()
      return settled
    }

    try {
      const request = browser.indexedDB.open('sp-booking-enqueue', 1)
      request.onblocked = request.onerror = () => finish('storage_failed')
      request.onupgradeneeded = () => {
        if (stopped()) request.transaction?.abort()
        else request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => {
        if (stopped()) { request.result.close(); return }
        database = request.result
        try {
          const active = database.transaction(STORE, 'readwrite')
          transaction = active
          active.oncomplete = () => finish(result)
          active.onabort = () => finish(result === 'enqueued' ? 'enqueue_unconfirmed' : result)
          const store = active.objectStore(STORE)
          const existing = store.get(eventId)
          existing.onsuccess = () => {
            if (stopped()) return
            if (existing.result === 'enqueued') { finish('already_enqueued'); return }
            try {
              const claim = store.put('claiming', eventId)
              claim.onsuccess = () => {
                if (stopped()) return
                // The claim is still uncommitted here. An abandoned claim can be retried.
                try { result = enqueue() } catch { result = 'storage_failed' }
                if (result !== 'enqueued') { finish(result, true); return }
                try { store.put('enqueued', eventId) } catch { finish('enqueue_unconfirmed', true) }
              }
            } catch { finish('storage_failed', true) }
          }
        } catch { finish('storage_failed', true) }
      }
    } catch { finish('storage_failed') }
  })
}
