import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentCarQuoteState, quoteSelectionKey, startCarQuote, type QuoteSelection } from '@/lib/car-quote-client'

const selection: QuoteSelection = { vehicle: 'van', from: 'cairo', to: 'giza', trip: 'one-way', passengers: 3 }
const response = () => Response.json({ quote: { currency: 'USD', oneWayCents: 3075, roundTripCents: 6150, roundTripBasis: 'multiplier' } })
afterEach(() => vi.useRealTimers())

describe('live transfer quote lifecycle without a browser', () => {
  it('includes every price-relevant selection in its request identity', () => {
    const key = quoteSelectionKey(selection)
    for (const patch of [{ vehicle: 'sedan' }, { from: 'aswan' }, { to: 'luxor' }, { trip: 'round-trip' as const }, { passengers: 4 }]) expect(quoteSelectionKey({ ...selection, ...patch })).not.toBe(key)
  })
  it('never exposes an old amount during a new selection or retry render', () => {
    const old = { key: 'old', retry: 0, state: { kind: 'quote' as const, quote: { cents: 3075, currency: 'USD', basis: 'multiplier' as const, quotedAt: '' } } }
    expect(currentCarQuoteState('new', 0, old)).toEqual({ kind: 'loading' })
    expect(currentCarQuoteState('old', 1, old)).toEqual({ kind: 'loading' })
    expect(currentCarQuoteState('', 0, old)).toEqual({ kind: 'idle' })
    expect(currentCarQuoteState('old', 0, old)).toBe(old.state)
  })
  it('debounces and cancels a request before transport starts', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>(), publish = vi.fn()
    const cancel = startCarQuote(selection, publish, fetcher)
    cancel()
    await vi.advanceTimersByTimeAsync(500)
    expect(fetcher).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })
  it('ignores an old response even if transport ignores abort', async () => {
    vi.useFakeTimers()
    let resolve!: (value: Response) => void
    const publish = vi.fn()
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(done => { resolve = done }))
    const cancel = startCarQuote(selection, publish, fetcher)
    await vi.advanceTimersByTimeAsync(400)
    cancel(); resolve(response())
    await vi.runAllTimersAsync()
    expect(publish).not.toHaveBeenCalled()
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
  })
  it('uses the selected trip total, not the one-way unit', async () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    startCarQuote({ ...selection, trip: 'round-trip' }, publish, vi.fn<typeof fetch>(async () => response()))
    await vi.advanceTimersByTimeAsync(400)
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ kind: 'quote', quote: expect.objectContaining({ cents: 6150, currency: 'USD' }) }))
  })
  it.each([{ payload: { priceOnRequest: true }, status: 200, kind: 'por' }, { payload: { error: 'capacity' }, status: 400, kind: 'unavailable' }, { payload: { error: 'database internals' }, status: 503, kind: 'error' }, { payload: { quote: { currency: 'USD', oneWayCents: 0 } }, status: 200, kind: 'error' }])('maps $status responses to $kind safely', async ({ payload, status, kind }) => {
    vi.useFakeTimers()
    const publish = vi.fn()
    startCarQuote(selection, publish, vi.fn<typeof fetch>(async () => Response.json(payload, { status })))
    await vi.advanceTimersByTimeAsync(400)
    expect(publish).toHaveBeenCalledWith({ kind })
  })
})
