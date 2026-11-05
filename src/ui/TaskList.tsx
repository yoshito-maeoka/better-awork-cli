import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useMemo, useState } from 'react'
import type { Task } from '../api/schemas.js'
import { normalize } from '../project/detect.js'
import { assigneeIdsOf, type TaskFilter } from '../tasks/filter.js'
import { fitText, formatAssignees, formatDate, isOverdue } from '../text/format.js'
import { KeyHints } from './KeyHints.js'
import { SelectList } from './SelectList.js'
import { StatusBadge } from './StatusBadge.js'

// Header, search line, blank line and key hints.
const CHROME_ROWS = 6
const DUE_WIDTH = 11
const BADGE_WIDTH = 14
const CURSOR_WIDTH = 2
const ROW_MARGIN = 2
const ASSIGNEE_WIDTH = 18
const MIN_NAME_WIDTH = 10
/** Below this terminal width the assignee column is dropped so task names stay readable. */
const MIN_WIDTH_FOR_ASSIGNEES = 70

interface Props {
  tasks: readonly Task[]
  meId: string
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

const personScope = (filter: TaskFilter): string => {
  if (filter.mentionedOnly) return 'mentioning me'
  return filter.mineOnly ? 'assigned to me' : 'everyone'
}

const matchesQuery = (task: Task, query: string) => normalize(task.name).includes(normalize(query))

interface TaskRowProps {
  task: Task
  meId: string
  isSelected: boolean
  width: number
}

function TaskRow({ task, meId, isSelected, width }: TaskRowProps) {
  const due = formatDate(task.dueOn)
  const showAssignees = width >= MIN_WIDTH_FOR_ASSIGNEES
  const fixedWidth = CURSOR_WIDTH + BADGE_WIDTH + DUE_WIDTH + ROW_MARGIN + (showAssignees ? ASSIGNEE_WIDTH + 1 : 0)
  const nameWidth = Math.max(width - fixedWidth, MIN_NAME_WIDTH)
  const isMine = assigneeIdsOf(task).includes(meId)
  return (
    <Text inverse={isSelected}>
      {isSelected ? '› ' : '  '}
      <StatusBadge status={task.taskStatus} width={BADGE_WIDTH} />
      <Text bold={isSelected}>{fitText(task.name, nameWidth)}</Text>
      {showAssignees ? (
        <Text color={isMine ? 'cyan' : 'gray'}> {fitText(formatAssignees(task.assignees), ASSIGNEE_WIDTH)}</Text>
      ) : null}
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
      else if (input === 'm') props.onFilterChange({ ...filter, mentionedOnly: !filter.mentionedOnly })
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

  const scope = `${personScope(filter)} · ${filter.includeDone ? 'all statuses' : 'open'}`
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
          key={`${query}|${filter.mineOnly}|${filter.includeDone}|${filter.mentionedOnly}`}
          items={visible}
          height={height - CHROME_ROWS}
          initialIndex={initialIndex}
          isActive={!isSearching}
          keyOf={(t) => t.id}
          onSelect={props.onOpen}
          onHighlight={props.onHighlight}
          emptyText={props.isLoading ? 'Loading tasks…' : 'No tasks match. Press a (everyone), m (mentions) or d (include done).'}
          renderItem={(task, isSelected) => (
            <TaskRow task={task} meId={props.meId} isSelected={isSelected} width={width} />
          )}
        />
      </Box>
      <Box marginTop={1}>
        <KeyHints
          hints={[
            ['↑↓', 'move'],
            ['enter', 'open'],
            ['/', 'search'],
            ['a', filter.mineOnly ? 'everyone' : 'mine'],
            ['m', filter.mentionedOnly ? 'all comments' : 'mentions'],
            ['d', filter.includeDone ? 'hide done' : 'show done'],
            ['r', 'refresh'],
            ['q', 'quit'],
          ]}
        />
      </Box>
    </Box>
  )
}
