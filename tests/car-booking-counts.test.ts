import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const state = vi.hoisted(() => ({
  signedIn: true,
  permissions: ['cars.view'] as string[],
}))

const db = vi.hoisted(() => ({
  carRequest: { findMany: vi.fn() },
}))

vi.mock('@/lib/server/auth', () => ({
  getCurrentUser: async () =>
    state.signedIn
      ? { id: 'admin-1', roles: ['ADMIN'], permissions: state.permissions }
      : null,
  hasPermission: (_user: unknown, key: string) => state.permissions.includes(key),
}))
vi.mock('@/lib/server/db', () => ({ db }))

import { GET as getCarStats } from '@/app/api/admin/cars/stats/route'
import { getCarBookingCounts } from '@/lib/server/cars'

/** A confirmed transfer: staff assignment present, so it counts as a booking. */
function fetchRows(overrides: Partial<{ slug: string; status: string; assigned: string | null }> = []) {
  return [
    { assignedVehicleSlug: 'hyundai-h1-van' },
    { assignedVehicleSlug: 'hyundai-h1-van' },
    { assignedVehicleSlug: 'toyota-hiace' },
    ...overrides.map((item) => ({ assignedVehicleSlug: item.assigned })),
  ]
}

const read = () => new Request('http://localhost:3000/api/admin/cars/stats')

describe('car booking counts endpoint', () => {
  beforeEach(() => {
    state.signedIn = true
    state.permissions = ['cars.view']
    vi.clearAllMocks()
  })

  it('requires a signed-in staff identity', async () => {
    state.signedIn = false
    const response = await getCarStats(read())
    expect(response.status).toBe(401)
    expect(db.carRequest.findMany).not.toHaveBeenCalled()
  })

  it('forbids identities without cars.view', async () => {
    state.permissions = []
    const response = await getCarStats(read())
    expect(response.status).toBe(403)
    expect(db.carRequest.findMany).not.toHaveBeenCalled()
  })

  it('counts confirmed transfers per assigned vehicle and totals them', async () => {
    db.carRequest.findMany.mockResolvedValue(fetchRows())
    const response = await getCarStats(read())
    expect(response.status).toBe(200)
    const body = (await response.json()) as { stats: { totalConfirmedBookings: number; bookingsByVehicle: Record<string, number> } }
    expect(body.stats.totalConfirmedBookings).toBe(3)
    expect(body.stats.bookingsByVehicle).toEqual({ 'hyundai-h1-van': 2, 'toyota-hiace': 1 })
    expect(db.carRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignedVehicleSlug: { not: null }, status: 'CONFIRMED' },
      }),
    )
  })

  it('returns zero totals when the fleet has no confirmed transfers', async () => {
    db.carRequest.findMany.mockResolvedValue([])
    const response = await getCarStats(read())
    const body = (await response.json()) as { stats: { totalConfirmedBookings: number; bookingsByVehicle: Record<string, number> } }
    expect(body.stats.totalConfirmedBookings).toBe(0)
    expect(body.stats.bookingsByVehicle).toEqual({})
  })
})

describe('getCarBookingCounts service', () => {
  it('counts only the staff assignment, never bare rows, and returns zero-safe map lookups', async () => {
    db.carRequest.findMany.mockResolvedValue([
      { assignedVehicleSlug: 'mercedes-e-class' },
      { assignedVehicleSlug: null },
      { assignedVehicleSlug: '  ' },
    ])
    const counts = await getCarBookingCounts()
    expect(counts.get('mercedes-e-class')).toBe(1)
    expect(counts.get('toyota-corolla')).toBeUndefined()
  })

  it('admin fleet page renders a fourth stat card and a sortable bookings column', () => {
    const page = readFileSync(path.resolve(__dirname, '../app/admin/cars/page.tsx'), 'utf8')
    expect(page).toContain('Confirmed bookings')
    expect(page).toContain('/api/admin/cars/stats')
    expect(page).toContain('"bookings"')
    const statsRoute = readFileSync(path.resolve(__dirname, '../app/api/admin/cars/stats/route.ts'), 'utf8')
    expect(statsRoute).toContain("hasPermission(current, 'cars.view')")
    expect(statsRoute).toContain('getCarBookingCounts')
    const service = readFileSync(path.resolve(__dirname, '../lib/server/cars.ts'), 'utf8')
    expect(service).toContain('status: "CONFIRMED"')
    expect(service).toContain('assignedVehicleSlug')
  })
})
