import type { OAuthAuthData, ProviderSnapshot } from '../types.js'
import { fetchWithTimeout, formatDuration, formatUsd, getResetAfterSeconds, pctFromUsed } from '../utils.js'

interface AnthropicUsageWindow {
  utilization: number
  resets_at?: string
}

interface AnthropicUsageResponse {
  five_hour?: AnthropicUsageWindow
  seven_day?: AnthropicUsageWindow
  extra_usage?: {
    is_enabled?: boolean
    used_credits?: number
    monthly_limit?: number
  }
}

const ANTHROPIC_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'

export async function queryAnthropic(authData: OAuthAuthData | undefined): Promise<ProviderSnapshot | null> {
  if (!authData?.access || authData.type !== 'oauth')
    return null

  if (authData.expires && authData.expires < Date.now()) {
    return {
      id: 'anthropic',
      label: 'Claude',
      accountLabel: 'token expired',
      windows: [],
      error: 'OAuth token expired. Use an Anthropic model in OpenCode to refresh it.',
    }
  }

  try {
    const response = await fetchWithTimeout(ANTHROPIC_USAGE_URL, {
      headers: {
        'Authorization': `Bearer ${authData.access}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
        'User-Agent': 'quota-gremlin/0.1.0',
      },
    })

    if (!response.ok)
      throw new Error(`Anthropic API request failed (${response.status}): ${await response.text()}`)

    const usage = await response.json() as AnthropicUsageResponse
    const windows = [
      ['5h', usage.five_hour],
      ['7d', usage.seven_day],
    ]
      .filter((entry): entry is [string, AnthropicUsageWindow] => Boolean(entry[1]))
      .map(([label, window]) => {
        const resetInSeconds = getResetAfterSeconds(window.resets_at)

        return {
          id: label,
          label,
          remainingPercent: pctFromUsed(window.utilization),
          ...(typeof resetInSeconds === 'number'
            ? {
                resetInSeconds,
                resetLabel: formatDuration(resetInSeconds),
              }
            : {}),
        }
      })

    const extraUsage = usage.extra_usage
    const note = extraUsage?.is_enabled && extraUsage.monthly_limit
      ? `Extra ${formatUsd(extraUsage.used_credits || 0)} / ${formatUsd(extraUsage.monthly_limit)}`
      : undefined

    return {
      id: 'anthropic',
      label: 'Claude',
      accountLabel: 'OAuth',
      windows,
      ...(note ? { note } : {}),
    }
  } catch (error) {
    return {
      id: 'anthropic',
      label: 'Claude',
      accountLabel: 'query failed',
      windows: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
