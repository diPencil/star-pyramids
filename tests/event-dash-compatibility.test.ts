import { expect, it } from 'vitest'
import { resolveEventRange } from '@/lib/events/events'

it.each(['-', '\u2013', '\u2014'])('preserves legacy event date ranges separated by %s', separator => {
  const range = resolveEventRange({ date: `October 4${separator}7, 2026` })
  expect(range.start?.getDate()).toBe(4)
  expect(range.end?.getDate()).toBe(7)
  expect(range.end?.getFullYear()).toBe(2026)
})
