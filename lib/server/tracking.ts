import 'server-only'

import { cache } from 'react'

import { resolveTrackingSettings } from '../tracking'
import { getSetting } from './settings'

export const getTrackingSettings = cache(async () => {
  try {
    const [enabled, containerId] = await Promise.all([
      getSetting('tracking.gtmEnabled'),
      getSetting('tracking.gtmContainerId'),
    ])
    return resolveTrackingSettings({ enabled, containerId })
  } catch {
    // An unavailable setting is not permission to use the fallback container.
    return { enabled: false, containerId: '' }
  }
})
