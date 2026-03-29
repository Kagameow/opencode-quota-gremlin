import type { OAuthAuthData, ProviderSnapshot } from '../types.js'
import { fetchWithTimeout, formatDuration, parseJwt, pctFromUsed } from '../utils.js'

interface JwtPayload {
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string
  }
}

interface RateLimitWindow {
  used_percent: number
  limit_window_seconds: number
  reset_after_seconds: number
}

interface OpenAIUsageResponse {
  plan_type: string
  rate_limit: {
    limit_reached: boolean
    primary_window: RateLimitWindow
    secondary_window: RateLimitWindow | null
  } | null
}

const OPENAI_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'

function getAccountId(token: string): string | undefined {
  const payload = parseJwt<JwtPayload>(token)
  return payload?.['https://api.openai.com/auth']?.chatgpt_account_id
}

function formatWindowLabel(window: RateLimitWindow): string {
  const hours = Math.round(window.limit_window_seconds / 3600)
  const days = Math.round(window.limit_window_seconds / 86_400)
  return days >= 1 ? `${days}d` : `${hours}h`
}

export async function queryOpenAI(authData: OAuthAuthData | undefined): Promise<ProviderSnapshot | null> {
  if (!authData?.access || authData.type !== 'oauth')
    return null

  if (authData.expires && authData.expires < Date.now()) {
    return {
      id: 'openai',
      label: 'OpenAI',
      accountLabel: 'token expired',
      windows: [],
      error: 'OAuth token expired. Use an OpenAI model in OpenCode to refresh it.',
    }
  }

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${authData.access}`,
      'User-Agent': 'quota-gremlin/0.1.0',
    }

    const accountId = getAccountId(authData.access)
    if (accountId)
      headers['ChatGPT-Account-Id'] = accountId

    const response = await fetchWithTimeout(OPENAI_USAGE_URL, { headers })
    if (!response.ok) {
      throw new Error(`OpenAI API request failed (${response.status}): ${await response.text()}`)
    }

    const usage = await response.json() as OpenAIUsageResponse
    const windows = [usage.rate_limit?.primary_window, usage.rate_limit?.secondary_window]
      .filter((window): window is RateLimitWindow => Boolean(window))
      .map(window => ({
        id: formatWindowLabel(window),
        label: formatWindowLabel(window),
        remainingPercent: pctFromUsed(window.used_percent),
        resetInSeconds: window.reset_after_seconds,
        resetLabel: formatDuration(window.reset_after_seconds),
      }))

    return {
      id: 'openai',
      label: 'OpenAI',
      accountLabel: usage.plan_type,
      windows,
      ...(usage.rate_limit?.limit_reached ? { note: 'limit reached' } : {}),
    }
  } catch (error) {
    return {
      id: 'openai',
      label: 'OpenAI',
      accountLabel: 'query failed',
      windows: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
