type EnqueueResult = 'enqueued' | 'already_enqueued' | 'ineligible' | 'push_failed'
type ClaimResult = EnqueueResult | 'storage_failed' | 'enqueue_unconfirmed'

const STORE = 'enqueued'

async function openClaims(browser: Window): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const request = browser.indexedDB.open('sp-booking-enqueue', 1)
    let blocked = false
    request.onblocked = () => { blocked = true; resolve(null) }
    request.onerror = () => resolve(null)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else resolve(request.result)
    }
  })
}

/** Both Web Locks and fallback drains use the same origin-wide claim. */
export async function claimBookingEnqueue(browser: Window, eventId: string, enqueue: () => EnqueueResult): Promise<ClaimResult> {
  try {
    const database = await openClaims(browser)
    if (!database) return 'storage_failed'
    try {
      return await new Promise<ClaimResult>((resolve) => {
        const transaction = database.transaction(STORE, 'readwrite')
        let result: EnqueueResult | 'storage_failed' = 'storage_failed'
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () => resolve(result === 'enqueued' ? 'enqueue_unconfirmed' : result)
        const store = transaction.objectStore(STORE)
        const existing = store.get(eventId)
        existing.onsuccess = () => {
          if (existing.result === 'enqueued') { result = 'already_enqueued'; return }
          const claim = store.put('claiming', eventId)
          claim.onsuccess = () => {
            // The claim is still uncommitted here. An abandoned claim can be retried.
            try { result = enqueue() } catch { result = 'storage_failed' }
            if (result === 'enqueued') store.put('enqueued', eventId)
            else transaction.abort()
          }
        }
      })
    } finally { database.close() }
  } catch { return 'storage_failed' }
}
