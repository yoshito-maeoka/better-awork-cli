import { Text } from 'ink'
import type { TaskStatus } from '../api/schemas.js'
import { statusColor } from '../text/format.js'

const BADGE_WIDTH = 14

export function StatusBadge({ status, width = BADGE_WIDTH }: { status: TaskStatus; width?: number }) {
  const label = status.name.length > width - 2 ? `${status.name.slice(0, width - 3)}…` : status.name
  return <Text color={statusColor(status.type)}>{`● ${label}`.padEnd(width)}</Text>
}
