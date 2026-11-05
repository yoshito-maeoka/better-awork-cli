import { Box, Text, useInput } from 'ink'
import type { TaskStatus } from '../api/schemas.js'
import { KeyHints } from './KeyHints.js'
import { SelectList } from './SelectList.js'
import { StatusBadge } from './StatusBadge.js'

interface Props {
  statuses: readonly TaskStatus[]
  currentId: string
  onPick: (status: TaskStatus) => void
  onCancel: () => void
}

export function StatusPicker({ statuses, currentId, onPick, onCancel }: Props) {
  useInput((_input, key) => {
    if (key.escape) onCancel()
  })
  const initialIndex = Math.max(
    statuses.findIndex((s) => s.id === currentId),
    0,
  )
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold>Change status</Text>
      <SelectList
        items={statuses}
        height={statuses.length}
        initialIndex={initialIndex}
        keyOf={(s) => s.id}
        onSelect={onPick}
        renderItem={(s, isSelected) => (
          <Text inverse={isSelected}>
            {isSelected ? '› ' : '  '}
            <StatusBadge status={s} width={24} />
            {s.id === currentId ? <Text dimColor> (current)</Text> : null}
          </Text>
        )}
      />
      <KeyHints hints={[['enter', 'apply'], ['esc', 'cancel']]} />
    </Box>
  )
}
