import { Box, Text, useInput } from 'ink'
import { useEffect, useState, type ReactNode } from 'react'

export interface SelectListProps<T> {
  items: readonly T[]
  height: number
  keyOf: (item: T) => string
  renderItem: (item: T, isSelected: boolean) => ReactNode
  onSelect: (item: T) => void
  onHighlight?: (item: T) => void
  isActive?: boolean
  vimKeys?: boolean
  initialIndex?: number
  emptyText?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Keyboard-driven list that only renders the rows that fit in `height`. */
export function SelectList<T>({
  items,
  height,
  keyOf,
  renderItem,
  onSelect,
  onHighlight,
  isActive = true,
  vimKeys = true,
  initialIndex = 0,
  emptyText = 'Nothing here.',
}: SelectListProps<T>) {
  const [index, setIndex] = useState(initialIndex)
  const last = Math.max(items.length - 1, 0)
  const current = clamp(index, 0, last)
  const rows = Math.max(height, 1)

  useEffect(() => {
    const item = items[current]
    if (item && onHighlight) onHighlight(item)
    // onHighlight identity changes every render; only react to the selection itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, items])

  useInput(
    (input, key) => {
      const move = (delta: number) => setIndex(clamp(current + delta, 0, last))
      if (key.upArrow || (vimKeys && input === 'k')) move(-1)
      else if (key.downArrow || (vimKeys && input === 'j')) move(1)
      else if (key.pageUp) move(-rows)
      else if (key.pageDown) move(rows)
      else if (key.home || (vimKeys && input === 'g')) setIndex(0)
      else if (key.end || (vimKeys && input === 'G')) setIndex(last)
      else if (key.return) {
        const item = items[current]
        if (item) onSelect(item)
      }
    },
    { isActive },
  )

  if (items.length === 0) return <Text dimColor>{emptyText}</Text>

  const start = clamp(current - Math.floor(rows / 2), 0, Math.max(items.length - rows, 0))
  const visible = items.slice(start, start + rows)
  return (
    <Box flexDirection="column">
      {visible.map((item, i) => (
        <Box key={keyOf(item)}>{renderItem(item, start + i === current)}</Box>
      ))}
    </Box>
  )
}
