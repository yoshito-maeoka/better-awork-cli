import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface ResolvedToken {
  token: string
  source: string
}

interface ResolveOptions {
  env?: NodeJS.ProcessEnv
  home?: string
}

const ENV_KEYS = ['BAW_TOKEN', 'AWORK_TOKEN'] as const
const configPath = (home: string) => join(home, '.config', 'baw', 'config.json')
const legacyPath = (home: string) => join(home, '.config', 'awork-cli', 'config.json')

const readJson = (path: string): Record<string, unknown> | null => {
  if (!existsSync(path)) return null
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

export function resolveToken({ env = process.env, home = homedir() }: ResolveOptions = {}): ResolvedToken | null {
  for (const key of ENV_KEYS) {
    const token = nonEmpty(env[key])
    if (token) return { token, source: key }
  }
  const own = nonEmpty(readJson(configPath(home))?.token)
  if (own) return { token: own, source: '~/.config/baw/config.json' }
  const legacy = nonEmpty(readJson(legacyPath(home))?.ApiToken)
  if (legacy) return { token: legacy, source: '~/.config/awork-cli/config.json' }
  return null
}

export function resolveUserId({ env = process.env, home = homedir() }: ResolveOptions = {}): string | undefined {
  return nonEmpty(env.BAW_USER_ID) ?? nonEmpty(readJson(configPath(home))?.userId) ?? undefined
}

export interface BawConfig {
  token?: string
  userId?: string
}

/** Merge `update` into ~/.config/baw/config.json (owner-only permissions). */
export function saveConfig(update: BawConfig, home: string = homedir()): string {
  if (update.token !== undefined && !update.token.trim()) throw new Error('Token is empty.')
  const path = configPath(home)
  const current = readJson(path) ?? {}
  const next = {
    ...current,
    ...(update.token === undefined ? {} : { token: update.token.trim() }),
    ...(update.userId === undefined ? {} : { userId: update.userId }),
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}
