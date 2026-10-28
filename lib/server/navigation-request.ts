import { NavigationValidationError, type NavigationAction } from '../navigation'
export async function readNavigationBody(request: Request): Promise<{ revision: number; action: NavigationAction; content?: unknown }> {
  const reader = request.body?.getReader(); if (!reader) throw new NavigationValidationError('Missing request.')
  const chunks: Uint8Array[] = []; let size = 0
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 100000) { await reader.cancel(); throw new NavigationValidationError('Navigation request exceeds 100 KB.') }; chunks.push(value) } } finally { reader.releaseLock() }
  let body
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new NavigationValidationError('Invalid navigation JSON.') }
  if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !['save-draft', 'publish', 'restore', 'reset-draft'].includes(body.action)) throw new NavigationValidationError('Invalid revision or action.')
  return body
}
