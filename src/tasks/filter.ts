import type { Task } from '../api/schemas.js'

export interface TaskFilter {
  mineOnly: boolean
  includeDone: boolean
}

export const DEFAULT_FILTER: TaskFilter = { mineOnly: true, includeDone: false }

// Lower rank sorts first: work in flight before backlog, done last.
const STATUS_RANK: Record<string, number> = { progress: 0, review: 1, stuck: 2, todo: 3, done: 4 }
const UNKNOWN_RANK = 3

export const isDone = (task: Task): boolean => task.taskStatus.type === 'done'

export const assigneeIdsOf = (task: Task): string[] => [
  ...(task.assignees ?? []).map((a) => a.id),
  ...(task.assigneeId ? [task.assigneeId] : []),
]

export function filterTasks(tasks: readonly Task[], meId: string, filter: TaskFilter): Task[] {
  return tasks.filter(
    (task) => (filter.includeDone || !isDone(task)) && (!filter.mineOnly || assigneeIdsOf(task).includes(meId)),
  )
}

const dueValue = (task: Task): number => (task.dueOn ? Date.parse(task.dueOn) : Number.POSITIVE_INFINITY)

export function sortTasks(tasks: readonly Task[]): Task[] {
  const rank = (t: Task) => STATUS_RANK[t.taskStatus.type] ?? UNKNOWN_RANK
  return [...tasks].sort((a, b) => rank(a) - rank(b) || dueValue(a) - dueValue(b) || a.name.localeCompare(b.name))
}
