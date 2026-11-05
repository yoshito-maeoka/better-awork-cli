import { useCallback, useEffect, useState } from 'react'
import type { AworkApi } from '../api/awork.js'
import type { Task, TaskStatus } from '../api/schemas.js'
import { byCreatedOn, type AuthoredComment } from './detailLines.js'

export interface TaskDetailState {
  task: Task
  comments: AuthoredComment[]
  isLoading: boolean
  isBusy: boolean
  error?: string
  notice?: string
  reload: () => Promise<void>
  changeStatus: (status: TaskStatus) => Promise<boolean>
  addComment: (text: string) => Promise<boolean>
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Loads a task with its comments and exposes the two write actions of the detail view. */
export function useTaskDetail(api: AworkApi, initial: Task, onTaskUpdated: (task: Task) => void): TaskDetailState {
  const [task, setTask] = useState(initial)
  const [comments, setComments] = useState<AuthoredComment[]>([])
  const [isLoading, setLoading] = useState(true)
  const [isBusy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  const loadComments = useCallback(async () => {
    const raw = await api.comments(initial.id)
    const authored = await Promise.all(
      raw.map(async (comment) => ({ comment, author: comment.userId ? await api.user(comment.userId) : null })),
    )
    setComments([...authored].sort(byCreatedOn))
  }, [api, initial.id])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [fresh] = await Promise.all([api.task(initial.id), loadComments()])
      setTask(fresh)
    } catch (err) {
      setError(message(err))
    } finally {
      setLoading(false)
    }
  }, [api, initial.id, loadComments])

  useEffect(() => {
    void reload()
  }, [reload])

  const runAction = async (action: () => Promise<string>): Promise<boolean> => {
    setBusy(true)
    setError(undefined)
    try {
      setNotice(await action())
      return true
    } catch (err) {
      setError(message(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (status: TaskStatus) =>
    runAction(async () => {
      await api.changeStatus(task.id, status.id)
      const updated = { ...task, taskStatus: status }
      setTask(updated)
      onTaskUpdated(updated)
      return `Status changed to ${status.name}.`
    })

  const addComment = (text: string) =>
    runAction(async () => {
      await api.addComment(task.id, text)
      await loadComments()
      return 'Comment posted.'
    })

  return { task, comments, isLoading, isBusy, error, notice, reload, changeStatus, addComment }
}
