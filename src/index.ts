import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'

import { formatQuotaSnapshot, refreshQuotaSnapshot } from './quota.js'

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
    },
  }
}

export default QuotaGremlinPlugin
