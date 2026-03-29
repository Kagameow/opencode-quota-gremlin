import type { OAuthAuthData, ProviderSnapshot } from '../types.js'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

import { join } from 'node:path'
import { fetchWithTimeout, formatDuration } from '../utils.js'

interface QuotaDetail {
  entitlement: number
  overage_count: number
  percent_remaining: number
  remaining: number
  unlimited: boolean
}

interface CopilotUsageResponse {
  copilot_plan: string
  quota_reset_date: string
  quota_snapshots: {
    premium_interactions: QuotaDetail
  }
}

interface CopilotTokenResponse {
  token: string
}

interface CopilotQuotaConfig {
  token: string
  username: string
  tier: 'free' | 'pro' | 'pro+' | 'business' | 'enterprise'
}

interface BillingUsageResponse {
  timePeriod: { year: number, month?: number }
  user: string
  usageItems: Array<{
    sku: string
    model?: string
    unitType: string
    grossQuantity: number
  }>
}

const GITHUB_API_BASE_URL = 'https://api.github.com'
const COPILOT_VERSION = '0.35.0'
const USER_AGENT = `GitHubCopilotChat/${COPILOT_VERSION}`
const COPILOT_HEADERS = {
  'User-Agent': USER_AGENT,
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': `copilot-chat/${COPILOT_VERSION}`,
  'Copilot-Integration-Id': 'vscode-chat',
}
const CONFIG_PATH = join(homedir(), '.config/opencode/copilot-quota-token.json')

const PLAN_LIMITS: Record<NonNullable<CopilotQuotaConfig['tier']>, number> = {
  'free': 50,
  'pro': 300,
  'pro+': 1500,
  'business': 300,
  'enterprise': 1000,
}

function readQuotaConfig(): CopilotQuotaConfig | null {
  try {
    if (!existsSync(CONFIG_PATH))
      return null
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as CopilotQuotaConfig
    return config.token && config.username && config.tier ? config : null
  } catch {
    return null
  }
}

async function fetchPublicBillingUsage(config: CopilotQuotaConfig): Promise<BillingUsageResponse> {
  const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/users/${config.username}/settings/billing/premium_request/usage`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok)
    throw new Error(`Copilot public billing request failed (${response.status}): ${await response.text()}`)

  return response.json() as Promise<BillingUsageResponse>
}

async function exchangeForCopilotToken(oauthToken: string): Promise<string | null> {
  const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/copilot_internal/v2/token`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${oauthToken}`,
      ...COPILOT_HEADERS,
    },
  })

  if (!response.ok)
    return null

  const tokenData = await response.json() as CopilotTokenResponse
  return tokenData.token
}

async function fetchInternalUsage(authData: OAuthAuthData): Promise<CopilotUsageResponse> {
  const oauthToken = authData.refresh || authData.access
  if (!oauthToken)
    throw new Error('No OAuth token found in auth data')

  const directResponse = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/copilot_internal/user`, {
    headers: {
      Accept: 'application/json',
      Authorization: `token ${oauthToken}`,
      ...COPILOT_HEADERS,
    },
  })

  if (directResponse.ok)
    return directResponse.json() as Promise<CopilotUsageResponse>

  const copilotToken = await exchangeForCopilotToken(oauthToken)
  if (!copilotToken)
    throw new Error('Copilot quota is unavailable for the current OAuth token.')

  const response = await fetchWithTimeout(`${GITHUB_API_BASE_URL}/copilot_internal/user`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${copilotToken}`,
      ...COPILOT_HEADERS,
    },
  })

  if (!response.ok)
    throw new Error(`Copilot API request failed (${response.status}): ${await response.text()}`)

  return response.json() as Promise<CopilotUsageResponse>
}

function resetCountdown(resetDate: string): string {
  const diffMs = new Date(resetDate).getTime() - Date.now()
  return formatDuration(Math.max(0, Math.floor(diffMs / 1000)))
}

export async function queryCopilot(authData: OAuthAuthData | undefined): Promise<ProviderSnapshot | null> {
  try {
    const publicConfig = readQuotaConfig()
    if (publicConfig) {
      const usage = await fetchPublicBillingUsage(publicConfig)
      const used = usage.usageItems
        .filter(item => item.sku === 'Copilot Premium Request' || item.sku.includes('Premium'))
        .reduce((sum, item) => sum + item.grossQuantity, 0)
      const total = PLAN_LIMITS[publicConfig.tier]
      const remaining = Math.max(0, total - used)
      const remainingPercent = Math.max(0, Math.round((remaining / total) * 100))

      return {
        id: 'copilot',
        label: 'Copilot',
        accountLabel: publicConfig.tier,
        windows: [{
          id: 'monthly',
          label: 'mo',
          remainingPercent,
          used,
          total,
          resetLabel: usage.timePeriod.month ? `${usage.timePeriod.year}-${String(usage.timePeriod.month).padStart(2, '0')}` : `${usage.timePeriod.year}`,
        }],
        ...(used > total ? { note: 'over included premium quota' } : {}),
      }
    }

    if (!authData?.refresh && !authData?.access)
      return null

    const usage = await fetchInternalUsage(authData)
    const premium = usage.quota_snapshots.premium_interactions
    const used = premium.entitlement - premium.remaining

    return {
      id: 'copilot',
      label: 'Copilot',
      accountLabel: usage.copilot_plan,
      windows: [{
        id: 'monthly',
        label: 'mo',
        remainingPercent: Math.max(0, Math.round(premium.percent_remaining)),
        used,
        total: premium.entitlement,
        resetLabel: resetCountdown(usage.quota_reset_date),
      }],
      ...(premium.overage_count > 0 ? { note: `${premium.overage_count} overage requests` } : {}),
    }
  } catch (error) {
    return {
      id: 'copilot',
      label: 'Copilot',
      accountLabel: 'query failed',
      windows: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
