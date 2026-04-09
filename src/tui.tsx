/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from '@opencode-ai/plugin/tui'
import type { QuotaSnapshot, SidebarProviderView } from './types.js'

import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'

import { AUTO_REFRESH_MS, PLUGIN_ID, REFRESH_DEBOUNCE_MS, SIDEBAR_ORDER } from './constants.js'
import { getQuotaSnapshot, refreshQuotaSnapshot } from './quota.js'
import { createProgressBar } from './utils.js'
import { buildSidebarFooterText, buildSidebarProviderViews } from './view/sidebar-model.js'

function useQuotaSnapshot(api: TuiPluginApi, sessionID: () => string) {
  const [snapshot, setSnapshot] = createSignal<QuotaSnapshot | undefined>(undefined)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | undefined>(undefined)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  async function load(force: boolean) {
    setLoading(true)
    setError(undefined)
    try {
      const result = force
        ? await refreshQuotaSnapshot()
        : await getQuotaSnapshot()
      setSnapshot(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function queueRefresh(force: boolean = false) {
    if (debounceTimer)
      clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => void load(force), REFRESH_DEBOUNCE_MS)
  }

  onMount(() => {
    void load(false)

    const autoRefreshInterval = setInterval(() => queueRefresh(false), AUTO_REFRESH_MS)

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
      if (debounceTimer)
        clearTimeout(debounceTimer)
      clearInterval(autoRefreshInterval)
      for (const unsubscribe of unsubscribers)
        unsubscribe()
    })
  })

  return {
    snapshot,
    loading,
    error,
    refresh: () => queueRefresh(true),
  }
}

function getTone(api: TuiPluginApi, tone: 'default' | 'success' | 'warning' | 'error' | 'muted') {
  if (tone === 'success')
    return api.theme.current.success
  if (tone === 'warning')
    return api.theme.current.warning
  if (tone === 'error')
    return api.theme.current.error
  if (tone === 'muted')
    return api.theme.current.textMuted
  return api.theme.current.text
}

function ProviderCard(props: { api: TuiPluginApi, provider: SidebarProviderView }) {
  const theme = () => props.api.theme.current

  return (
    <box flexDirection="column" paddingTop={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme().text}>
          <b>{props.provider.title}</b>
        </text>
        <Show when={props.provider.meta}>
          <text fg={theme().textMuted}>
            {props.provider.meta}
          </text>
        </Show>
      </box>

      <Show
        when={props.provider.error}
        fallback={(
          <box flexDirection="column">
            <For each={props.provider.windows}>
              {window => (
                <text fg={getTone(props.api, window.tone)}>
                  <Show when={window.showProgressBar}>
                    {createProgressBar(window.progressPercent ?? 0, 8)}
                    {' '}
                  </Show>
                  {window.text}
                </text>
              )}
            </For>
            <Show when={props.provider.note}>
              <text fg={theme().textMuted}>{props.provider.note}</text>
            </Show>
          </box>
        )}
      >
        <text fg={theme().error}>{props.provider.error}</text>
      </Show>
    </box>
  )
}

function SidebarView(props: { api: TuiPluginApi, sessionID: string }) {
  const quota = useQuotaSnapshot(props.api, () => props.sessionID)
  const theme = () => props.api.theme.current
  const snapshot = () => quota.snapshot()
  const providerViews = () => buildSidebarProviderViews(snapshot())
  const footerText = () => buildSidebarFooterText(snapshot())
  const errorText = () => quota.error()
  const isLoading = () => quota.loading() && !snapshot()
  const hasProviders = () => providerViews().length > 0

  return (
    <box flexDirection="column">
      <Show
        when={errorText()}
        fallback={(
          <Show
            when={isLoading()}
            fallback={(
              <Show
                when={hasProviders()}
                fallback={<text fg={theme().textMuted}>No supported accounts found.</text>}
              >
                <For each={providerViews()}>
                  {provider => <ProviderCard api={props.api} provider={provider} />}
                </For>
              </Show>
            )}
          >
            <text fg={theme().textMuted}>Refreshing...</text>
          </Show>
        )}
      >
        <text fg={theme().error}>{errorText()}</text>
      </Show>

      <box paddingTop={1}>
        <Show
          when={isLoading()}
          fallback={(
            <Show when={footerText()}>
              <text fg={theme().textMuted}>{footerText()}</text>
            </Show>
          )}
        >
          <Show when={snapshot()}>
            <text fg={theme().textMuted}>Refreshing...</text>
          </Show>
        </Show>
      </box>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.command.register(() => [{
    title: 'Refresh Quota Gremlin',
    value: 'quota-gremlin:refresh',
    description: 'Force-refresh sidebar quota data',
    category: 'Plugins',
    onSelect: () => {
      void refreshQuotaSnapshot().then(() => {
        api.ui.toast({
          title: 'Quota Gremlin',
          message: 'Quota data refreshed.',
          variant: 'success',
        })
      }).catch((error) => {
        api.ui.toast({
          title: 'Quota Gremlin',
          message: error instanceof Error ? error.message : String(error),
          variant: 'error',
        })
      })
    },
  }])

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        return <SidebarView api={api} sessionID={props.session_id} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: PLUGIN_ID,
  tui,
}

export default plugin
