import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useMemo, useState } from 'react'
import type { Task } from '../api/schemas.js'
import { normalize } from '../project/detect.js'
import type { TaskFilter } from '../tasks/filter.js'
import { formatDate, isOverdue } from '../text/format.js'
import { KeyHints } from './KeyHints.js'
import { SelectList } from './SelectList.js'
import { StatusBadge } from './StatusBadge.js'

// Header, search line, blank line and key hints.
const CHROME_ROWS = 6
const DUE_WIDTH = 11

interface Props {
  tasks: readonly Task[]
  projectName: string
  filter: TaskFilter
  isLoading: boolean
  notice?: string
  height: number
  width: number
  selectedId?: string
  onHighlight: (task: Task) => void
  onOpen: (task: Task) => void
  onFilterChange: (filter: TaskFilter) => void
  onRefresh: () => void
  onQuit: () => void
}

const matchesQuery = (task: Task, query: string) => normalize(task.name).includes(normalize(query))

function TaskRow({ task, isSelected, width }: { task: Task; isSelected: boolean; width: number }) {
  const due = formatDate(task.dueOn)
  const nameWidth = Math.max(width - 14 - DUE_WIDTH - 4, 10)
  const name = task.name.length > nameWidth ? `${task.name.slice(0, nameWidth - 1)}…` : task.name.padEnd(nameWidth)
  return (
    <Text inverse={isSelected}>
      {isSelected ? '› ' : '  '}
      <StatusBadge status={task.taskStatus} />
      <Text bold={isSelected}>{name}</Text>
      <Text color={isOverdue(task.dueOn) ? 'red' : 'gray'}> {due.padEnd(DUE_WIDTH - 1)}</Text>
    </Text>
  )
}

export function TaskList(props: Props) {
  const { tasks, filter, height, width } = props
  const [query, setQuery] = useState('')
  const [isSearching, setSearching] = useState(false)
  const visible = useMemo(() => (query ? tasks.filter((t) => matchesQuery(t, query)) : tasks), [tasks, query])
  const initialIndex = Math.max(
    visible.findIndex((t) => t.id === props.selectedId),
    0,
  )

  useInput(
    (input, key) => {
      if (input === 'q' || key.escape) {
        if (query) setQuery('')
        else props.onQuit()
      } else if (input === '/') setSearching(true)
      else if (input === 'a') props.onFilterChange({ ...filter, mineOnly: !filter.mineOnly })
      else if (input === 'd') props.onFilterChange({ ...filter, includeDone: !filter.includeDone })
      else if (input === 'r') props.onRefresh()
    },
    { isActive: !isSearching },
  )

  useInput(
    (_input, key) => {
      if (key.escape) {
        setQuery('')
        setSearching(false)
      }
    },
    { isActive: isSearching },
  )

  const scope = `${filter.mineOnly ? 'assigned to me' : 'everyone'} · ${filter.includeDone ? 'all statuses' : 'open'}`
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text>
          <Text bold color="cyan">
            {props.projectName}
          </Text>
          <Text dimColor>
            {'  '}
            {scope} · {visible.length} task{visible.length === 1 ? '' : 's'}
          </Text>
        </Text>
        {props.isLoading ? <Text color="yellow">loading…</Text> : null}
      </Box>
      <Box>
        {isSearching ? (
          <Text>
            <Text color="cyan">/ </Text>
            <TextInput value={query} onChange={setQuery} onSubmit={() => setSearching(false)} />
          </Text>
        ) : (
          <Text dimColor>{query ? `filter: ${query}` : props.notice ?? ' '}</Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <SelectList
          key={`${query}|${filter.mineOnly}|${filter.includeDone}`}
          items={visible}
          height={height - CHROME_ROWS}
          initialIndex={initialIndex}
          isActive={!isSearching}
          keyOf={(t) => t.id}
          onSelect={props.onOpen}
          onHighlight={props.onHighlight}
          emptyText={props.isLoading ? 'Loading tasks…' : 'No tasks match. Press a (everyone) or d (include done).'}
          renderItem={(task, isSelected) => <TaskRow task={task} isSelected={isSelected} width={width} />}
        />
      </Box>
      <Box marginTop={1}>
        <KeyHints
          hints={[
            ['↑↓', 'move'],
            ['enter', 'open'],
            ['/', 'search'],
            ['a', filter.mineOnly ? 'everyone' : 'mine'],
            ['d', filter.includeDone ? 'hide done' : 'show done'],
            ['r', 'refresh'],
            ['q', 'quit'],
          ]}
        />
      </Box>
    </Box>
  )
}
