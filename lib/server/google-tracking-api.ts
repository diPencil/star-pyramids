import 'server-only'
import { createPrivateKey, sign } from 'node:crypto'

export class GoogleTrackingApiError extends Error {
  constructor(public code: 'google_permission_denied' | 'google_auth_failed' | 'google_timeout' | 'google_api_error' | 'google_credentials_invalid', public status = 0) { super(code) }
}
export type GoogleTrackingApi = (url: string, body?: object) => Promise<Record<string, unknown>>

/** Fixed Google endpoints, read-only scopes, no credentials/errors in responses or logs. */
export function googleTrackingApi(rawCredential: string, request: typeof fetch = fetch): GoogleTrackingApi {
  const deadline = Date.now() + 24000
  let token: Promise<string> | undefined
  async function json(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    try {
      const remaining = Math.min(5000, deadline - Date.now())
      if (remaining <= 0) throw new GoogleTrackingApiError('google_timeout')
      const response = await request(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(remaining) })
      if (!response.ok) throw new GoogleTrackingApiError(response.status === 403 ? 'google_permission_denied' : response.status === 401 ? 'google_auth_failed' : 'google_api_error', response.status)
      const reader = response.body?.getReader()
      if (!reader) throw new GoogleTrackingApiError('google_api_error')
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 2_000_000) { await reader.cancel(); throw new GoogleTrackingApiError('google_api_error') }
        chunks.push(value)
      }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GoogleTrackingApiError('google_api_error')
      return value as Record<string, unknown>
    } catch (error) {
      if (error instanceof GoogleTrackingApiError) throw error
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new GoogleTrackingApiError('google_timeout')
      throw new GoogleTrackingApiError('google_api_error')
    }
  }
  async function authorize() {
    let assertion: string
    try {
      const credential = JSON.parse(rawCredential)
      if (credential.type !== 'service_account' || typeof credential.client_email !== 'string' || !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(credential.client_email) || typeof credential.private_key !== 'string') throw Error()
      const key = createPrivateKey(credential.private_key)
      if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw Error()
      const now = Math.floor(Date.now() / 1000)
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({
        iss: credential.client_email, scope: 'https://www.googleapis.com/auth/tagmanager.readonly https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
      })
      assertion = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')
    } catch { throw new GoogleTrackingApiError('google_credentials_invalid') }
    let result: Record<string, unknown>
    try {
      result = await json('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
      })
    } catch (error) {
      if (error instanceof GoogleTrackingApiError && [400, 401].includes(error.status)) throw new GoogleTrackingApiError('google_auth_failed', error.status)
      throw error
    }
    if (typeof result.access_token !== 'string' || !result.access_token || result.access_token.length > 8192) throw new GoogleTrackingApiError('google_auth_failed')
    return result.access_token
  }
  return async (url, body) => {
    // These APIs are used only for lookup, published-version reads and aggregate reports.
    if (!/^https:\/\/(?:tagmanager\.googleapis\.com\/tagmanager\/v2\/accounts\/(?:containers:lookup\?tagId=GTM-[A-Z0-9]+|[0-9]+\/containers\/[0-9]+\/versions:live)|analyticsadmin\.googleapis\.com\/v1beta\/properties\/[0-9]+\/dataStreams\?pageSize=200(?:&pageToken=[A-Za-z0-9_%.-]+)?|analyticsdata\.googleapis\.com\/v1beta\/properties\/[0-9]+:run(?:Realtime)?Report)$/.test(url)) throw new GoogleTrackingApiError('google_api_error')
    token ??= authorize()
    return json(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  }
}
