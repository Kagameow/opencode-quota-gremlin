import type { AuthData } from './types.js'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'

import { join } from 'node:path'

const AUTH_PATH = join(homedir(), '.local/share/opencode/auth.json')

export async function readAuthData(): Promise<AuthData> {
  const content = await readFile(AUTH_PATH, 'utf8')
  return JSON.parse(content) as AuthData
}

export function getAuthPath(): string {
  return AUTH_PATH
}
