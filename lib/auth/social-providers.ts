export const socialProviders = ['google', 'facebook'] as const

export type SocialProviderId = typeof socialProviders[number]
export function isSocialProvider(value: string): value is SocialProviderId {
  return value === 'google' || value === 'facebook'
}
