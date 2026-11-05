import { describe, expect, test } from 'vitest'
import { findUser, isApiClient } from '../src/identity.js'

const users = [
  { id: 'u1', firstName: 'Yoshito', lastName: 'Maeoka', userContactInfos: [{ type: 'email', value: 'Yoshito@Example.com' }] },
  { id: 'u2', firstName: 'Ada', lastName: 'Lovelace', userContactInfos: [{ type: 'phone', value: '123' }] },
  { id: 'u3', firstName: 'Ada', lastName: 'Byron' },
]

describe('isApiClient', () => {
  test('detects the integration user awork returns for API keys', () => {
    expect(isApiClient({ id: 'x', firstName: 'better-awork-cli', lastName: '(API Client)' })).toBe(true)
    expect(isApiClient({ id: 'x', firstName: 'better-awork-cli (API Client)' })).toBe(true)
    expect(isApiClient({ id: 'x', firstName: 'Yoshito', lastName: 'Maeoka' })).toBe(false)
  })
})

describe('findUser', () => {
  test('matches email case-insensitively', () => {
    expect(findUser(users, ' yoshito@example.com ')).toEqual({ kind: 'found', user: users[0] })
  })

  test('matches a full name', () => {
    expect(findUser(users, 'yoshito maeoka')).toMatchObject({ kind: 'found', user: { id: 'u1' } })
  })

  test('matches a unique partial name', () => {
    expect(findUser(users, 'Maeoka')).toMatchObject({ kind: 'found', user: { id: 'u1' } })
  })

  test('reports ambiguous names', () => {
    expect(findUser(users, 'ada')).toEqual({ kind: 'ambiguous', users: [users[1], users[2]] })
  })

  test('reports no match', () => {
    expect(findUser(users, 'nobody@example.com')).toEqual({ kind: 'none' })
    expect(findUser(users, '  ')).toEqual({ kind: 'none' })
  })
})
