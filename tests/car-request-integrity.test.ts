// Rent Cars server-integrity tests (Phase 1). All database boundaries are
// mocked â€” no production or client-facing records are touched. Covers:
// confirmation vehicle-assignment gate, published-fleet resolution, strict
// seat-capacity parsing, and PUT /api/cars/[slug] independence from the 
// removed legacy daily-rate field.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'

/** Instance-compatible Prisma errors: car-pricing matches on instanceof. */
function prismaError(code: 'P2002' | 'P2003'): unknown {
  return new Prisma.PrismaClientKnownRequestError('fake-db', { code, clientVersion: 'test' })
}

type Row = Record<string, any>

const helpers = vi.hoisted(() => {
  const store = {
    cars: new Map<string, Row>(),
    requests: new Map<string, Row>(),
    locations: new Map<string, Row>(),
    routes: new Map<string, Row>(),
    prices: new Map<string, Row>(),
  }

  function project(row: Row, select?: Record<string, boolean>): Row {
    if (!select) return structuredClone(row)
    const out: Row = {}
    for (const key of Object.keys(select)) if (select[key]) out[key] = row[key]
    return out
  }

  function sortRows(rows: Row[], orderBy: Row[] = []): Row[] {
    const sorters = orderBy.map((order) => {
      const key = Object.keys(order)[0]
      const dir = order[key] === 'desc' ? -1 : 1
      return (a: Row, b: Row) => {
        if (a[key] < b[key]) return -1 * dir
        if (a[key] > b[key]) return 1 * dir
        return 0
      }
    })
    rows.sort((a, b) => {
      for (const compare of sorters) {
        const result = compare(a, b)
        if (result !== 0) return result
      }
      return 0
    })
    return rows
  }

  function findRequest(args: {
    where: { reference?: string; id?: string }
    select?: any
    include?: any
  }): Row | null {
    const row = [...store.requests.values()].find((r) =>
      args.where.reference ? r.reference === args.where.reference : r.id === args.where.id,
    )
    if (!row) return null
    if (args.select) return project(row, args.select)
    const joined = structuredClone(row)
    joined.activities = structuredClone(row.activities ?? [])
    joined.user = row.user ? structuredClone(row.user) : null
    return joined
  }

  function applyUpdate(row: Row, data: Row): void {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'activities') {
        const create = value?.create
        if (create) {
          row.activities = row.activities ?? []
          row.activities.push({ ...create, note: create.note ?? null, createdAt: new Date() })
        }
        continue
      }
      row[key] = value
    }
    row.updatedAt = new Date()
  }

  const carApi: Record<string, any> = {
    findUnique: async (args: { where: { slug?: string }; select?: any }) => {
      const row = store.cars.get(args.where.slug ?? '')
      return row ? project(row, args.select) : null
    },
    update: async (args: { where: { slug: string }; data: Row }) => {
      const row = store.cars.get(args.where.slug)
      if (!row) throw { code: 'P2025' }
      applyUpdate(row, args.data)
      return structuredClone(row)
    },
  }

  const carRequestApi: Record<string, any> = {
    findUnique: async (args: { where: { reference?: string; id?: string }; select?: any; include?: any }) =>
      findRequest(args),
    update: async (args: { where: { id: string }; data: Row }) => {
      const row = [...store.requests.values()].find((r) => r.id === args.where.id)
      if (!row) throw { code: 'P2025' }
      applyUpdate(row, args.data)
      return findRequest({ where: { id: row.id }, include: true })
    },
    create: async (args: { data: Row; include?: any }) => {
      const { activities, ...rest } = structuredClone(args.data)
      const row: Row = {
        id: `cr-${Math.random().toString(36).slice(2)}`,
        userId: null,
        assignedVehicleSlug: null,
        notes: null,
        activities: [],
        user: null,
        ...rest,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      if (activities?.create) {
        row.activities = [{ ...activities.create, note: activities.create.note ?? null, createdAt: new Date() }]
      }
      store.requests.set(row.reference, row)
      return findRequest({ where: { id: row.id }, include: true })
    },
  }

  const fakeDb: Record<string, any> = {
    car: carApi,
    carRequest: carRequestApi,
    carLocation: {
      findUnique: async (args: { where: { slug?: string }; select?: any }) => {
        const row = args.where.slug ? store.locations.get(args.where.slug) : null
        return row ? project(row, args.select) : null
      },
      findMany: async (args: { where?: { isActive?: boolean }; orderBy?: Row[] }) => {
        let rows = [...store.locations.values()].map((row) => row)
        if (args.where?.isActive !== undefined) rows = rows.filter((row) => row.isActive === args.where.isActive)
        sortRows(rows, args.orderBy)
        return rows.map((row) => structuredClone(row))
      },
      create: async (args: { data: Row }) => {
        if (store.locations.has(args.data.slug)) throw prismaError('P2002')
        const row: Row = {
          id: `loc-${++modelSeq}`,
          nameEs: null,
          nameIt: null,
          nameAr: null,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.locations.set(row.slug, row)
        return structuredClone(row)
      },
      update: async (args: { where: { slug: string }; data: Row }) => {
        const row = store.locations.get(args.where.slug)
        if (!row) throw { code: 'P2025' }
        applyUpdate(row, args.data)
        return structuredClone(row)
      },
      delete: async (args: { where: { slug: string } }) => {
        const row = store.locations.get(args.where.slug)
        if (!row) throw { code: 'P2025' }
        const referenced = [...store.routes.values()].some(
          (route) => route.originSlug === args.where.slug || route.destinationSlug === args.where.slug,
        )
        if (referenced) throw prismaError('P2003')
        store.locations.delete(args.where.slug)
        return structuredClone(row)
      },
    },
    carRoute: {
      findUnique: async (args: { where: { id?: string; originSlug_destinationSlug?: { originSlug: string; destinationSlug: string } }; include?: any }) => {
        let row: Row | null = null
        if (args.where.originSlug_destinationSlug) {
          const { originSlug, destinationSlug } = args.where.originSlug_destinationSlug
          row = [...store.routes.values()].find((r) => r.originSlug === originSlug && r.destinationSlug === destinationSlug) ?? null
        } else if (args.where.id) {
          row = [...store.routes.values()].find((r) => r.id === args.where.id) ?? null
        }
        if (!row) return null
        const joined = structuredClone(row)
        if (args.include) {
          const origin = store.locations.get(row.originSlug)
          const destination = store.locations.get(row.destinationSlug)
          joined.origin = origin ? { slug: origin.slug, nameEn: origin.nameEn, isActive: origin.isActive } : null
          joined.destination = destination ? { slug: destination.slug, nameEn: destination.nameEn, isActive: destination.isActive } : null
        }
        return joined
      },
      findMany: async (args: { where?: { isActive?: boolean }; orderBy?: Row[]; include?: any }) => {
        let rows = [...store.routes.values()]
        if (args.where?.isActive !== undefined) rows = rows.filter((row) => row.isActive === args.where.isActive)
        sortRows(rows, args.orderBy)
        return rows.map((row) => {
          const joined = structuredClone(row)
          if (args.include) {
            const origin = store.locations.get(row.originSlug)
            const destination = store.locations.get(row.destinationSlug)
            joined.origin = origin ? { slug: origin.slug, nameEn: origin.nameEn, isActive: origin.isActive } : null
            joined.destination = destination ? { slug: destination.slug, nameEn: destination.nameEn, isActive: destination.isActive } : null
          }
          return joined
        })
      },
      create: async (args: { data: Row }) => {
        const duplicate = [...store.routes.values()].find(
          (r) => r.originSlug === args.data.originSlug && r.destinationSlug === args.data.destinationSlug,
        )
        if (duplicate) throw prismaError('P2002')
        const row: Row = {
          id: `route-${String(modelSeq).padStart(20, '0')}`,
          sortOrder: 0,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.routes.set(row.id, row)
        return structuredClone(row)
      },
      update: async (args: { where: { id: string }; data: Row }) => {
        const row = [...store.routes.values()].find((r) => r.id === args.where.id)
        if (!row) throw { code: 'P2025' }
        applyUpdate(row, args.data)
        return structuredClone(row)
      },
      delete: async (args: { where: { id: string } }) => {
        const row = [...store.routes.values()].find((r) => r.id === args.where.id)
        if (!row) throw { code: 'P2025' }
        const referenced = [...store.prices.values()].some((price) => price.routeId === args.where.id)
        if (referenced) throw prismaError('P2003')
        store.routes.delete(args.where.id)
        return structuredClone(row)
      },
    },
    carRoutePrice: {
      findUnique: async (args: { where: { id?: string; routeId_carSlug?: { routeId: string; carSlug: string } }; select?: any }) => {
        let row: Row | null = null
        if (args.where.routeId_carSlug) {
          const { routeId, carSlug } = args.where.routeId_carSlug
          row = [...store.prices.values()].find((p) => p.routeId === routeId && p.carSlug === carSlug) ?? null
        } else if (args.where.id) {
          row = [...store.prices.values()].find((p) => p.id === args.where.id) ?? null
        }
        return row ? project(row, args.select) : null
      },
      findMany: async (args: { where?: { routeId?: string; carSlug?: string }; orderBy?: Row[] }) => {
        let rows = [...store.prices.values()]
        if (args.where?.routeId !== undefined) rows = rows.filter((row) => row.routeId === args.where.routeId)
        if (args.where?.carSlug !== undefined) rows = rows.filter((row) => row.carSlug === args.where.carSlug)
        sortRows(rows, args.orderBy)
        return rows.map((row) => structuredClone(row))
      },
      create: async (args: { data: Row }) => {
        const duplicate = [...store.prices.values()].find(
          (p) => p.routeId === args.data.routeId && p.carSlug === args.data.carSlug,
        )
        if (duplicate) throw prismaError('P2002')
        const row: Row = {
          id: `price-${String(modelSeq).padStart(20, '0')}`,
          roundTripCents: null,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.prices.set(row.id, row)
        return structuredClone(row)
      },
      update: async (args: { where: { id: string }; data: Row }) => {
        const row = [...store.prices.values()].find((p) => p.id === args.where.id)
        if (!row) throw { code: 'P2025' }
        applyUpdate(row, args.data)
        return structuredClone(row)
      },
      delete: async (args: { where: { id: string } }) => {
        const row = [...store.prices.values()].find((p) => p.id === args.where.id)
        if (!row) throw { code: 'P2025' }
        store.prices.delete(args.where.id)
        return structuredClone(row)
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      // Snapshot/restore: concurrent-invalidation semantics without threads.
      const snapshots = (): [string, Map<string, Row>[]][] => [
        ['cars', [new Map([...store.cars])]],
        ['requests', [new Map([...store.requests])]],
        ['locations', [new Map([...store.locations])]],
        ['routes', [new Map([...store.routes])]],
        ['prices', [new Map([...store.prices])]],
      ]
      const saved = snapshots().map(([key, maps]) => [key, maps[0]] as [string, Map<string, Row>])
      try {
        return await fn(fakeDb)
      } catch (error) {
        const target: Record<string, Map<string, Row>> = {
          cars: store.cars,
          requests: store.requests,
          locations: store.locations,
          routes: store.routes,
          prices: store.prices,
        }
        for (const [key, value] of saved) {
          target[key] = new Map(value as Map<string, Row>)
        }
        throw error
      }
    },
  }

  let modelSeq = 0

  return { store, fakeDb, modelSeqRef: () => modelSeq, bumpModelSeq: () => { modelSeq += 1 } }
})
const { store, fakeDb } = helpers

vi.mock('@/lib/server/db', () => ({ db: helpers.fakeDb }))
vi.mock('@/lib/server/notifications', () => ({
  notifyUser: vi.fn(async () => undefined),
  notifyStaff: vi.fn(async () => undefined),
}))
vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: vi.fn(async () => undefined),
  sendStaffEmailSafe: vi.fn(async () => undefined),
}))
vi.mock('@/lib/server/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'staff-1', roles: ['STAFF'] })),
  hasPermission: vi.fn(() => true),
}))
vi.mock('@/lib/server/csrf', () => ({ isSameOriginRequest: vi.fn(() => true) }))
vi.mock('@/lib/catalogue-translations', () => ({
  validateCatalogueTranslations: vi.fn(() => ({})),
}))
vi.mock('@/lib/server/catalogue-translations', () => ({
  catalogueTranslationResponse: vi.fn(async (_kind: string, payload: unknown) => payload),
  saveWithCatalogueTranslations: vi.fn(
    (_kind: string, _t: unknown, _s: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(helpers.fakeDb),
  ),
  deleteWithCatalogueTranslations: vi.fn(
    (_kind: string, _s: string, fn: (tx: unknown) => Promise<unknown>) => fn(helpers.fakeDb),
  ),
}))

import { transitionStaffCarRequest, assignStaffCarVehicle, createCarRequestRecord, updateCustomerCarRequest, validateCarDraft } from '@/lib/server/car-requests'
import {
  createCarLocation,
  createCarRoute,
  createCarRoutePrice,
  deleteCarLocation,
  deleteCarRoute,
  resolveCarRequestQuote,
  resolveCarRouteQuote,
  updateCarRoutePrice,
} from '@/lib/server/car-pricing'
import { parseVehicleCapacity } from '@/lib/car-request'
import { PUT } from '@/app/api/cars/[slug]/route'

// ---- Fixtures ----

let seq = 0

function futureYmd(): string {
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function seedCar(slug: string, seats: string, isPublished = true): void {
  seq += 1
  store.cars.set(slug, {
    id: `c-${seq}`,
    slug,
    title: slug,
    image: '',
    seats,
    transmission: 'Automatic',
    copy: '',
    credit: null,
    isPublished,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

function seedRequest(overrides: Partial<Row> = {}): Row {
  seq += 1
  const row: Row = {
    id: `cr-${seq}`,
    reference: `SP-CR-TEST${String(seq).padStart(3, '0')}`,
    userId: 'user-1',
    vehicleSlug: 'toyota-corolla',
    assignedVehicleSlug: null as string | null,
    tripType: 'ONE_WAY',
    pickup: 'Cairo Airport',
    dropoff: 'Giza',
    pickupDate: new Date(),
    returnDate: null,
    passengers: 3,
    contactName: 'Ali Test',
    contactEmail: 'ali@example.com',
    contactPhone: '+201012345678',
    notes: null,
    status: 'REVIEWING',
    pickupLocationSlug: null,
    dropoffLocationSlug: null,
    routeId: null,
    pickupTime: null,
    returnTime: null,
    quoteCurrency: null,
    quotedCents: null,
    quoteBasis: null,
    quoteRoundTripCents: null,
    quotedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    activities: [
      { actorRole: 'customer', action: 'Request created', note: null, isInternal: false, createdAt: new Date() },
    ],
    user: null,
    ...overrides,
  }
  store.requests.set(row.reference, row)
  return row
}

const draft = () => ({
  vehicleSlug: 'toyota-corolla',
  tripType: 'One Way' as const,
  pickup: 'Cairo Airport',
  dropoff: 'Giza',
  preferredPickupDate: futureYmd(),
  preferredReturnDate: '',
  passengers: 3,
  notes: '',
  contactName: 'Ali Test',
  contactEmail: 'ali@example.com',
  contactPhone: '+201012345678',
})

beforeEach(() => {
  store.cars.clear()
  store.requests.clear()
  store.locations.clear()
  store.routes.clear()
  store.prices.clear()
})

// ---- parseVehicleCapacity ----

describe('parseVehicleCapacity', () => {
  it('accepts unambiguous integer seat counts with optional suffix', () => {
    expect(parseVehicleCapacity('4')).toBe(4)
    expect(parseVehicleCapacity('4 seats')).toBe(4)
    expect(parseVehicleCapacity('14 Seats')).toBe(14)
    expect(parseVehicleCapacity(' 8 seat ')).toBe(8)
  })

  it('rejects ambiguous or out-of-range capacity values', () => {
    expect(parseVehicleCapacity('2-4 seats')).toBeNull()
    expect(parseVehicleCapacity('Up to 8')).toBeNull()
    expect(parseVehicleCapacity('')).toBeNull()
    expect(parseVehicleCapacity('4 seats plus driver')).toBeNull()
    expect(parseVehicleCapacity('4WD')).toBeNull()
    expect(parseVehicleCapacity('0')).toBeNull()
    expect(parseVehicleCapacity('120')).toBeNull()
    expect(parseVehicleCapacity('three seats')).toBeNull()
  })
})

// ---- createCarRequestRecord ----

describe('createCarRequestRecord', () => {
  it('accepts a request whose vehicle resolves to a published fleet vehicle', async () => {
    seedCar('toyota-corolla', '4 seats')
    const created = await createCarRequestRecord(null, draft())
    expect(created.reference).toMatch(/^SP-CR-/)
    expect(created.status).toBe('new')
  })

  it('rejects a fabricated vehicle slug before writing any record', async () => {
    const before = store.requests.size
    await expect(createCarRequestRecord(null, { ...draft(), vehicleSlug: 'ghost-van' }))
      .rejects.toThrow('Select a vehicle from the fleet list.')
    expect(store.requests.size).toBe(before)
  })

  it('rejects a request for a vehicle hidden from the website', async () => {
    seedCar('toyota-corolla', '4 seats', false)
    await expect(createCarRequestRecord(null, draft()))
      .rejects.toThrow('Select a vehicle from the fleet list.')
  })
})

// ---- updateCustomerCarRequest ----

describe('updateCustomerCarRequest', () => {
  it('rejects editing a request onto a vehicle that is not in the fleet', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest()
    await expect(updateCustomerCarRequest('user-1', row.reference, { ...draft(), vehicleSlug: 'ghost-van' }))
      .rejects.toThrow('Select a vehicle from the fleet list.')
  })

  it('keeps editing possible for legacy rows while unassigned and new/reviewing', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest({ status: 'REVIEWING', assignedVehicleSlug: null })
    const saved = await updateCustomerCarRequest('user-1', row.reference, { ...draft(), passengers: 2 })
    expect(saved?.passengers).toBe(2)
  })
})

// ---- assignStaffCarVehicle ----

describe('assignStaffCarVehicle', () => {
  it('rejects unknown vehicle slugs', async () => {
    const row = seedRequest()
    await expect(assignStaffCarVehicle(row.reference, 'ghost-van'))
      .rejects.toThrow('Select a vehicle from the fleet list.')
  })

  it('rejects slugs resolving to vehicles hidden from the website', async () => {
    seq += 1
    store.cars.set('toyota-corolla', {
      id: `c-${seq}`, slug: 'toyota-corolla', title: 'Toyota Corolla', image: '', seats: '4 seats',
      transmission: 'Automatic', copy: '', credit: null, isPublished: false,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const row = seedRequest()
    await expect(assignStaffCarVehicle(row.reference, 'toyota-corolla'))
      .rejects.toThrow('This vehicle is hidden from the website. Publish it before assigning.')
  })

  it('stores the assignment for a published vehicle and records the activity', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest()
    const saved = await assignStaffCarVehicle(row.reference, 'toyota-corolla')
    expect(saved?.assignedVehicleSlug).toBe('toyota-corolla')
  })

  it('still blocks changes on cancelled legacy requests', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest({ status: 'CANCELLED' })
    await expect(assignStaffCarVehicle(row.reference, 'toyota-corolla'))
      .rejects.toThrow('Cancelled requests cannot be changed.')
  })
})

// ---- transitionStaffCarRequest (confirmation gate) ----

describe('confirmation integrity in transitionStaffCarRequest', () => {
  it('rejects confirming while no vehicle is assigned', async () => {
    const row = seedRequest({ assignedVehicleSlug: null })
    await expect(transitionStaffCarRequest(row.reference, 'confirmed', '', false))
      .rejects.toThrow('Assign a fleet vehicle before confirming this request.')
    expect(store.requests.get(row.reference)?.status).toBe('REVIEWING')
  })

  it('rejects confirming with an assignment that no longer resolves to the fleet', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest({ assignedVehicleSlug: 'hyundai-h1-van' })
    seedCar('hyundai-h1-van', '8 seats')
    store.cars.delete('hyundai-h1-van')
    await expect(transitionStaffCarRequest(row.reference, 'confirmed', '', false))
      .rejects.toThrow('Select a vehicle from the fleet list.')
    expect(store.requests.get(row.reference)?.status).toBe('REVIEWING')
  })

  it('rejects confirming with a hidden assigned vehicle', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest({ assignedVehicleSlug: 'toyota-corolla' })
    store.cars.get('toyota-corolla').isPublished = false
    await expect(transitionStaffCarRequest(row.reference, 'confirmed', '', false))
      .rejects.toThrow('Select a vehicle from the fleet list.')
    expect(store.requests.get(row.reference)?.status).toBe('REVIEWING')
  })

  it('rejects confirming when the assigned vehicle capacity is ambiguous', async () => {
    seedCar('toyota-corolla', 'Up to 6 passengers')
    const row = seedRequest({ assignedVehicleSlug: 'toyota-corolla', passengers: 4 })
    await expect(transitionStaffCarRequest(row.reference, 'confirmed', '', false))
      .rejects.toThrow('seat capacity is unclear')
    expect(store.requests.get(row.reference)?.status).toBe('REVIEWING')
  })

  it('rejects confirming when passengers exceed the assigned vehicle capacity', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest({ assignedVehicleSlug: 'toyota-corolla', passengers: 6 })
    await expect(transitionStaffCarRequest(row.reference, 'confirmed', '', false))
      .rejects.toThrow('seats 4 passengers, but this request has 6')
    expect(store.requests.get(row.reference)?.status).toBe('REVIEWING')
  })

  it('confirms when a published assigned vehicle covers the passengers exactly', async () => {
    seedCar('toyota-corolla', '4 seats')
    const row = seedRequest({ assignedVehicleSlug: 'toyota-corolla', passengers: 4 })
    const saved = await transitionStaffCarRequest(row.reference, 'confirmed', '', false)
    expect(saved?.status).toBe('confirmed')
    expect(store.requests.get(row.reference)?.status).toBe('CONFIRMED')
  })

  it('confirms when passengers fit within capacity', async () => {
    seedCar('hyundai-h1-van', '8 seats')
    const row = seedRequest({ assignedVehicleSlug: 'hyundai-h1-van', passengers: 5 })
    const saved = await transitionStaffCarRequest(row.reference, 'confirmed', 'Call to arrange meeting point.', false)
    expect(saved?.status).toBe('confirmed')
  })

  it('does not require assignment for non-confirmed transitions (legacy preserved)', async () => {
    const row = seedRequest({ assignedVehicleSlug: null })
    const saved = await transitionStaffCarRequest(row.reference, 'cancelled', '', false)
    expect(saved?.status).toBe('cancelled')
    expect(store.requests.get(row.reference)?.status).toBe('CANCELLED')
  })
})

// ---- PUT /api/cars/[slug] legacy daily-rate field handling ----

function putRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/cars/toyota-corolla', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const routeContext = () => ({ params: Promise.resolve({ slug: 'toyota-corolla' }) })

describe('PUT /api/cars/[slug] has no daily-rate surface at all', () => {
  beforeEach(() => {
    seq += 1
    store.cars.set('toyota-corolla', {
      id: `c-${seq}`, slug: 'toyota-corolla', title: 'Toyota Corolla', image: '', seats: '4 seats',
      transmission: 'Automatic', copy: '', credit: null, isPublished: true,
      createdAt: new Date(), updatedAt: new Date(),
    })
  })

  it('ignores a client-supplied legacy dailyPrice key without any 400', async () => {
    const res = await PUT(putRequest({ dailyPrice: 99 }), routeContext())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.car.dailyPrice).toBeUndefined()
    expect(Object.hasOwn(store.cars.get('toyota-corolla'), 'dailyPrice')).toBe(false)
  })

  it('an invalid daily value is equally ignored: no 400, update proceeds', async () => {
    const res = await PUT(putRequest({ dailyPrice: 'abc' }), routeContext())
    expect(res.status).toBe(200)
    expect(store.cars.get('toyota-corolla').isPublished).toBe(true)
  })

  it('visibility-only saves succeed with no daily-rate semantics involved', async () => {
    const res = await PUT(putRequest({ isPublished: false }), routeContext())
    expect(res.status).toBe(200)
    expect(store.cars.get('toyota-corolla').isPublished).toBe(false)
  })
})

// ---- Legacy daily-rate UI removal guards (source scan) ----

describe('legacy daily-rate UI is removed from vehicle management surfaces', () => {
  it('the vehicle create/edit form no longer renders or validates a daily rate', () => {
    const form = readFileSync(path.resolve(__dirname, '../components/admin/vehicle-form.tsx'), 'utf8')
    expect(form).not.toContain('Daily rate')
    expect(form).not.toContain('السعر اليومي')
    expect(form).not.toContain('setDailyPrice')
    expect(form).not.toContain('dailyPrice: rate')
  })

  it('POST /api/cars creates vehicles with no daily-rate field in any payload', () => {
    const post = readFileSync(path.resolve(__dirname, '../app/api/cars/route.ts'), 'utf8')
    expect(post).not.toContain('dailyPrice')
    expect(post).not.toContain('Enter a valid daily rate.')
  })

  it('PUT /api/cars/[slug] never touches a daily rate: none exists to preserve', () => {
    const put = readFileSync(path.resolve(__dirname, '../app/api/cars/[slug]/route.ts'), 'utf8')
    expect(put).not.toContain('Enter a valid daily rate.')
    expect(put).not.toMatch(/data:\s*\{[\s\S]*dailyPrice:/)
    expect(put).not.toContain('dailyPrice')
  })

  it('the admin fleet list and detail no longer show daily-rate columns or stats', () => {
    const list = readFileSync(path.resolve(__dirname, '../app/admin/cars/page.tsx'), 'utf8')
    expect(list).not.toContain('Average daily rate')
    expect(list).not.toContain('Daily rate')
    expect(list).not.toContain('formatUsd')
    expect(list).not.toContain('dailyPrice')
    const detail = readFileSync(path.resolve(__dirname, '../app/admin/cars/[slug]/content.tsx'), 'utf8')
    expect(detail).not.toContain('Daily rate')
    expect(detail).not.toContain('car.dailyPrice')
  })

  it('the vehicle form, shared mapping, client mapping, types and import script have no dailyPrice reference', () => {
    for (const file of [
      'components/admin/vehicle-form.tsx',
      'lib/server/cars.ts',
      'lib/events-cars-client.ts',
      'data/types.ts',
      'data/content.ts',
      'prisma/import-cars.ts',
    ]) {
      const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8')
      expect(source, file).not.toContain('dailyPrice')
    }
  })
})

// ---- UI regression guard: admin inbox never reloads the page on retry ----

describe('admin car-requests inbox retry mechanism', () => {
  it('retries in place with the unified toast instead of window.location.reload', () => {
    const page = readFileSync(path.resolve(__dirname, '../app/admin/car-requests/page.tsx'), 'utf8')
    expect(page).not.toContain('window.location.reload')
    expect(page).toContain("from '@/components/admin/admin-toaster'")
    expect(page).toContain('toast.success')
    expect(page).toContain('refreshTick')
  })
})

// ---- Stage 8: structured transfer + quote snapshot integrity ----
//
// Everything below runs against the same in-memory fakes: route IDs and
// prices are always resolved server-side, and client-supplied money is
// impossible by construction (no client money field exists in the draft).

function seedLocation(slug: string, nameEn: string, isActive = true): void {
  store.locations.set(slug, {
    id: `loc-cost-${slug}`,
    slug,
    nameEn,
    nameEs: null,
    nameIt: null,
    nameAr: null,
    kind: 'AIRPORT',
    isActive,
    sortOrder: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

function seedRoute(routeId: string, originSlug: string, destinationSlug: string, isActive = true): void {
  store.routes.set(routeId, {
    id: routeId,
    originSlug,
    destinationSlug,
    isActive,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

function seedPrice(routeId: string, carSlug: string, overrides: Partial<Row> = {}): void {
  const row: Row = {
    id: `pr-cost-${routeId}-${carSlug}`,
    routeId,
    carSlug,
    currency: 'USD',
    oneWayCents: 2500,
    roundTripMode: 'AUTOMATIC',
    roundTripCents: null,
    roundTripMultiplierBp: 200,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
  store.prices.set(row.id, row)
}

const structuredDraft = () => ({
  ...draft(),
  pickupLocationSlug: 'cairo-airport',
  dropoffLocationSlug: 'giza-hotels',
  pickupTime: '09:15',
  returnTime: '',
})

describe('carRequest transfer snapshot (Stage 8)', () => {
  it('snapshots the directional route, canonical names, and exact server-resolved quote', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    seedPrice('route-aaaa-bbbb', 'toyota-corolla')

    const created = await createCarRequestRecord(null, structuredDraft())
    const row = store.requests.get(created.reference)
    expect(row.pickupLocationSlug).toBe('cairo-airport')
    expect(row.dropoffLocationSlug).toBe('giza-hotels')
    expect(row.routeId).toBe('route-aaaa-bbbb')
    // Free-text copies are overwritten by canonical location names.
    expect(row.pickup).toBe('Cairo International Airport')
    expect(row.dropoff).toBe('Giza Hotels')
    expect(row.pickupTime).toBe('09:15')
    expect(row.quoteCurrency).toBe('USD')
    expect(row.quotedCents).toBe(2500)
    expect(row.quoteBasis).toBe('multiplier')
    expect(row.quoteRoundTripCents).toBeNull()
    expect(created.quote).toEqual({
      currency: 'USD',
      cents: 2500,
      basis: 'multiplier',
      quotedAt: row.quotedAt.toISOString(),
    })
  })

  it('round-trip requests snapshot the full round-trip amount, not the one-way leg', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    seedPrice('route-aaaa-bbbb', 'toyota-corolla')

    const created = await createCarRequestRecord(null, {
      ...structuredDraft(),
      tripType: 'Round Trip',
      preferredReturnDate: structuredDraft().preferredPickupDate,
      returnTime: '18:00',
    })
    const row = store.requests.get(created.reference)
    expect(row.quotedCents).toBe(5000)
    expect(row.quoteRoundTripCents).toBe(5000)
    expect(row.returnTime).toBe('18:00')
  })

  it('keeps the monetary columns NULL when the route exists but no active price covers the vehicle', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')

    const created = await createCarRequestRecord(null, structuredDraft())
    const row = store.requests.get(created.reference)
    expect(row.routeId).toBe('route-aaaa-bbbb')
    expect(row.quotedCents).toBeNull()
    expect(row.quoteCurrency).toBeNull()
    expect(row.quoteBasis).toBeNull()
    expect(row.quoteRoundTripCents).toBeNull()
    expect(created.quote).toBeNull()
  })

  it('does not link the route id when the directional route is inactive', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels', false)
    seedPrice('route-aaaa-bbbb', 'toyota-corolla')

    const created = await createCarRequestRecord(null, structuredDraft())
    const row = store.requests.get(created.reference)
    expect(row.routeId).toBeNull()
    expect(row.quotedCents).toBeNull()
    expect(row.quoteBasis).toBeNull()
    // Locations remain canonical even without a priced route.
    expect(row.pickup).toBe('Cairo International Airport')
  })

  it('rejects structured slugs that do not resolve to active locations', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport', false)
    seedLocation('giza-hotels', 'Giza Hotels')
    const before = store.requests.size
    await expect(createCarRequestRecord(null, structuredDraft()))
      .rejects.toThrow('Select the pick-up and drop-off locations from the list.')
    expect(store.requests.size).toBe(before)
  })

  it('never trusts client money: no snapshot field reaches the record from the draft', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    seedPrice('route-aaaa-bbbb', 'toyota-corolla')

    // A hostile payload carrying fabricated money columns is rejected
    // outright: the draft allowlist has no money/route-id keys at all.
    expect(() => validateCarDraft({
      vehicleSlug: 'toyota-corolla',
      tripType: 'One Way',
      pickup: 'Cairo Airport',
      dropoff: 'Giza',
      preferredPickupDate: futureYmd(),
      preferredReturnDate: '',
      passengers: 3,
      notes: '',
      pickupLocationSlug: 'cairo-airport',
      dropoffLocationSlug: 'giza-hotels',
      pickupTime: '09:15',
      contact: { fullName: 'Ali Test', email: 'ali@example.com', phone: '+201012345678' },
      quotedCents: 1,
      quoteCurrency: 'USD',
      quoteBasis: 'manual',
      routeId: 'route-fake',
    })).toThrow('Invalid request.')

    // A clean draft still snapshots the server-resolved price only.
    const created = await createCarRequestRecord(null, structuredDraft())
    const row = store.requests.get(created.reference)
    expect(row.routeId).toBe('route-aaaa-bbbb')
    expect(row.quotedCents).toBe(2500)
  })
})

describe('carRequest structured draft validation (Stage 8)', () => {
  const publicDraft = (overrides: Record<string, unknown> = {}) => ({
    vehicleSlug: 'toyota-corolla',
    tripType: 'One Way',
    pickup: 'Cairo Airport',
    dropoff: 'Giza',
    preferredPickupDate: futureYmd(),
    preferredReturnDate: '',
    passengers: 3,
    notes: '',
    pickupLocationSlug: 'cairo-airport',
    dropoffLocationSlug: 'giza-hotels',
    pickupTime: '09:15',
    contact: { fullName: 'Ali Test', email: 'ali@example.com', phone: '+201012345678' },
    ...overrides,
  })

  it('rejects one-sided location slugs', () => {
    expect(() => validateCarDraft(publicDraft({ dropoffLocationSlug: '' })))
      .toThrow('Select both the pick-up and drop-off locations from the list.')
    expect(() => validateCarDraft(publicDraft({ pickupLocationSlug: '' })))
      .toThrow('Select both the pick-up and drop-off locations from the list.')
  })

  it('rejects malformed pickup/return times', () => {
    expect(() => validateCarDraft(publicDraft({ pickupTime: '25:00' }))).toThrow('Invalid request.')
    expect(() => validateCarDraft(publicDraft({ pickupTime: '9:5' }))).toThrow('Invalid request.')
    expect(() => validateCarDraft(publicDraft({ returnTime: '08:60' }))).toThrow('Invalid request.')
    expect(() => validateCarDraft(publicDraft({ returnTime: 'not-a-time' }))).toThrow('Invalid request.')
  })

  it('rejects a return time on a one-way request', () => {
    expect(() => validateCarDraft(publicDraft({ returnTime: '14:00' }))).toThrow('Invalid request.')
  })

  it('accepts well-formed structured drafts unchanged', () => {
    const validated = validateCarDraft(publicDraft())
    expect(validated.pickupLocationSlug).toBe('cairo-airport')
    expect(validated.dropoffLocationSlug).toBe('giza-hotels')
    expect(validated.pickupTime).toBe('09:15')
    expect(validated.returnTime).toBe('')
  })
})

describe('updateCustomerCarRequest re-snapshot (Stage 8)', () => {
  function seedStructuredRequest(routeId: string | null, quotedCents: number | null): Row {
    const row = seedRequest({
      tripType: 'ONE_WAY',
      pickupLocationSlug: 'cairo-airport',
      dropoffLocationSlug: 'giza-hotels',
      routeId,
      pickupTime: '09:15',
      returnTime: null,
      quoteCurrency: quotedCents === null ? null : 'USD',
      quotedCents,
      quoteBasis: quotedCents === null ? null : 'multiplier',
      quoteRoundTripCents: null,
      quotedAt: quotedCents === null ? null : new Date(),
      pickup: 'Cairo International Airport',
      dropoff: 'Giza Hotels',
    })
    return row
  }

  it('stays a no-op when the persisted transfer already matches the draft', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    const row = seedStructuredRequest(null, null)
    row.pickup = 'Cairo Airport'
    row.dropoff = 'Giza'
    row.pickupDate = new Date(`${futureYmd()}T12:00:00.000Z`)
    const saved = await updateCustomerCarRequest('user-1', row.reference, structuredDraft())
    // No 'Request updated' timeline entry: stored slugs/times equal the draft.
    expect(saved?.pickupTime).toBe('09:15')
    expect(store.requests.get(row.reference).activities.filter((a) => a.action === 'Request updated')).toHaveLength(0)
  })

  it('recomputes the quote at edit time so a price change never leaves stale money', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    seedPrice('route-aaaa-bbbb', 'toyota-corolla', { oneWayCents: 2500 })

    let row = seedStructuredRequest('route-aaaa-bbbb', 2500)
    // Staff reprices between submission and the customer's editâ€¦
    store.prices.set('pr-cost-route-aaaa-bbbb-toyota-corolla', {
      ...store.prices.get('pr-cost-route-aaaa-bbbb-toyota-corolla'),
      oneWayCents: 3000,
    })
    row = store.requests.get(row.reference)

    await updateCustomerCarRequest('user-1', row.reference, {
      ...structuredDraft(),
      passengers: 4,
    })
    const saved = store.requests.get(row.reference)
    expect(saved.passengers).toBe(4)
    expect(saved.quotedCents).toBe(3000)
    expect(saved.quoteBasis).toBe('multiplier')
  })

  it('drops the route link and money when the route disappears before the edit', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    const row = seedStructuredRequest('route-gone', 2500)
    // The route was deleted staff-side (route FK is nullable/SET NULL).
    await updateCustomerCarRequest('user-1', row.reference, {
      ...structuredDraft(),
      passengers: 2,
    })
    const saved = store.requests.get(row.reference)
    expect(saved.routeId).toBeNull()
    expect(saved.quotedCents).toBeNull()
    expect(saved.quoteBasis).toBeNull()
    expect(saved.pickup).toBe('Cairo International Airport')
  })
})

describe('rent-car catalog CRUD integrity (Stage 8)', () => {
  it('rejects duplicate directional routes while allowing the reverse direction', async () => {
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    await createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' })
    await expect(createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' }))
      .rejects.toThrow('This route already exists.')
    const reverse = await createCarRoute({ originSlug: 'giza-hotels', destinationSlug: 'cairo-airport' })
    expect(reverse.id).toBeTruthy()
  })

  it('refuses routes through inactive or missing locations', async () => {
    seedLocation('cairo-airport', 'Cairo International Airport', false)
    seedLocation('giza-hotels', 'Giza Hotels')
    await expect(createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' }))
      .rejects.toThrow('Both locations must exist and be active.')
    await expect(createCarRoute({ originSlug: 'ghost', destinationSlug: 'giza-hotels' }))
      .rejects.toThrow('Both locations must exist and be active.')
  })

  it('blocks deleting a location that routes reference, and its routes otherwise clean up', async () => {
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    const route = await createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' })
    await expect(deleteCarLocation('cairo-airport'))
      .rejects.toThrow('This location is referenced by routes. Remove those routes first.')
    await deleteCarRoute(route.id)
    await expect(deleteCarLocation('cairo-airport')).resolves.toBe(true)
  })

  it('blocks deleting a route while prices remain attached to it', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    const route = await createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' })
    await createCarRoutePrice({ routeId: route.id, carSlug: 'toyota-corolla', currency: 'USD', oneWay: '25.00', roundTripMode: 'AUTOMATIC', isActive: true })
    await expect(deleteCarRoute(route.id))
      .rejects.toThrow('This route has vehicle prices. Deactivate it instead of deleting.')
    // Unknown route ids surface the database's not-found error instead of
    // silently reporting success.
    await expect(deleteCarRoute('route-unknown-000000')).rejects.toThrow()
  })

  it('enforces one price per route Ã— vehicle with friendly conflicts', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    const route = await createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' })
    await createCarRoutePrice({ routeId: route.id, carSlug: 'toyota-corolla', currency: 'USD', oneWay: '25.00', roundTripMode: 'AUTOMATIC', isActive: true })
    await expect(createCarRoutePrice({ routeId: route.id, carSlug: 'toyota-corolla', currency: 'USD', oneWay: '30.00', roundTripMode: 'AUTOMATIC', isActive: true }))
      .rejects.toThrow('A price for this vehicle and route already exists.')
    await expect(createCarRoutePrice({ routeId: route.id, carSlug: 'ghost-van', currency: 'USD', oneWay: '30.00', roundTripMode: 'AUTOMATIC', isActive: true }))
      .rejects.toThrow('Choose the fleet vehicle for this price.')
  })

  it('never keeps stale figures when the round-trip pricing mode is switched', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    const route = await createCarRoute({ originSlug: 'cairo-airport', destinationSlug: 'giza-hotels' })
    const price = await createCarRoutePrice({
      routeId: route.id, carSlug: 'toyota-corolla', currency: 'USD',
      oneWay: '25.00', roundTrip: '50.00', roundTripMode: 'MANUAL', isActive: true,
    })
    const stored = store.prices.get(price.id)
    expect(stored.roundTripMode).toBe('MANUAL')
    expect(stored.roundTripCents).toBe(5000)

    // MANUAL â†’ AUTOMATIC: the manual figure must not leak into the new mode.
    const patch = await updateCarRoutePrice(price.id, { roundTripMode: 'AUTOMATIC' })
    expect(patch.roundTripCents).toBeNull()
    const switched = store.prices.get(price.id)
    expect(switched.roundTripMode).toBe('AUTOMATIC')
    expect(switched.roundTripCents).toBeNull()
    expect(switched.roundTripMultiplierBp).toBe(200)

    // AUTOMATIC â†’ MANUAL without a manual figure is rejected, not defaulted.
    await expect(updateCarRoutePrice(price.id, { roundTripMode: 'MANUAL' }))
      .rejects.toThrow('Enter a valid round-trip price greater than zero.')
  })
})

describe('public quote endpoints resolve routes from location slugs (Stage 8)', () => {
  function quotePayload(overrides: Record<string, unknown> = {}) {
    return {
      vehicle: 'toyota-corolla',
      trip: 'one-way',
      passengers: 3,
      from: 'cairo-airport',
      to: 'giza-hotels',
      ...overrides,
    }
  }

  it('resolves the directional route from from/to slugs and returns the exact quote shape', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    seedPrice('route-aaaa-bbbb', 'toyota-corolla')

    const result = await resolveCarRouteQuote(quotePayload())
    expect(result.kind).toBe('quote')
    if (result.kind === 'quote') {
      expect(result.detail.routeId).toBe('route-aaaa-bbbb')
      expect(result.detail.amount).toBe('25.00')
      expect(result.detail.oneWayCents).toBe(2500)
      expect(result.detail.roundTripBasis).toBe('multiplier')
    }
  })

  it('throws a friendly error when no directional route exists for the slug pair', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    await expect(resolveCarRouteQuote(quotePayload()))
      .rejects.toThrow('Choose a route to price.')
  })

  it('returns price_on_request when the matched route is unpriced for the vehicle', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    const result = await resolveCarRouteQuote(quotePayload())
    expect(result).toEqual({ kind: 'price_on_request', reason: 'price_unavailable', detail: null })
  })

  it('rejects malformed from/to pairs instead of guessing a route', async () => {
    seedCar('toyota-corolla', '4 seats')
    await expect(resolveCarRouteQuote(quotePayload({ from: '', to: 'giza-hotels' })))
      .rejects.toThrow('Choose a route to price.')
  })

  it('resolveCarRequestQuote prices without capacity gates (inquiry-first submits stay valid)', async () => {
    seedCar('toyota-corolla', '4 seats')
    seedLocation('cairo-airport', 'Cairo International Airport')
    seedLocation('giza-hotels', 'Giza Hotels')
    seedRoute('route-aaaa-bbbb', 'cairo-airport', 'giza-hotels')
    seedPrice('route-aaaa-bbbb', 'toyota-corolla')

    // 2 passengers over 4 seats is nonsense, but the snapshot path must not
    // throw on capacity: the UI warns; submission still snapshots a quote.
    const result = await resolveCarRequestQuote({
      vehicle: 'toyota-corolla',
      route: 'route-aaaa-bbbb',
      trip: 'one-way',
      passengers: 2,
    })
    if (result.kind !== 'quote') throw new Error('expected a quote')
    expect(result.cents).toBe(2500)
    expect(result.basis).toBe('multiplier')
  })

  it('rejects unknown payload keys on both quote resolvers (tamper guard)', async () => {
    await expect(resolveCarRouteQuote({ ...quotePayload(), amount: '0.00' }))
      .rejects.toThrow('Invalid request.')
    await expect(resolveCarRequestQuote({ vehicle: 'toyota-corolla', route: 'x', trip: 'one-way', passengers: 1, oneWay: '999.00' }))
      .rejects.toThrow('Invalid request.')
  })
})
