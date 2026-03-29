import type { TuiPluginApi } from '@opencode-ai/plugin/tui'
import type { QuotaSnapshot } from '../types.js'

import { createResource, createSignal, onCleanup } from 'solid-js'

import { AUTO_REFRESH_MS, REFRESH_DEBOUNCE_MS } from '../constants.js'
import { getQuotaSnapshot, refreshQuotaSnapshot } from '../quota.js'

export function useQuotaSnapshot(api: TuiPluginApi, sessionID: () => string) {
  const [tick, setTick] = createSignal(0)
  const [snapshot] = createResource<QuotaSnapshot, string>(
    () => `${sessionID()}:${tick()}`,
    async (_, info) => {
      const force = info.value === undefined
      return force ? refreshQuotaSnapshot() : getQuotaSnapshot()
    },
  )

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const queueRefresh = (force: boolean = false) => {
    if (debounceTimer)
      clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (force)
        void refreshQuotaSnapshot().then(() => setTick(value => value + 1))
      else
        setTick(value => value + 1)
    }, REFRESH_DEBOUNCE_MS)
  }

  const interval = setInterval(() => queueRefresh(false), AUTO_REFRESH_MS)

  const unsubscribers = [
    api.event.on('session.updated', (event) => {
      if (event.properties.info.id === sessionID())
        queueRefresh(false)
    }),
    api.event.on('message.updated', (event) => {
      if (event.properties.info.sessionID === sessionID())
        queueRefresh(false)
    }),
    api.event.on('message.removed', (event) => {
      if (event.properties.sessionID === sessionID())
        queueRefresh(false)
    }),
    api.event.on('tui.session.select', (event) => {
      if (event.properties.sessionID === sessionID())
        queueRefresh(true)
    }),
  ]

  onCleanup(() => {
    clearInterval(interval)
    if (debounceTimer)
      clearTimeout(debounceTimer)
    for (const unsubscribe of unsubscribers)
      unsubscribe()
  })

  return {
    snapshot,
    refresh: () => queueRefresh(true),
  }
}
