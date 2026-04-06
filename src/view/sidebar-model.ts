import type {
  ProviderSnapshot,
  ProviderWindow,
  QuotaSnapshot,
  SidebarProviderView,
  SidebarTone,
  SidebarWindowView,
} from '../types.js'
import { formatClock, formatCompactDuration } from '../utils.js'

function getWindowTone(percent: number | undefined, hasError: boolean): SidebarTone {
  if (hasError)
    return 'error'
  if (percent === undefined)
    return 'default'
  if (percent <= 10)
    return 'error'
  if (percent <= 30)
    return 'warning'
  return 'success'
}

function getResetText(window: ProviderWindow): string | undefined {
  if (typeof window.resetInSeconds === 'number')
    return formatCompactDuration(window.resetInSeconds)
  return window.resetLabel
}

function buildWindowText(provider: ProviderSnapshot, window: ProviderWindow): string {
  const resetText = getResetText(window)

  if (provider.id === 'copilot') {
    const parts: string[] = []
    if (typeof window.used === 'number' && typeof window.total === 'number')
      parts.push(`${window.used}/${window.total} ${window.label}`)
    else
      parts.push(window.label)
    if (typeof window.remainingPercent === 'number')
      parts.push(`${window.remainingPercent}%`)
    if (resetText)
      parts.push(resetText)
    return parts.join(' · ')
  }

  const parts: string[] = [window.label]
  if (typeof window.remainingPercent === 'number')
    parts.push(`${window.remainingPercent}%`)
  if (typeof window.used === 'number' && typeof window.total === 'number')
    parts.push(`${window.used}/${window.total}`)
  if (resetText)
    parts.push(resetText)
  return parts.join(' · ')
}

function buildWindowView(provider: ProviderSnapshot, window: ProviderWindow): SidebarWindowView {
  return {
    id: window.id,
    text: buildWindowText(provider, window),
    tone: getWindowTone(window.remainingPercent, false),
    showProgressBar: provider.id !== 'copilot',
    ...(provider.id !== 'copilot' && typeof window.remainingPercent === 'number'
      ? { progressPercent: window.remainingPercent }
      : {}),
  }
}

export function buildSidebarProviderView(provider: ProviderSnapshot): SidebarProviderView {
  return {
    id: provider.id,
    title: provider.label,
    ...(provider.accountLabel ? { meta: provider.accountLabel } : {}),
    ...(provider.error ? { error: provider.error } : {}),
    windows: provider.windows.map(window => buildWindowView(provider, window)),
    ...(provider.errorDetail ? { note: provider.errorDetail } : {}),
    ...(provider.note ? { note: provider.note } : {}),
  }
}

export function buildSidebarProviderViews(snapshot: QuotaSnapshot | undefined): SidebarProviderView[] {
  return snapshot?.providers.map(buildSidebarProviderView) || []
}

export function buildSidebarFooterText(snapshot: QuotaSnapshot | undefined): string | undefined {
  if (!snapshot)
    return undefined
  return `Updated ${formatClock(snapshot.fetchedAt)}  ฅ^•ﻌ•^ฅ`
}
