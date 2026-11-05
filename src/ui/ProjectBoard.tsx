import { useApp, useWindowSize } from 'ink'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AworkApi } from '../api/awork.js'
import type { Task, TaskStatus } from '../api/schemas.js'
import type { ProjectRef } from '../project/resolve.js'
import { filterTasks, isDone, sortTasks, type TaskFilter } from '../tasks/filter.js'
import { TaskDetail } from './TaskDetail.js'
import { TaskList } from './TaskList.js'
import { useMentions } from './useMentions.js'

interface Props {
  api: AworkApi
  meId: string
  project: ProjectRef
  initialFilter: TaskFilter
  notice?: string
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Owns the project's tasks and switches between the list and a task's detail view. */
export function ProjectBoard({ api, meId, project, initialFilter, notice: initialNotice }: Props) {
  const { exit } = useApp()
  const { rows, columns } = useWindowSize()
  const [tasks, setTasks] = useState<Task[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [filter, setFilter] = useState(initialFilter)
  const [isLoading, setLoading] = useState(true)
  const [notice, setNotice] = useState(initialNotice)
  const [selectedId, setSelectedId] = useState<string>()
  const [openTask, setOpenTask] = useState<Task>()

  // Only scan tasks the done filter would show anyway, to keep request counts down.
  const mentionCandidates = useMemo(
    () => (filter.includeDone ? tasks : tasks.filter((t) => !isDone(t))),
    [tasks, filter.includeDone],
  )
  const mentions = useMentions(api, mentionCandidates, meId, filter.mentionedOnly)
  const { reset: resetMentions } = mentions

  const load = useCallback(async () => {
    setLoading(true)
    resetMentions()
    try {
      const [loadedTasks, loadedStatuses] = await Promise.all([
        api.projectTasks(project.id),
        api.taskStatuses(project.id),
      ])
      setTasks(loadedTasks)
      setStatuses(loadedStatuses)
    } catch (err) {
      setNotice(`Could not load tasks: ${message(err)}`)
    } finally {
      setLoading(false)
    }
  }, [api, project.id, resetMentions])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => sortTasks(filterTasks(tasks, meId, filter, mentions.mentionedIds)),
    [tasks, meId, filter, mentions.mentionedIds],
  )

  const replaceTask = useCallback((updated: Task) => {
    setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)))
  }, [])

  if (openTask) {
    return (
      <TaskDetail
        api={api}
        task={openTask}
        statuses={statuses}
        height={rows}
        width={columns}
        onBack={() => setOpenTask(undefined)}
        onTaskUpdated={replaceTask}
      />
    )
  }

  return (
    <TaskList
      tasks={visible}
      meId={meId}
      projectName={project.name}
      filter={filter}
      isLoading={isLoading || mentions.isScanning}
      notice={mentions.warning ?? notice}
      height={rows}
      width={columns}
      selectedId={selectedId}
      onHighlight={(t) => setSelectedId(t.id)}
      onOpen={setOpenTask}
      onFilterChange={setFilter}
      onRefresh={() => void load()}
      onQuit={exit}
    />
  )
}
