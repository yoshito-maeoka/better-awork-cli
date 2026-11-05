import { describe, expect, test, vi } from 'vitest'
import type { AworkApi } from '../src/api/awork.js'
import type { Comment, Task } from '../src/api/schemas.js'
import { findMentionedTaskIds, mentionsUser } from '../src/tasks/mentions.js'

const ME = '3bb5ccbc-dec3-476d-8600-8c58ac841b60'
const task = (id: string): Task => ({ id, name: id, taskStatus: { id: 's', name: 'todo', type: 'todo' } })
const comment = (message: string | null): Comment => ({ id: Math.random().toString(), message })

describe('mentionsUser', () => {
  test('detects the awork mention token for the user', () => {
    expect(mentionsUser(`<p>~[userId:${ME}] please check</p>`, ME)).toBe(true)
  })

  test('matches ids case-insensitively', () => {
    expect(mentionsUser(`<p>~[userId:${ME.toUpperCase()}]</p>`, ME)).toBe(true)
  })

  test('ignores mentions of other users and plain text ids', () => {
    expect(mentionsUser('<p>~[userId:dd822dce-32c6-4c8c-b4e5-11cb37aa2fa5]</p>', ME)).toBe(false)
    expect(mentionsUser(`<p>my id is ${ME}</p>`, ME)).toBe(false)
  })

  test('handles empty messages', () => {
    expect(mentionsUser(null, ME)).toBe(false)
    expect(mentionsUser(undefined, ME)).toBe(false)
  })
})

describe('findMentionedTaskIds', () => {
  const byTask: Record<string, Comment[]> = {
    a: [comment('<p>hello</p>'), comment(`<p>~[userId:${ME}] look</p>`)],
    b: [comment('<p>~[userId:someone-else]</p>')],
    c: [],
  }
  const api = (comments: AworkApi['comments']) => ({ comments }) as unknown as AworkApi

  test('returns the ids of tasks with a comment mentioning the user', async () => {
    const result = await findMentionedTaskIds(api(async (id) => byTask[id] ?? []), [task('a'), task('b'), task('c')], ME)
    expect([...result.mentioned]).toEqual(['a'])
    expect([...result.checked].sort()).toEqual(['a', 'b', 'c'])
    expect(result.failed).toBe(0)
  })

  test('counts failed lookups without aborting the rest', async () => {
    const comments = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('boom')
      return byTask[id] ?? []
    })
    const result = await findMentionedTaskIds(api(comments), [task('a'), task('b'), task('c')], ME)
    expect([...result.mentioned]).toEqual(['a'])
    expect(result.checked.has('b')).toBe(false)
    expect(result.failed).toBe(1)
  })

  test('never runs more requests at once than the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    const comments = async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return []
    }
    const tasks = Array.from({ length: 12 }, (_, i) => task(`t${i}`))
    await findMentionedTaskIds(api(comments), tasks, ME, 3)
    expect(peak).toBe(3)
  })
})
