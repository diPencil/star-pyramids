// Provider registry and factory
// Phase 2F-B: Provider-neutral payment gateway foundation
// Manages provider registration, lookup, and instantiation

import type { SupportedProviderKey, ProviderConfig } from '@/lib/payments/providers'
import type { ExtendedPaymentProviderAdapter } from '@/lib/payments/adapter'
import { SUPPORTED_PROVIDER_KEYS, isSupportedProvider, getProviderConfig, getEnabledProviders, getDefaultProvider, hasEnabledProvider, validateProviderConfig, isSupportedProvider as isSupportedProviderFn, SUPPORTED_PROVIDER_KEYS as SUPPORTED_PROVIDER_KEYS_CONST } from '@/lib/payments/providers'

/** Internal registry of provider adapters */
const adapterRegistry = new Map<SupportedProviderKey, ExtendedPaymentProviderAdapter>()

/** Registers a provider adapter.
 * Should be called during module initialization (e.g., in provider's index.ts).
 * Throws if a provider with the same key is already registered. */
export function registerProvider(adapter: ExtendedPaymentProviderAdapter): void {
  if (!isSupportedProvider(adapter.key)) {
    throw new Error(`Provider key "${adapter.key}" is not in SUPPORTED_PROVIDER_KEYS. Add it to lib/payments/providers.ts`)
  }
  if (adapterRegistry.has(adapter.key)) {
    throw new Error(`Provider "${adapter.key}" is already registered`)
  }
  // Validate adapter implements all required methods
  validateAdapterRegistration(adapter)
  adapterRegistry.set(adapter.key, adapter)
}

/** Validates that an adapter is properly implemented */
function validateAdapterRegistration(adapter: ExtendedPaymentProviderAdapter): void {
  if (!adapter.key || typeof adapter.key !== 'string') {
    throw new Error('Adapter must have a string key')
  }
  if (!adapter.metadata || typeof adapter.metadata !== 'object') {
    throw new Error('Adapter must have metadata')
  }
  if (adapter.metadata.key !== adapter.key) {
    throw new Error('Adapter metadata.key must match adapter.key')
  }
  if (typeof adapter.initiate !== 'function') {
    throw new Error('Adapter must implement initiate()')
  }
  if (typeof adapter.handleCallback !== 'function') {
    throw new Error('Adapter must implement handleCallback()')
  }
  if (typeof adapter.verifyWebhook !== 'function') {
    throw new Error('Adapter must implement verifyWebhook()')
  }
  if (!adapter.metadata.capabilities) {
    throw new Error('Adapter metadata must include capabilities')
  }
}

/** Gets a registered provider adapter by key.
 * Returns null if not registered. */
export function getProviderAdapter(key: SupportedProviderKey): ExtendedPaymentProviderAdapter | null {
  return adapterRegistry.get(key) ?? null
}

/** Gets a registered provider adapter by key, throws if not registered. */
export function getProviderAdapterOrThrow(key: SupportedProviderKey): ExtendedPaymentProviderAdapter {
  const adapter = adapterRegistry.get(key)
  if (!adapter) {
    throw new Error(`Provider "${key}" is not registered. Ensure its module is imported.`)
  }
  return adapter
}

/** Returns all registered provider adapters */
export function getAllProviderAdapters(): ExtendedPaymentProviderAdapter[] {
  return Array.from(adapterRegistry.values())
}

/** Returns all enabled and registered provider adapters */
export function getEnabledProviderAdapters(): ExtendedPaymentProviderAdapter[] {
  return getEnabledProviders()
    .map(config => adapterRegistry.get(config.key as SupportedProviderKey))
    .filter((adapter): adapter is ExtendedPaymentProviderAdapter => adapter !== null)
}

/** Gets the provider config for a registered adapter */
export function getProviderConfigForAdapter(key: SupportedProviderKey): ProviderConfig {
  return getProviderConfig(key)
}

/** Checks if a provider is both enabled (via env) AND registered */
export function isProviderAvailable(key: SupportedProviderKey): boolean {
  const config = getProviderConfig(key)
  return config.enabled && adapterRegistry.has(key)
}

/** Gets the default available provider (first enabled + registered) */
export function getDefaultAvailableProvider(): { config: ProviderConfig; adapter: ExtendedPaymentProviderAdapter } | null {
  const enabled = getEnabledProviders()
  for (const config of enabled) {
    const adapter = adapterRegistry.get(config.key as SupportedProviderKey)
    if (adapter) {
      return { config, adapter }
    }
  }
  return null
}

// Re-export provider configuration functions from the providers module
export { getProviderConfig, getEnabledProviders, getDefaultProvider, hasEnabledProvider, validateProviderConfig, isSupportedProvider as isSupportedProviderFn, SUPPORTED_PROVIDER_KEYS as SUPPORTED_PROVIDER_KEYS } from '@/lib/payments/providers'