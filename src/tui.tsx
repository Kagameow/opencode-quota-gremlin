/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from '@opencode-ai/plugin/tui'
import type { SidebarProviderView } from './types.js'

import { For, Show, splitProps, untrack } from 'solid-js'

import { PLUGIN_ID, SIDEBAR_ORDER } from './constants.js'
import { refreshQuotaSnapshot } from './quota.js'
import { useQuotaSnapshot } from './tui/use-quota-snapshot.js'
import { createProgressBar } from './utils.js'
import { buildSidebarFooterText, buildSidebarProviderViews } from './view/sidebar-model.js'

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
  const [local] = splitProps(props, ['api', 'sessionID'])
  const api = untrack(() => local.api)
  const quota = useQuotaSnapshot(api, () => local.sessionID)
  const theme = () => api.theme.current
  const providerViews = () => buildSidebarProviderViews(quota.snapshot())
  const footerText = () => buildSidebarFooterText(quota.snapshot())

  return (
    <box flexDirection="column">
      <Show when={providerViews().length} fallback={<text fg={theme().textMuted}>No supported accounts found.</text>}>
        <For each={providerViews()}>
          {provider => <ProviderCard api={api} provider={provider} />}
        </For>
      </Show>

      <box paddingTop={1}>
        <Show
          when={quota.snapshot.loading}
          fallback={(
            <Show when={footerText()}>
              <text fg={theme().textMuted}>{footerText()}</text>
            </Show>
          )}
        >
          <text fg={theme().textMuted}>Refreshing...</text>
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
