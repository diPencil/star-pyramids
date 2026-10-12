// Vitest setup file for payment tests
import { vi } from 'vitest'

// Mock server-only to not throw in test environment
vi.mock('server-only', () => ({}))

// Mock next/headers for webhook tests
vi.mock('next/headers', () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

// Mock @prisma/client for decimal handling. The Prisma namespace keeps
// every actual runtime helper (join, sql, enums, errors) — only Decimal
// is swapped, so raw-SQL paths under test behave like production.
vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client')
  return {
    ...actual,
    Decimal: class Decimal {
      constructor(public value: string | number) {}
      toString() { return this.value.toString() }
      toFixed(dp: number) { return Number(this.value).toFixed(dp) }
      plus(other: Decimal | number | string) { return new Decimal(Number(this.value) + Number(other)) }
      minus(other: Decimal | number | string) { return new Decimal(Number(this.value) - Number(other)) }
      times(other: Decimal | number | string) { return new Decimal(Number(this.value) * Number(other)) }
      div(other: Decimal | number | string) { return new Decimal(Number(this.value) / Number(other)) }
      static isDecimal(obj: any) { return obj instanceof Decimal }
    },
    Prisma: {
      ...actual.Prisma,
      Decimal: class Decimal {
        constructor(public value: string | number) {}
        toString() { return this.value.toString() }
        toFixed(dp: number) { return Number(this.value).toFixed(dp) }
      },
    },
  }
})