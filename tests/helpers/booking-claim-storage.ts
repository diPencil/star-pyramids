/** Minimal IndexedDB fixture for serialized writes and transaction aborts. */
export function bookingClaimStorage() {
  const committed = new Map<string, string>()
  let tail = Promise.resolve()
  const fixture = {
    failClaimWrite: false,
    failCommit: false,
    beforeClaim: undefined as (() => void) | undefined,
    seedClaim: (id: string) => committed.set(id, 'claiming'),
    indexedDB: {
      open: () => {
        const request = {
          onsuccess: undefined as (() => void) | undefined,
          result: {
            close() {},
            transaction: () => {
              let aborted = false
              const changes = new Map<string, string>()
              const operations: (() => void)[] = []
              const transaction = {
                oncomplete: undefined as (() => void) | undefined,
                onabort: undefined as (() => void) | undefined,
                abort() { aborted = true },
                objectStore: () => ({
                  get: (id: string) => schedule(() => committed.get(id)),
                  put: (value: string, id: string) => schedule(() => {
                    if (value === 'claiming') {
                      if (fixture.failClaimWrite) throw Error('Synthetic claim write failure')
                      fixture.beforeClaim?.()
                    }
                    changes.set(id, value)
                  }),
                }),
              }
              function schedule<T>(run: () => T) {
                const operation = { result: undefined as T | undefined, onsuccess: undefined as (() => void) | undefined }
                operations.push(() => {
                  operation.result = run()
                  operation.onsuccess?.()
                })
                return operation
              }
              tail = tail.then(() => {
                try {
                  for (const run of operations) {
                    if (aborted) break
                    run()
                  }
                } catch { aborted = true }
                if (aborted || fixture.failCommit) transaction.onabort?.()
                else {
                  for (const [id, value] of changes) committed.set(id, value)
                  transaction.oncomplete?.()
                }
              })
              return transaction
            },
          },
        }
        queueMicrotask(() => request.onsuccess?.())
        return request
      },
    } as unknown as IDBFactory,
  }
  return fixture
}
