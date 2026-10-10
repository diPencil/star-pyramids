import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
function key() {
  const value = process.env.REVIEW_INTEGRATIONS_KEY || ''
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw Error('Review credential encryption is not configured on the server.')
  return Buffer.from(value, 'hex')
}
export function sealReviewSecret(secret: string, provider: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(provider))
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
}
export function openReviewSecret(value: string, provider: string): string {
  const [iv, tag, payload] = value.split('.')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  decipher.setAAD(Buffer.from(provider)); decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8')
}
