import { Box, Text, useInput } from 'ink'
import { useMemo, useState } from 'react'
import type { AworkApi } from '../api/awork.js'
import { userName, type Task, type TaskStatus } from '../api/schemas.js'
import { formatDate, isOverdue } from '../text/format.js'
import { CommentInput } from './CommentInput.js'
import { buildDetailLines } from './detailLines.js'
import { KeyHints } from './KeyHints.js'
import { StatusBadge } from './StatusBadge.js'
import { StatusPicker } from './StatusPicker.js'
import type { BrowserResult } from './ProjectBoard.js'
import { useTaskDetail } from './useTaskDetail.js'

type Mode = 'view' | 'status' | 'comment'

// Title, meta line, message line, margins and key hints.
const CHROME_ROWS = 7
const COMMENT_PANEL_ROWS = 5
const STATUS_PANEL_EXTRA_ROWS = 4
const MIN_BODY_ROWS = 3
const HORIZONTAL_PADDING = 2

interface Props {
  api: AworkApi
  task: Task
  statuses: readonly TaskStatus[]
  height: number
  width: number
  onBack: () => void
  onTaskUpdated: (task: Task) => void
  onOpenInBrowser: (task: Task) => Promise<BrowserResult>
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const panelRowsFor = (mode: Mode, statusCount: number): number =>
  mode === 'status' ? statusCount + STATUS_PANEL_EXTRA_ROWS : mode === 'comment' ? COMMENT_PANEL_ROWS : 0

export function TaskDetail(props: Props) {
  const { api, task: initial, statuses, height, width, onBack, onTaskUpdated } = props
  const detail = useTaskDetail(api, initial, onTaskUpdated)
  const [browserResult, setBrowserResult] = useState<BrowserResult>()
  const { task } = detail
  const [mode, setMode] = useState<Mode>('view')
  const [scroll, setScroll] = useState(0)

  const lines = useMemo(
    () => buildDetailLines(task.description, detail.comments, width - HORIZONTAL_PADDING),
    [task.description, detail.comments, width],
  )
  const bodyRows = Math.max(height - CHROME_ROWS - panelRowsFor(mode, statuses.length), MIN_BODY_ROWS)
  const maxScroll = Math.max(lines.length - bodyRows, 0)
  const offset = clamp(scroll, 0, maxScroll)

  useInput(
    (input, key) => {
      const scrollBy = (delta: number) => setScroll(clamp(offset + delta, 0, maxScroll))
      if (key.escape || key.backspace || key.leftArrow || input === 'q') onBack()
      else if (key.upArrow || input === 'k') scrollBy(-1)
      else if (key.downArrow || input === 'j') scrollBy(1)
      else if (key.pageUp || input === 'u') scrollBy(-bodyRows)
      else if (key.pageDown || input === ' ') scrollBy(bodyRows)
      else if (input === 'g') setScroll(0)
      else if (input === 'G') setScroll(maxScroll)
      else if (input === 'r') void detail.reload()
      else if (input === 's' && statuses.length > 0 && !detail.isBusy) setMode('status')
      else if (input === 'c' && !detail.isBusy) setMode('comment')
      else if (input === 'w') void props.onOpenInBrowser(task).then(setBrowserResult)
    },
    { isActive: mode === 'view' },
  )

  const pickStatus = async (status: TaskStatus) => {
    setMode('view')
    if (status.id !== task.taskStatus.id) await detail.changeStatus(status)
  }

  const submitComment = async (text: string) => {
    if (await detail.addComment(text)) {
      setMode('view')
      setScroll(Number.MAX_SAFE_INTEGER)
    }
  }

  const assignees = (task.assignees ?? []).map((a) => userName(a)).join(', ') || 'unassigned'
  const due = formatDate(task.dueOn)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold wrap="truncate-end">
        {task.name}
      </Text>
      <Text wrap="truncate-end">
        <StatusBadge status={task.taskStatus} width={task.taskStatus.name.length + 3} />
        <Text dimColor> · </Text>
        <Text>{assignees}</Text>
        {due ? (
          <>
            <Text dimColor> · due </Text>
            <Text color={isOverdue(task.dueOn) ? 'red' : undefined}>{due}</Text>
          </>
        ) : null}
      </Text>
      <StatusMessage
        error={browserResult?.isOk === false ? browserResult.message : detail.error}
        isBusy={detail.isBusy}
        isLoading={detail.isLoading}
        notice={browserResult?.isOk ? browserResult.message : detail.notice}
      />
      <Box flexDirection="column" marginTop={1} height={bodyRows}>
        {lines.slice(offset, offset + bodyRows).map((line, i) => (
          <Text key={offset + i} color={line.color} bold={line.bold} dimColor={line.dim}>
            {line.text || ' '}
          </Text>
        ))}
      </Box>
      {mode === 'status' ? (
        <StatusPicker statuses={statuses} currentId={task.taskStatus.id} onPick={pickStatus} onCancel={() => setMode('view')} />
      ) : null}
      {mode === 'comment' ? (
        <CommentInput isBusy={detail.isBusy} onSubmit={submitComment} onCancel={() => setMode('view')} />
      ) : null}
      <Box marginTop={1} justifyContent="space-between">
        <KeyHints
          hints={[
            ['s', 'status'],
            ['c', 'comment'],
            ['w', 'web'],
            ['↑↓', 'scroll'],
            ['r', 'reload'],
            ['esc', 'back'],
          ]}
        />
        {maxScroll > 0 ? <Text dimColor>{Math.round((offset / maxScroll) * 100)}%</Text> : null}
      </Box>
    </Box>
  )
}

interface StatusMessageProps {
  error?: string
  isBusy: boolean
  isLoading: boolean
  notice?: string
}

function StatusMessage({ error, isBusy, isLoading, notice }: StatusMessageProps) {
  const [color, text] = error
    ? ['red', error]
    : isBusy
      ? ['yellow', 'Saving…']
      : isLoading
        ? ['yellow', 'Loading…']
        : ['green', notice ?? ' ']
  return (
    <Text color={color} wrap="truncate-end">
      {text}
    </Text>
  )
}
