import { userName, type User } from './api/schemas.js'

export type UserMatch = { kind: 'found'; user: User } | { kind: 'ambiguous'; users: User[] } | { kind: 'none' }

const API_CLIENT_MARKER = '(api client)'

/** awork API keys authenticate as the integration's own user, not as the person using it. */
export const isApiClient = (user: User): boolean => userName(user).toLowerCase().includes(API_CLIENT_MARKER)

const emailsOf = (user: User): string[] =>
  (user.userContactInfos ?? []).filter((c) => c.type === 'email' && c.value).map((c) => c.value!.toLowerCase())

const toMatch = (users: User[]): UserMatch | null => {
  const [first] = users
  if (!first) return null
  return users.length === 1 ? { kind: 'found', user: first } : { kind: 'ambiguous', users }
}

/** Find a workspace user by email, full name, or a unique part of the name. */
export function findUser(users: readonly User[], query: string): UserMatch {
  const needle = query.trim().toLowerCase()
  if (!needle) return { kind: 'none' }
  const byEmail = users.filter((u) => emailsOf(u).includes(needle))
  const byName = users.filter((u) => userName(u).toLowerCase() === needle)
  const byPart = users.filter((u) => userName(u).toLowerCase().includes(needle))
  return toMatch(byEmail) ?? toMatch(byName) ?? toMatch(byPart) ?? { kind: 'none' }
}
