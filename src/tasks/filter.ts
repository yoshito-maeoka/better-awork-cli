import type { Task } from '../api/schemas.js'

export interface TaskFilter {
  mineOnly: boolean
  includeDone: boolean
  /** Only tasks where a comment mentions me; overrides mineOnly. */
  mentionedOnly: boolean
}

export const DEFAULT_FILTER: TaskFilter = { mineOnly: true, includeDone: false, mentionedOnly: false }

const NO_MENTIONS: ReadonlySet<string> = new Set()

// Lower rank sorts first: work in flight before backlog, done last.
const STATUS_RANK: Record<string, number> = { progress: 0, review: 1, stuck: 2, todo: 3, done: 4 }
const UNKNOWN_RANK = 3

export const isDone = (task: Task): boolean => task.taskStatus.type === 'done'

export const assigneeIdsOf = (task: Task): string[] => [
  ...(task.assignees ?? []).map((a) => a.id),
  ...(task.assigneeId ? [task.assigneeId] : []),
]

const matchesPerson = (task: Task, meId: string, filter: TaskFilter, mentionedIds: ReadonlySet<string>): boolean => {
  if (filter.mentionedOnly) return mentionedIds.has(task.id)
  return !filter.mineOnly || assigneeIdsOf(task).includes(meId)
}

export function filterTasks(
  tasks: readonly Task[],
  meId: string,
  filter: TaskFilter,
  mentionedIds: ReadonlySet<string> = NO_MENTIONS,
): Task[] {
  return tasks.filter(
    (task) => (filter.includeDone || !isDone(task)) && matchesPerson(task, meId, filter, mentionedIds),
  )
}

const dueValue = (task: Task): number => (task.dueOn ? Date.parse(task.dueOn) : Number.POSITIVE_INFINITY)

export function sortTasks(tasks: readonly Task[]): Task[] {
  const rank = (t: Task) => STATUS_RANK[t.taskStatus.type] ?? UNKNOWN_RANK
  return [...tasks].sort((a, b) => rank(a) - rank(b) || dueValue(a) - dueValue(b) || a.name.localeCompare(b.name))
}
