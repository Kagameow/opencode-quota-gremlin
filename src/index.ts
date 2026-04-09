import type { Plugin } from '@opencode-ai/plugin'
import { readFile } from 'node:fs/promises'

import { join } from 'node:path'
import { tool } from '@opencode-ai/plugin'
import { getAuthPath, readAuthData } from './auth.js'
import { formatQuotaSnapshot, getQuotaSnapshot, refreshQuotaSnapshot } from './quota.js'

async function readPluginVersion(): Promise<string> {
  try {
    const pkgPath = join(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

async function buildDebugReport(): Promise<string> {
  const version = await readPluginVersion()
  const authPath = getAuthPath()
  const lines: string[] = [
    `Quota Gremlin Debug`,
    ``,
    `Version: ${version}`,
    `Auth path: ${authPath}`,
  ]

  let authData
  try {
    authData = await readAuthData()
    const keys = Object.keys(authData)
    lines.push(`Auth keys found: ${keys.length > 0 ? keys.join(', ') : '(none)'}`)
  } catch (error) {
    lines.push(`Auth read error: ${error instanceof Error ? error.message : String(error)}`)
    return lines.join('\n')
  }

  const cached = await getQuotaSnapshot()
  lines.push(``)
  lines.push(`Last fetch: ${cached ? new Date(cached.fetchedAt).toISOString() : '(never)'}`)
  lines.push(`Providers in snapshot: ${cached?.providers.length ?? 0}`)

  if (cached?.providers.length) {
    lines.push(``)
    for (const p of cached.providers) {
      const status = p.error ? `ERROR: ${p.error}` : `OK (${p.windows.length} window${p.windows.length === 1 ? '' : 's'})`
      lines.push(`  ${p.id} [${p.label}] — ${status}`)
      if (p.errorDetail)
        lines.push(`    detail: ${p.errorDetail}`)
    }
  }

  return lines.join('\n')
}

export const QuotaGremlinPlugin: Plugin = async () => {
  return {
    tool: {
      quota_gremlin_refresh: tool({
        description: 'Refresh quota gremlin data and return the latest snapshot.',
        args: {},
        async execute() {
          try {
            return formatQuotaSnapshot(await refreshQuotaSnapshot())
          } catch (error) {
            return error instanceof Error ? error.message : String(error)
          }
        },
      }),
      quota_gremlin_debug: tool({
        description: 'Show quota gremlin diagnostic info: version, auth status, provider health, and last fetch timestamp.',
        args: {},
        async execute() {
          try {
            return await buildDebugReport()
          } catch (error) {
            return `Debug report failed: ${error instanceof Error ? error.message : String(error)}`
          }
        },
      }),
    },
  }
}

export default QuotaGremlinPlugin
