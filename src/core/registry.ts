import type { AuthData, ProviderAdapter, ProviderSnapshot } from '../types.js'
import { queryAnthropic } from '../providers/anthropic.js'
import { queryCopilot } from '../providers/copilot.js'
import { queryOpenAI } from '../providers/openai.js'

const providerAdapters: ProviderAdapter[] = [
  {
    id: 'anthropic',
    query: authData => queryAnthropic(authData.anthropic),
  },
  {
    id: 'openai',
    query: authData => queryOpenAI(authData.openai),
  },
  {
    id: 'copilot',
    query: authData => queryCopilot(authData['github-copilot']),
  },
]

export async function queryProviders(authData: AuthData): Promise<ProviderSnapshot[]> {
  const providers = await Promise.all(providerAdapters.map(adapter => adapter.query(authData)))
  return providers.filter((provider): provider is ProviderSnapshot => Boolean(provider))
}
