import 'server-only'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import type { SocialProviderId } from '@/lib/auth/social-providers'
import { SOCIAL_MEASUREMENT_COOKIE, SOCIAL_MEASUREMENT_TTL, parseSocialMeasurement, type SocialMeasurement } from '@/lib/tracking/auth/social-measurement'
import { isTrackingGrant } from '@/lib/tracking/tracking'
import { openSocialValue, sealSocialValue } from './social-seal'

type Receipt = { measurement: SocialMeasurement; grant: string; expires: number }
const purpose = 'social-measurement-v1'
const options = { secure: true, httpOnly: true, sameSite: 'lax', path: '/' } as const

function readReceipts(value: string | undefined): Receipt[] {
  try {
    const text = openSocialValue(value, purpose)
    if (!text) return []
    const records = JSON.parse(text) as Receipt[]
    if (!Array.isArray(records) || records.length > 4) return []
    return records.filter(record => record && parseSocialMeasurement(record.measurement) && isTrackingGrant(record.grant) && record.expires > Date.now())
  } catch { return [] }
}

export async function saveSocialMeasurement(event: SocialMeasurement['event'], method: SocialProviderId, grant: string | undefined) {
  if (!isTrackingGrant(grant) || process.env.NODE_ENV !== 'production') return
  try {
    const jar = await cookies()
    const records = readReceipts(jar.get(SOCIAL_MEASUREMENT_COOKIE)?.value).filter(record => record.grant === grant)
    const measurement = { event, method, event_id: 'so_' + randomBytes(16).toString('hex') }
    records.push({ measurement, grant, expires: Date.now() + SOCIAL_MEASUREMENT_TTL })
    jar.set(SOCIAL_MEASUREMENT_COOKIE, sealSocialValue(JSON.stringify(records.slice(-4)), purpose), { ...options, maxAge: SOCIAL_MEASUREMENT_TTL / 1000 })
  } catch { /* Optional analytics cannot affect registration or sign-in. */ }
}

export async function consumeSocialMeasurement(grant: string): Promise<SocialMeasurement[]> {
  const jar = await cookies()
  const value = jar.get(SOCIAL_MEASUREMENT_COOKIE)?.value
  if (!value) return []
  const receipts = readReceipts(value)
  jar.set(SOCIAL_MEASUREMENT_COOKIE, '', { ...options, maxAge: 0 })
  return receipts.flatMap(record => {
    const event = record.grant === grant ? parseSocialMeasurement(record.measurement) : null
    return event ? [event] : []
  })
}
