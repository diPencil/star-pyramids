'use client'

import { useSyncExternalStore } from 'react'

export type CustomerChatAttachment = {
  name: string
  type: string
  size: number
  url: string
}

export type CustomerChatMessage = {
  id: string
  sender: 'customer' | 'agent'
  text: string
  createdAt: string
  readByCustomer: boolean
  readByAdmin: boolean
  attachment?: CustomerChatAttachment
}

const CHAT_KEY = 'sp-customer-support-chat-v1'
const EMPTY_MESSAGES: CustomerChatMessage[] = []
const listeners = new Set<() => void>()
let cache: CustomerChatMessage[] | null = null

function readMessages(): CustomerChatMessage[] {
  if (typeof window === 'undefined') return EMPTY_MESSAGES
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CHAT_KEY) || '[]')
    if (!Array.isArray(parsed)) return EMPTY_MESSAGES
    return parsed.filter((item): item is CustomerChatMessage => Boolean(item)
      && typeof item === 'object'
      && typeof (item as CustomerChatMessage).id === 'string'
      && ((item as CustomerChatMessage).sender === 'customer' || (item as CustomerChatMessage).sender === 'agent'))
  } catch {
    return EMPTY_MESSAGES
  }
}

function snapshot() {
  if (cache === null) cache = readMessages()
  return cache
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const syncExternal = () => {
    cache = null
    listener()
  }
  window.addEventListener('storage', syncExternal)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', syncExternal)
  }
}

function commit(messages: CustomerChatMessage[]) {
  cache = messages.slice(-200)
  try {
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(cache))
  } catch {
    // The backend will replace browser storage in production.
  }
  listeners.forEach((listener) => listener())
  window.dispatchEvent(new Event('sp-customer-chat'))
}

function append(sender: CustomerChatMessage['sender'], text: string, attachment?: CustomerChatAttachment) {
  const cleanText = text.trim()
  if (!cleanText && !attachment) return
  const message: CustomerChatMessage = {
    id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender,
    text: cleanText,
    createdAt: new Date().toISOString(),
    readByCustomer: sender === 'customer',
    readByAdmin: sender === 'agent',
    attachment,
  }
  commit([...snapshot(), message])
}

export function sendCustomerChatMessage(text: string, attachment?: CustomerChatAttachment) {
  append('customer', text, attachment)
}

export function sendAgentChatMessage(text: string, attachment?: CustomerChatAttachment) {
  append('agent', text, attachment)
}

export function markCustomerChatRead(viewer: 'customer' | 'admin') {
  const key = viewer === 'customer' ? 'readByCustomer' : 'readByAdmin'
  let changed = false
  const next = snapshot().map((message) => {
    const shouldRead = viewer === 'customer' ? message.sender === 'agent' : message.sender === 'customer'
    if (!shouldRead || message[key]) return message
    changed = true
    return { ...message, [key]: true }
  })
  if (changed) commit(next)
}

export function useCustomerChatMessages() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_MESSAGES)
}
