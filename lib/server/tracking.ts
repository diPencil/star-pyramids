import 'server-only'

import { cache } from 'react'

import { resolveTrackingSettings } from '../tracking'
import { getSetting } from './settings'

export const getTrackingSettings = cache(async () => {
  const [enabled, containerId] = await Promise.all([
    getSetting('tracking.gtmEnabled'),
    getSetting('tracking.gtmContainerId'),
  ])
  return resolveTrackingSettings({ enabled, containerId })
})
