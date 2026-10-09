// Payment provider configuration and feature flags
// Phase 2F-B: Provider-neutral payment gateway foundation
// No provider is enabled by default. All require explicit opt-in via env.

import type { PaymentProviderKey } from '@/lib/payment'

/** Runtime provider configuration — all values from environment */
export interface ProviderConfig {
  /** Provider key — matches PaymentProviderAdapter.key */
  key: PaymentProviderKey
  /** Human-readable provider name */
  name: string
  /** Whether this provider is enabled for live payments */
  enabled: boolean
  /** Whether to use sandbox/test mode */
  testMode: boolean
  /** Provider-specific configuration (keys, secrets, etc.) */
  config: Record<string, string>
}

/** Supported provider keys — extend when adding new gateways */
export const SUPPORTED_PROVIDER_KEYS = [
  'stripe',
  'paypal',
  'adyen',
] as const

export type SupportedProviderKey = (typeof SUPPORTED_PROVIDER_KEYS)[number]

/** Returns true if the provider key is supported */
export function isSupportedProvider(key: string): key is SupportedProviderKey {
  return SUPPORTED_PROVIDER_KEYS.includes(key as SupportedProviderKey)
}

/**
 * Builds provider configuration from environment variables.
 * No provider is enabled by default — all require explicit opt-in.
 * Format: PROVIDER_<KEY>_ENABLED, PROVIDER_<KEY>_TEST_MODE, PROVIDER_<KEY>_<SETTING>
 */
export function getProviderConfig(key: SupportedProviderKey): ProviderConfig {
  const prefix = `PROVIDER_${key.toUpperCase()}`
  const enabled = process.env[`${prefix}_ENABLED`] === 'true'
  const testMode = process.env[`${prefix}_TEST_MODE`] === 'true'

  // Collect all provider-specific config from env
  const config: Record<string, string> = {}
  const configPrefix = `${prefix}_`
  for (const [envKey, envValue] of Object.entries(process.env)) {
    if (envKey.startsWith(configPrefix) && !['ENABLED', 'TEST_MODE'].includes(envKey.slice(configPrefix.length))) {
      const settingKey = envKey.slice(configPrefix.length).toLowerCase()
      if (envValue !== undefined) {
        config[settingKey] = envValue
      }
    }
  }

  return {
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    enabled,
    testMode,
    config,
  }
}

/** Returns all enabled provider configurations */
export function getEnabledProviders(): ProviderConfig[] {
  return SUPPORTED_PROVIDER_KEYS
    .map(getProviderConfig)
    .filter(p => p.enabled)
}

/** Returns a provider config by key, throws if not enabled */
export function getEnabledProviderOrThrow(key: SupportedProviderKey): ProviderConfig {
  const config = getProviderConfig(key)
  if (!config.enabled) {
    throw new Error(`Payment provider "${key}" is not enabled. Set ${key.toUpperCase()}_ENABLED=true to enable.`)
  }
  return config
}

/** Returns true if any provider is enabled */
export function hasEnabledProvider(): boolean {
  return getEnabledProviders().length > 0
}

/** Gets the default enabled provider (first enabled), or null if none */
export function getDefaultProvider(): ProviderConfig | null {
  const enabled = getEnabledProviders()
  return enabled.length > 0 ? enabled[0] : null
}

/**
 * Validates that a provider is enabled and properly configured.
 * Throws if validation fails.
 */
export function validateProviderConfig(key: SupportedProviderKey): void {
  const config = getProviderConfig(key)
  if (!config.enabled) {
    throw new Error(`Payment provider "${key}" is not enabled.`)
  }
  // Provider-specific validation can be added here
  // e.g., check for required keys like secret_key, webhook_secret, etc.
}

/** Type guard for provider config */
export function isProviderConfig(value: unknown): value is ProviderConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ProviderConfig).key === 'string' &&
    typeof (value as ProviderConfig).name === 'string' &&
    typeof (value as ProviderConfig).enabled === 'boolean' &&
    typeof (value as ProviderConfig).testMode === 'boolean' &&
    typeof (value as ProviderConfig).config === 'object'
  )
}