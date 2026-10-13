import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  checkRateLimit: vi.fn(),
  recordAttempt: vi.fn(),
  notifyStaff: vi.fn(),
  sendCustomerEmail: vi.fn(),
  sendStaffEmail: vi.fn(),
}))

vi.mock('@/lib/server/db', () => ({
  db: { websiteEnquiry: { findUnique: mocks.findUnique, create: mocks.create } },
}))
vi.mock('@/lib/server/rate-limit', () => ({
  checkEnquiryRateLimit: mocks.checkRateLimit,
  recordEnquiryAttempt: mocks.recordAttempt,
}))
vi.mock('@/lib/server/notifications', () => ({ notifyStaff: mocks.notifyStaff }))
vi.mock('@/lib/server/email', () => ({
  sendCustomerEmailSafe: mocks.sendCustomerEmail,
  sendStaffEmailSafe: mocks.sendStaffEmail,
}))

import { POST } from '@/app/api/enquiries/route'

const requestId = '123e4567-e89b-42d3-a456-426614174000'
const valid = {
  name: '  Nour Traveler  ',
  email: '  NOUR@example.com ',
  phone: '+20 100 000 0000',
  subject: 'Homepage trip help request',
  message: 'Please contact me to help plan an Egypt trip.',
  sourcePage: '/',
  requestId,
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new Request('http://localhost:3000/api/enquiries', {
    method: 'POST',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue(null)
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 })
  mocks.recordAttempt.mockResolvedValue(undefined)
  mocks.create.mockResolvedValue({ publicId: requestId, createdAt: new Date('2026-01-01T00:00:00.000Z') })
  mocks.notifyStaff.mockResolvedValue(undefined)
  mocks.sendCustomerEmail.mockResolvedValue(undefined)
  mocks.sendStaffEmail.mockResolvedValue(undefined)
})

describe('POST /api/enquiries', () => {
  it('rejects missing and cross-origin submissions before persistence', async () => {
    const missingOrigin = await post(valid, { origin: '' })
    const crossOrigin = await post(valid, { origin: 'https://evil.example' })

    expect(missingOrigin.status).toBe(403)
    expect(crossOrigin.status).toBe(403)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
  })

  it('accepts a same-origin homepage enquiry and normalizes stored identity fields', async () => {
    const response = await post(valid)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ enquiry: { publicId: requestId, createdAt: '2026-01-01T00:00:00.000Z' } })
    expect(mocks.recordAttempt).toHaveBeenCalledWith('nour@example.com', 'unknown')
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Nour Traveler', email: 'nour@example.com', phone: '+20 100 000 0000', sourcePage: '/' }),
    }))
  })

  it('enforces the existing enquiry rate limit without writing an enquiry', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 120 })

    const response = await post(valid)

    expect(response.status).toBe(429)
    expect(mocks.recordAttempt).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('returns an idempotent replay without creating a duplicate', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      publicId: requestId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      name: 'Nour Traveler',
      email: 'nour@example.com',
      phone: '+20 100 000 0000',
      subject: valid.subject,
      message: valid.message,
      sourcePage: '/',
    })

    const response = await post(valid)

    expect(response.status).toBe(200)
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
