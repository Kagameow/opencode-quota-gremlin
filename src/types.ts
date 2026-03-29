export interface OAuthAuthData {
  type: string
  access?: string
  refresh?: string
  expires?: number
}

export interface AuthData {
  'anthropic'?: OAuthAuthData
  'openai'?: OAuthAuthData & {
    accountId?: string
  }
  'github-copilot'?: OAuthAuthData
}

export type ProviderID = 'anthropic' | 'openai' | 'copilot'

export interface ProviderWindow {
  id: string
  label: string
  remainingPercent?: number
  used?: number
  total?: number
  resetInSeconds?: number
  resetLabel?: string
}

export interface ProviderSnapshot {
  id: ProviderID
  label: string
  accountLabel: string
  windows: ProviderWindow[]
  note?: string
  error?: string
}

export interface QuotaSnapshot {
  providers: ProviderSnapshot[]
  fetchedAt: number
}

export interface QueryOptions {
  force?: boolean
}

export interface ProviderAdapter {
  id: ProviderID
  query: (authData: AuthData) => Promise<ProviderSnapshot | null>
}

export type SidebarTone = 'default' | 'success' | 'warning' | 'error' | 'muted'

export interface SidebarWindowView {
  id: string
  text: string
  tone: SidebarTone
  showProgressBar: boolean
  progressPercent?: number
}

export interface SidebarProviderView {
  id: ProviderID
  title: string
  meta?: string
  error?: string
  windows: SidebarWindowView[]
  note?: string
}
