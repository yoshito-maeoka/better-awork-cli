import { mkdtempSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { resolveToken, resolveUserId, saveConfig } from '../src/config.js'

const home = () => mkdtempSync(join(tmpdir(), 'baw-home-'))

describe('resolveToken', () => {
  test('prefers BAW_TOKEN, then AWORK_TOKEN', () => {
    expect(resolveToken({ env: { BAW_TOKEN: 'a', AWORK_TOKEN: 'b' }, home: home() })).toEqual({ token: 'a', source: 'BAW_TOKEN' })
    expect(resolveToken({ env: { AWORK_TOKEN: 'b' }, home: home() })).toEqual({ token: 'b', source: 'AWORK_TOKEN' })
  })

  test('reads the baw config file', () => {
    const h = home()
    saveConfig({ token: 'from-file' }, h)
    expect(resolveToken({ env: {}, home: h })?.token).toBe('from-file')
  })

  test('falls back to the existing awork-cli config', () => {
    const h = home()
    mkdirSync(join(h, '.config', 'awork-cli'), { recursive: true })
    writeFileSync(join(h, '.config', 'awork-cli', 'config.json'), JSON.stringify({ ApiToken: 'legacy' }))
    expect(resolveToken({ env: {}, home: h })).toEqual({ token: 'legacy', source: '~/.config/awork-cli/config.json' })
  })

  test('returns null when nothing is configured', () => {
    expect(resolveToken({ env: {}, home: home() })).toBeNull()
  })
})

describe('saveConfig', () => {
  test('writes the config with owner-only permissions', () => {
    const h = home()
    const path = saveConfig({ token: 'secret' }, h)
    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  test('rejects empty tokens', () => {
    expect(() => saveConfig({ token: '  ' }, home())).toThrow(/empty/)
  })
})

describe('resolveUserId', () => {
  test('prefers BAW_USER_ID over the config file', () => {
    const h = home()
    saveConfig({ token: 't', userId: 'from-file' }, h)
    expect(resolveUserId({ env: { BAW_USER_ID: 'from-env' }, home: h })).toBe('from-env')
    expect(resolveUserId({ env: {}, home: h })).toBe('from-file')
  })

  test('saveConfig merges with the existing config', () => {
    const h = home()
    saveConfig({ token: 't' }, h)
    saveConfig({ userId: 'u1' }, h)
    expect(resolveToken({ env: {}, home: h })?.token).toBe('t')
    expect(resolveUserId({ env: {}, home: h })).toBe('u1')
  })

  test('returns undefined when not configured', () => {
    expect(resolveUserId({ env: {}, home: home() })).toBeUndefined()
  })
})
