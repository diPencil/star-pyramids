export type LiveMessage = { id: string; senderRole: 'customer' | 'staff' | 'bot'; body: string; createdAt: string }
export type LiveThread = {
  reference: string
  status: 'OPEN' | 'CLOSED'
  agentRequested: boolean
  needsStaffReply: boolean
  messages: LiveMessage[]
} | null
export type LiveAction = {
  requestId: string
  action: 'message' | 'handoff'
  body: string
  locale: 'en' | 'es' | 'it'
  name?: string
  phone?: string
}

export class LiveChatError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function parseLiveAction(value: unknown): LiveAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LiveChatError(400, 'Invalid request.')
  const v = value as Record<string, unknown>
  if (Object.keys(v).some(k => !['requestId', 'action', 'body', 'locale', 'name', 'phone'].includes(k))) throw new LiveChatError(400, 'Invalid request.')
  if (typeof v.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.requestId)) throw new LiveChatError(400, 'Invalid request.')
  if (v.action !== 'message' && v.action !== 'handoff') throw new LiveChatError(400, 'Invalid request.')
  if (!['en', 'es', 'it'].includes(v.locale as string)) throw new LiveChatError(400, 'Invalid language.')
  const text = (raw: unknown, max: number, required = true) => {
    if (typeof raw !== 'string' || raw.length > max || /[\u0000-\u001f\u007f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/.test(raw)) throw new LiveChatError(400, 'Invalid text.')
    if (required && !raw.trim()) throw new LiveChatError(400, 'Required field missing.')
    return raw.trim()
  }
  const result: LiveAction = { requestId: v.requestId, action: v.action, body: text(v.body, 500, v.action === 'message'), locale: v.locale as LiveAction['locale'] }
  if (v.action === 'handoff') {
    result.name = text(v.name, 120)
    result.phone = text(v.phone, 32)
    if (!/^\+?[0-9 ()\-.]{7,32}$/.test(result.phone) || result.phone.replace(/\D/g, '').length < 7 || result.phone.replace(/\D/g, '').length > 15) throw new LiveChatError(400, 'Invalid phone number.')
  } else if (v.name !== undefined || v.phone !== undefined) throw new LiveChatError(400, 'Invalid request.')
  return result
}
