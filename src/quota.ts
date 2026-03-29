import type { QueryOptions, QuotaSnapshot } from './types.js'
import { getAuthPath, readAuthData } from './auth.js'
import { CACHE_TTL_MS } from './constants.js'
import { queryProviders } from './core/registry.js'

let cachedSnapshot: QuotaSnapshot | null = null
let inflightSnapshot: Promise<QuotaSnapshot> | null = null

async function buildSnapshot(): Promise<QuotaSnapshot> {
  const authData = await readAuthData()
  const providers = await queryProviders(authData)

  return {
    providers,
    fetchedAt: Date.now(),
  }
}

export async function getQuotaSnapshot(options: QueryOptions = {}): Promise<QuotaSnapshot> {
  const now = Date.now()

  if (!options.force && cachedSnapshot && now - cachedSnapshot.fetchedAt < CACHE_TTL_MS)
    return cachedSnapshot

  if (!options.force && inflightSnapshot)
    return inflightSnapshot

  inflightSnapshot = buildSnapshot()
    .then((snapshot) => {
      cachedSnapshot = snapshot
      return snapshot
    })
    .finally(() => {
      inflightSnapshot = null
    })

  return inflightSnapshot
}

export async function refreshQuotaSnapshot(): Promise<QuotaSnapshot> {
  return getQuotaSnapshot({ force: true })
}

export function formatQuotaSnapshot(snapshot: QuotaSnapshot): string {
  if (snapshot.providers.length === 0)
    return `Quota Gremlin\n\nNo configured accounts found in ${getAuthPath()}.`

  const lines = ['Quota Gremlin', '']

  for (const provider of snapshot.providers) {
    lines.push(`${provider.label} — ${provider.accountLabel}`)

    if (provider.error) {
      lines.push(`- Error: ${provider.error}`)
      lines.push('')
      continue
    }

    for (const window of provider.windows) {
      const parts: string[] = [window.label]
      if (typeof window.remainingPercent === 'number')
        parts.push(`${window.remainingPercent}% remaining`)
      if (typeof window.used === 'number' && typeof window.total === 'number')
        parts.push(`${window.used}/${window.total}`)
      if (window.resetLabel)
        parts.push(`resets ${window.resetLabel}`)
      lines.push(`- ${parts.join(' · ')}`)
    }

    if (provider.note)
      lines.push(`- ${provider.note}`)

    lines.push('')
  }

  lines.push(`Updated ${new Date(snapshot.fetchedAt).toLocaleTimeString()}`)
  return lines.join('\n').trimEnd()
}
