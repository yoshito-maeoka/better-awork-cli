const pad = (n: number) => String(n).padStart(2, '0')

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
