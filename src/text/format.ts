import { userName, type User } from '../api/schemas.js'

const pad = (n: number) => String(n).padStart(2, '0')

const UNASSIGNED = '—'

/** Pad or cut `text` to exactly `width` characters, marking cuts with an ellipsis. */
export function fitText(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, Math.max(width - 1, 0))}…` : text.padEnd(width)
}

/** "Ada Lovelace", "Ada Lovelace +2", or a dash when nobody is assigned. */
export function formatAssignees(assignees: readonly User[] | null | undefined): string {
  const [first, ...rest] = assignees ?? []
  if (!first) return UNASSIGNED
  return rest.length ? `${userName(first)} +${rest.length}` : userName(first)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function isOverdue(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return false
  const due = Date.parse(iso)
  return Number.isFinite(due) && due < now.getTime()
}

export const STATUS_COLORS: Record<string, string> = {
  todo: 'gray',
  progress: 'yellow',
  review: 'magenta',
  stuck: 'red',
  done: 'green',
}

export const statusColor = (type: string): string => STATUS_COLORS[type] ?? 'white'
