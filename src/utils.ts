import { Buffer } from 'node:buffer'

import { REQUEST_TIMEOUT_MS } from './constants.js'

export function base64UrlDecode(input: string): string {
  const base64 = input.replaceAll('-', '+').replaceAll('_', '/')
  const padLength = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLength)
  return Buffer.from(padded, 'base64').toString('utf8')
}

export function parseJwt<T>(token: string): T | null {
  try {
    const parts = token.split('.')
    const payload = parts[1]
    if (!payload)
      return null
    return JSON.parse(base64UrlDecode(payload)) as T
  } catch {
    return null
  }
}

export function createProgressBar(percent: number, width: number = 10): string {
  const safePercent = Math.max(0, Math.min(100, percent))
  const filled = Math.round((safePercent / 100) * width)
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  const days = Math.floor(safeSeconds / 86_400)
  const hours = Math.floor((safeSeconds % 86_400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0)
    parts.push(`${days}d`)
  if (hours > 0)
    parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0)
    parts.push(`${minutes}m`)

  return parts.join(' ')
}

export function formatCompactDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  const days = Math.floor(safeSeconds / 86_400)
  const hours = Math.floor((safeSeconds % 86_400) / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)

  if (days > 0)
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`

  if (hours > 0)
    return `${hours}h ${minutes}m`

  return `${minutes}m`
}

export function formatAge(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  return formatDuration(seconds)
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function getResetAfterSeconds(isoTime: string | undefined): number | undefined {
  if (!isoTime)
    return undefined

  const resetDate = new Date(isoTime)
  if (Number.isNaN(resetDate.getTime()))
    return undefined

  return Math.max(0, Math.floor((resetDate.getTime() - Date.now()) / 1000))
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      throw new Error(`Request timeout (${Math.round(timeoutMs / 1000)}s)`)
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export function pctFromUsed(usedPercent: number): number {
  return Math.max(0, Math.round(100 - usedPercent))
}

export function compactCount(value: number): string {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1000)
    return `${(value / 1000).toFixed(1)}k`
  return `${value}`
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
