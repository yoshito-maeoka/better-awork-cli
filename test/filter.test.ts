import { describe, expect, test } from 'vitest'
import { assigneeIdsOf, filterTasks, sortTasks } from '../src/tasks/filter.js'
import type { Task } from '../src/api/schemas.js'

const status = (type: string, name = type) => ({ id: `s-${type}`, name, type })
const task = (over: Partial<Task> & { id: string }): Task => ({
  name: over.id,
  taskStatus: status('todo'),
  assignees: [],
  ...over,
})

describe('assigneeIdsOf', () => {
  test('collects ids from assignees and legacy assigneeId', () => {
    expect(assigneeIdsOf(task({ id: 't', assignees: [{ id: 'u1' }], assigneeId: 'u2' }))).toEqual(['u1', 'u2'])
  })
})

describe('filterTasks', () => {
  const tasks = [
    task({ id: 'mine-open', assignees: [{ id: 'me' }] }),
    task({ id: 'mine-done', assignees: [{ id: 'me' }], taskStatus: status('done') }),
    task({ id: 'other-open', assignees: [{ id: 'other' }] }),
  ]

  test('defaults to tasks assigned to me that are not done', () => {
    const result = filterTasks(tasks, 'me', { mineOnly: true, includeDone: false })
    expect(result.map((t) => t.id)).toEqual(['mine-open'])
  })

  test('includes everyone when mineOnly is false', () => {
    const result = filterTasks(tasks, 'me', { mineOnly: false, includeDone: false })
    expect(result.map((t) => t.id)).toEqual(['mine-open', 'other-open'])
  })

  test('includes done tasks when requested', () => {
    const result = filterTasks(tasks, 'me', { mineOnly: true, includeDone: true })
    expect(result.map((t) => t.id)).toEqual(['mine-open', 'mine-done'])
  })

  test('does not mutate the input', () => {
    const copy = [...tasks]
    filterTasks(tasks, 'me', { mineOnly: true, includeDone: false })
    expect(tasks).toEqual(copy)
  })
})

describe('sortTasks', () => {
  test('orders by status type, then due date (missing last), then name', () => {
    const input = [
      task({ id: 'done', taskStatus: status('done') }),
      task({ id: 'todo-late', dueOn: '2026-12-01T00:00:00Z' }),
      task({ id: 'todo-nodue' }),
      task({ id: 'todo-early', dueOn: '2026-11-01T00:00:00Z' }),
      task({ id: 'progress', taskStatus: status('progress') }),
    ]
    expect(sortTasks(input).map((t) => t.id)).toEqual(['progress', 'todo-early', 'todo-late', 'todo-nodue', 'done'])
  })
})
