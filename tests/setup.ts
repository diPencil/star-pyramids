// Vitest setup file for payment tests
import { vi } from 'vitest'

// Mock server-only to not throw in test environment
vi.mock('server-only', () => ({}))

// Mock next/headers for webhook tests
vi.mock('next/headers', () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}))

// Mock @prisma/client for decimal handling
vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual('@prisma/client')
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
      Decimal: class Decimal {
        constructor(public value: string | number) {}
        toString() { return this.value.toString() }
        toFixed(dp: number) { return Number(this.value).toFixed(dp) }
      },
    },
  }
})