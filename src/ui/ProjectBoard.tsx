import { useApp, useWindowSize } from 'ink'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AworkApi } from '../api/awork.js'
import type { Task, TaskStatus } from '../api/schemas.js'
import type { ProjectRef } from '../project/resolve.js'
import { filterTasks, sortTasks, type TaskFilter } from '../tasks/filter.js'
import { TaskDetail } from './TaskDetail.js'
import { TaskList } from './TaskList.js'

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

  const load = useCallback(async () => {
    setLoading(true)
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
  }, [api, project.id])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => sortTasks(filterTasks(tasks, meId, filter)), [tasks, meId, filter])

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
      projectName={project.name}
      filter={filter}
      isLoading={isLoading}
      notice={notice}
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
